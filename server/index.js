"use strict";

/**
 * Railway checkout API.
 *
 * Secrets: read STRIPE_SECRET_KEY from process.env only (Railway Variables).
 * Never log, print, or write that value. Never put sk_live in this repo.
 *
 * Apple Pay (developer / Dashboard only — never shown in visitor copy):
 * Apple Pay on web is not a separate Checkout payment_method_type. It is a
 * wallet on `card`. Register the public site domain:
 *   Settings → Payment methods → Apple Pay  (or Payment method domains)
 * Checkout then shows Apple Pay on supported devices once the domain is
 * verified. Payment Links need the same verification for the fallback links.
 *
 * The donate page sends paymentMethod: "card" | "apple_pay". Both sessions
 * still use payment_method_types[card]. apple_pay preference is stored in
 * metadata; Link is turned off so the hosted page emphasises card vs wallet.
 *
 * Local: copy .env.example → .env, then `npm start` (PORT=3000).
 * Deploy: Railway service from this repo, start command `npm start`,
 * set STRIPE_SECRET_KEY (rotated secret) and SITE_URL.
 *
 * Votes: set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (Railway Variables only).
 * POST /cast-vote with Authorization: Bearer <user access token>.
 * Never log or commit those keys.
 */

const fs = require("fs");
const path = require("path");
const http = require("http");

function loadDotEnv() {
  const file = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  text.split("\n").forEach(function (line) {
    const t = line.trim();
    if (!t || t.startsWith("#")) return;
    const i = t.indexOf("=");
    if (i < 1) return;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] == null || process.env[k] === "") process.env[k] = v;
  });
}

loadDotEnv();

const MIN_PENCE = 100;
const MAX_PENCE = 500000;

function env(name, fallback) {
  const v = process.env[name];
  if (v == null || String(v).trim() === "") return fallback;
  return String(v).trim();
}

function siteUrlFromEnv() {
  return env("SITE_URL", "https://saveburyyouth.com").replace(/\/$/, "");
}

function allowedOrigins() {
  const extra = env("ALLOWED_ORIGINS", "")
    .split(",")
    .map(function (s) {
      return s.trim().replace(/\/$/, "");
    })
    .filter(Boolean);
  return new Set([siteUrlFromEnv()].concat(extra));
}

function resolveSiteUrl(req, body) {
  const allowed = allowedOrigins();
  const origin = String((body && body.origin) || req.headers.origin || "")
    .trim()
    .replace(/\/$/, "");
  if (origin && allowed.has(origin)) return origin;
  return siteUrlFromEnv();
}

function applyCors(req, res) {
  const allowed = allowedOrigins();
  const origin = String(req.headers.origin || "").replace(/\/$/, "");
  if (origin && allowed.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", siteUrlFromEnv());
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readJson(req) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let size = 0;
    req.on("data", function (c) {
      size += c.length;
      if (size > 32 * 1024) {
        reject(new Error("too_large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", function () {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

function toPence(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function resolvePaymentMethod(body) {
  const raw = String(
    (body && (body.paymentMethod || body.payment_method)) || "card"
  )
    .toLowerCase()
    .replace(/-/g, "_");
  if (raw === "apple_pay" || raw === "applepay") return "apple_pay";
  return "card";
}

function buildCheckoutForm(mode, pence, site, paymentMethod) {
  const productName = mode === "subscription" ? "Monthly donation" : "Donation";
  const form = new URLSearchParams();
  form.set("mode", mode);
  form.set("locale", "en-GB");
  form.set("success_url", site + "/donations.html?status=success");
  form.set("cancel_url", site + "/donate-checkout.html?status=cancelled");
  // Apple Pay / Google Pay wallets ride on card after domain verification.
  // Checkout Sessions API does not accept payment_method_types=apple_pay.
  form.append("payment_method_types[0]", "card");
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", "gbp");
  form.set("line_items[0][price_data][unit_amount]", String(pence));
  form.set("line_items[0][price_data][product_data][name]", productName);
  if (mode === "subscription") {
    form.set("line_items[0][price_data][recurring][interval]", "month");
    form.set("subscription_data[metadata][payment_method]", paymentMethod);
  } else {
    form.set("submit_type", "donate");
    form.set("payment_intent_data[metadata][payment_method]", paymentMethod);
  }
  form.set("metadata[payment_method]", paymentMethod);
  // Hide Link so hosted Checkout emphasises card entry vs Apple Pay wallet.
  form.set("wallet_options[link][display]", "never");
  return form;
}

async function postCheckoutSession(key, form) {
  return fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
}

function secretKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !String(key).trim()) return "";
  return String(key).trim();
}

async function createCheckout(req, res, body) {
  const key = secretKey();
  if (!key) {
    send(res, 503, { error: "not_configured" });
    return;
  }

  const modeIn = String((body && body.mode) || "payment").toLowerCase();
  const mode = modeIn === "subscription" ? "subscription" : "payment";
  const pence = toPence(body && body.amount);
  if (pence == null || pence < MIN_PENCE || pence > MAX_PENCE) {
    send(res, 400, { error: "invalid_amount" });
    return;
  }

  const site = resolveSiteUrl(req, body);
  const paymentMethod = resolvePaymentMethod(body);
  const form = buildCheckoutForm(mode, pence, site, paymentMethod);

  try {
    let apiRes = await postCheckoutSession(key, form);
    let session = await apiRes.json();
    if ((!apiRes.ok || !session || !session.url) && form.has("wallet_options[link][display]")) {
      form.delete("wallet_options[link][display]");
      apiRes = await postCheckoutSession(key, form);
      session = await apiRes.json();
    }
    if (!apiRes.ok || !session || !session.url) {
      const code = session && session.error && session.error.code;
      console.error("checkout_create_failed", code || "");
      send(res, 500, { error: "create_failed" });
      return;
    }
    send(res, 200, { id: session.id, url: session.url });
  } catch (err) {
    console.error("checkout_create_failed");
    send(res, 500, { error: "create_failed" });
  }
}

const BURY_TOWNS = [
  "Radcliffe",
  "Tottington",
  "Bury",
  "Ramsbottom",
  "Whitefield",
];

function votesConfigured() {
  return Boolean(env("SUPABASE_URL", "") && env("SUPABASE_SERVICE_ROLE_KEY", ""));
}

function supabaseUrl() {
  return env("SUPABASE_URL", "").replace(/\/$/, "");
}

function serviceRoleKey() {
  return env("SUPABASE_SERVICE_ROLE_KEY", "");
}

function bearerToken(req) {
  const h = String(req.headers.authorization || "");
  const m = /^Bearer\s+(\S+)/i.exec(h);
  return m ? m[1] : "";
}

function ageFromDob(dob, now) {
  const raw = String(dob || "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const today = now || new Date();
  const ty = today.getFullYear();
  const tmo = today.getMonth() + 1;
  const td = today.getDate();
  if (y > ty || (y === ty && (mo > tmo || (mo === tmo && d > td)))) return null;
  let age = ty - y;
  if (tmo < mo || (tmo === mo && td < d)) age -= 1;
  return age;
}

function isBuryTown(town) {
  return BURY_TOWNS.indexOf(String(town || "").trim()) !== -1;
}

function parseUnder18Flag(value) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
}

function eligibilityFromProfile(profile) {
  if (!profile) return { eligible: false, reason: "incomplete" };
  const town = String(profile.town || "").trim();
  const under18 = parseUnder18Flag(profile.under_18);
  if (!town || under18 == null) return { eligible: false, reason: "incomplete" };
  if (!isBuryTown(town) || !under18) {
    return { eligible: false, reason: "ineligible" };
  }
  return { eligible: true, reason: "" };
}

async function rest(path, opts) {
  opts = opts || {};
  const url = supabaseUrl();
  const key = serviceRoleKey();
  const res = await fetch(url + "/rest/v1" + path, {
    method: opts.method || "GET",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      Prefer: opts.prefer || "return=representation",
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });
  return res;
}

async function userFromJwt(jwt) {
  if (!jwt || !votesConfigured()) return null;
  const res = await fetch(supabaseUrl() + "/auth/v1/user", {
    headers: {
      Authorization: "Bearer " + jwt,
      apikey: serviceRoleKey(),
    },
  });
  if (!res.ok) return null;
  const user = await res.json();
  if (!user || !user.id) return null;
  return user;
}

async function loadProfile(userId) {
  const res = await rest(
    "/profiles?id=eq." +
      encodeURIComponent(userId) +
      "&select=id,email,town,date_of_birth,under_18&limit=1"
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows && rows[0] ? rows[0] : null;
}

async function loadPoll(pollId) {
  const res = await rest(
    "/polls?id=eq." + encodeURIComponent(pollId) + "&select=id,options,active&limit=1"
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows && rows[0] ? rows[0] : null;
}

async function tallyForPoll(pollId) {
  const res = await rest(
    "/votes?poll_id=eq." + encodeURIComponent(pollId) + "&select=option_id"
  );
  if (!res.ok) return {};
  const rows = await res.json();
  const tally = {};
  (rows || []).forEach(function (v) {
    const id = v && v.option_id;
    if (!id) return;
    tally[id] = (tally[id] || 0) + 1;
  });
  return tally;
}

async function requireAuthedProfile(req, res) {
  if (!votesConfigured()) {
    send(res, 503, { error: "not_configured" });
    return null;
  }
  const jwt = bearerToken(req);
  if (!jwt) {
    send(res, 401, { error: "unauthorized" });
    return null;
  }
  const user = await userFromJwt(jwt);
  if (!user) {
    send(res, 401, { error: "unauthorized" });
    return null;
  }
  const profile = await loadProfile(user.id);
  return { user: user, profile: profile };
}

async function handleEligibility(req, res) {
  const ctx = await requireAuthedProfile(req, res);
  if (!ctx) return;
  const check = eligibilityFromProfile(ctx.profile);
  send(res, 200, {
    eligible: check.eligible,
    reason: check.eligible ? "ok" : check.reason,
  });
}

function optionInPoll(poll, optionId) {
  const opts = poll && poll.options;
  if (!Array.isArray(opts)) return false;
  return opts.some(function (o) {
    return o && String(o.id) === String(optionId);
  });
}

async function handleCastVote(req, res, body) {
  const ctx = await requireAuthedProfile(req, res);
  if (!ctx) return;

  const check = eligibilityFromProfile(ctx.profile);
  if (!check.eligible) {
    send(res, 403, { error: "ineligible" });
    return;
  }

  const pollId = String((body && body.pollId) || "").trim();
  const optionId = String((body && body.optionId) || "").trim();
  if (!pollId || !optionId || optionId.length > 80) {
    send(res, 400, { error: "invalid" });
    return;
  }

  const poll = await loadPoll(pollId);
  if (!poll || poll.active === false) {
    send(res, 400, { error: "closed" });
    return;
  }
  if (!optionInPoll(poll, optionId)) {
    send(res, 400, { error: "invalid" });
    return;
  }

  const insert = await rest("/votes", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      poll_id: pollId,
      option_id: optionId,
      voter_key: ctx.user.id,
    },
  });

  if (insert.status === 409) {
    send(res, 409, { error: "already" });
    return;
  }
  if (!insert.ok) {
    let code = "";
    try {
      const errBody = await insert.json();
      code = String((errBody && errBody.code) || "");
    } catch (e) {
      code = "";
    }
    if (code === "23505") {
      send(res, 409, { error: "already" });
      return;
    }
    console.error("cast_vote_failed");
    send(res, 500, { error: "create_failed" });
    return;
  }

  const tally = await tallyForPoll(pollId);
  send(res, 200, { ok: true, tally: tally });
}

function route(req) {
  const u = new URL(req.url || "/", "http://localhost");
  return { method: req.method || "GET", path: u.pathname.replace(/\/$/, "") || "/" };
}

const CORS_PATHS = {
  "/create-checkout": true,
  "/cast-vote": true,
  "/vote-eligibility": true,
  "/": true,
};

const server = http.createServer(async function (req, res) {
  applyCors(req, res);
  const { method, path } = route(req);

  if (method === "OPTIONS" && CORS_PATHS[path]) {
    res.writeHead(204);
    res.end();
    return;
  }

  if (method === "GET" && (path === "/" || path === "/health")) {
    send(res, 200, {
      ok: true,
      configured: Boolean(process.env.STRIPE_SECRET_KEY),
      votesConfigured: votesConfigured(),
    });
    return;
  }

  if (method === "GET" && path === "/vote-eligibility") {
    try {
      await handleEligibility(req, res);
    } catch (err) {
      console.error("vote_eligibility_failed");
      send(res, 500, { error: "create_failed" });
    }
    return;
  }

  if (method === "POST" && path === "/cast-vote") {
    try {
      const body = await readJson(req);
      await handleCastVote(req, res, body);
    } catch (err) {
      const code = err && err.message === "invalid_json" ? 400 : 500;
      if (code === 500) console.error("cast_vote_failed");
      send(res, code, { error: code === 400 ? "bad_request" : "create_failed" });
    }
    return;
  }

  if (method === "POST" && path === "/create-checkout") {
    try {
      const body = await readJson(req);
      await createCheckout(req, res, body);
    } catch (err) {
      const code = err && err.message === "invalid_json" ? 400 : 400;
      send(res, code, { error: "bad_request" });
    }
    return;
  }

  send(res, 404, { error: "not_found" });
});

const port = Number(env("PORT", "3000")) || 3000;
server.listen(port, function () {
  console.log("checkout listening on " + port);
});
