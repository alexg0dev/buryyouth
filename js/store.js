/**
 * Save Our Youth data layer
 * Uses the configured auth backend when window.BYC_SUPABASE is filled, otherwise localStorage.
 *
 * Passwords: never log or store them. They go only to signIn/signUp (hashed by the
 * auth service). Use HTTPS in production. Do not put secrets in query strings.
 */
(function (global) {
  const KEYS = {
    suggestions: "byc_suggestions",
    polls: "byc_polls",
    votes: "byc_votes",
    session: "byc_admin_session",
    updates: "byc_updates",
    events: "byc_events",
    donations: "byc_donations",
    mentions: "byc_mentions",
    joins: "byc_joins",
    profiles: "byc_profiles",
  };

  const ADMIN_PASSWORD = "8872";
  const POLL_QUESTION = "What should be prioritised for Bury's youth?";
  const BURY_TOWNS = [
    "Radcliffe",
    "Tottington",
    "Bury",
    "Ramsbottom",
    "Whitefield",
  ];

  function apiBase() {
    const fromApi = String((global.BYC_API || {}).apiBase || "")
      .trim()
      .replace(/\/$/, "");
    if (fromApi) return fromApi;
    const checkout = String((global.BYC_STRIPE || {}).checkoutEndpoint || "")
      .trim()
      .replace(/\/$/, "");
    if (checkout) return checkout.replace(/\/create-checkout$/i, "");
    return "";
  }

  function voteUrl() {
    const base = apiBase();
    return base ? base + "/cast-vote" : "";
  }

  function isBuryTown(town) {
    return BURY_TOWNS.indexOf(String(town || "").trim()) !== -1;
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
    if (tmo < mo || (tmo === tmo && td < d)) age -= 1;
    return age;
  }

  function parseUnder18Flag(value) {
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    return null;
  }

  function eligibilityFromProfile(profile) {
    if (!profile) return { eligible: false, reason: "incomplete" };
    const town = String(profile.town || "").trim();
    const under18 = parseUnder18Flag(
      profile.under18 != null ? profile.under18 : profile.under_18
    );
    if (!town || under18 == null) return { eligible: false, reason: "incomplete" };
    if (!isBuryTown(town) || !under18) {
      return { eligible: false, reason: "ineligible" };
    }
    return { eligible: true, reason: "" };
  }

  function normalizeDob(value) {
    const raw = String(value || "").trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    return m ? m[1] + "-" + m[2] + "-" + m[3] : "";
  }

  const cfg = global.BYC_SUPABASE || {};
  const useSupabase = Boolean(cfg.url && cfg.anonKey && global.supabase);

  // Implicit flow: confirmation links work even if opened on another device.
  // Static site has no token-exchange endpoint for PKCE.
  let sb = null;
  if (useSupabase) {
    sb = global.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "implicit",
      },
    });
  }

  function loginRedirectUrl() {
    try {
      const loc = global.location;
      if (loc && (loc.protocol === "http:" || loc.protocol === "https:")) {
        const origin = String(loc.origin || "").replace(/\/$/, "");
        if (origin && origin !== "null") return origin + "/login.html";
      }
    } catch (e) {
      // file:// or missing location — use the public site.
    }
    return "https://saveburyyouth.com/login.html";
  }

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function uid() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
  }

  function seedIfEmpty(key, items) {
    const existing = read(key, null);
    if (existing && existing.length) return;
    write(key, items);
  }

  function seedLocal() {
    seedIfEmpty(KEYS.polls, [
      {
        id: uid(),
        question: POLL_QUESTION,
        options: [
          { id: uid(), label: "Safer streets & transport" },
          { id: uid(), label: "Mental health support" },
          { id: uid(), label: "More youth spaces & activities" },
          { id: uid(), label: "Jobs, skills & opportunities" },
        ],
        active: true,
        createdAt: new Date().toISOString(),
      },
    ]);

    // Keep wording updated for older local seeds
    const polls = read(KEYS.polls, []);
    let changed = false;
    polls.forEach((p) => {
      if (
        p.question === "What should we push hardest on next?" ||
        /priitoirised|prioritise next/i.test(p.question || "")
      ) {
        p.question = POLL_QUESTION;
        changed = true;
      }
    });
    if (changed) write(KEYS.polls, polls);

    seedIfEmpty(KEYS.updates, [
      {
        id: uid(),
        title: "Public transport safety",
        body: "Looking into antisocial behaviour on buses and other public transport around Bury.",
        createdAt: new Date().toISOString(),
      },
      {
        id: uid(),
        title: "Youth employment",
        body: "Working on pathways into work for 16–18 year olds, including support that helps employers take young people on.",
        createdAt: new Date().toISOString(),
      },
    ]);

    seedIfEmpty(KEYS.events, [
      {
        id: uid(),
        title: "More events soon",
        when: "Dates to be announced",
        where: "Bury",
        body: "Campaign meet-ups and protest details will be posted here.",
        createdAt: new Date().toISOString(),
      },
    ]);

    seedIfEmpty(KEYS.donations, [
      {
        id: uid(),
        name: "Anonymous",
        amount: "£10",
        note: "Keep going",
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  if (!useSupabase) seedLocal();

  function listGet(key) {
    return read(key, []).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  function listAdd(key, item) {
    const list = read(key, []);
    const row = { id: uid(), createdAt: new Date().toISOString(), ...item };
    list.push(row);
    write(key, list);
    return row;
  }

  function listDelete(key, id) {
    write(
      key,
      read(key, []).filter((x) => x.id !== id)
    );
  }

  function listPatch(key, id, patch) {
    let updated = null;
    const next = read(key, []).map((x) => {
      if (x.id !== id) return x;
      updated = { ...x, ...patch };
      return updated;
    });
    write(key, next);
    return updated;
  }

  function mapIssue(row) {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      area: row.area,
      topic: row.topic,
      message: row.message,
      status: row.status,
      createdAt: row.created_at,
    };
  }

  function mapJoin(row) {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      cause: row.cause,
      note: row.note,
      createdAt: row.created_at,
    };
  }

  function mapUpdate(row) {
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      createdAt: row.created_at,
    };
  }

  function mapEvent(row) {
    return {
      id: row.id,
      title: row.title,
      when: row.event_when,
      where: row.event_where,
      body: row.body,
      createdAt: row.created_at,
    };
  }

  function mapDonation(row) {
    return {
      id: row.id,
      name: row.name,
      amount: row.amount,
      note: row.note,
      createdAt: row.created_at,
    };
  }

  function mapPoll(row) {
    return {
      id: row.id,
      question: row.question,
      options: row.options || [],
      active: row.active,
      createdAt: row.created_at,
    };
  }

  function mapProfile(row) {
    return {
      id: row.id,
      email: row.email,
      town: row.town || "",
      dateOfBirth: normalizeDob(row.date_of_birth || row.dateOfBirth || ""),
      under18: parseUnder18Flag(row.under_18 != null ? row.under_18 : row.under18),
      createdAt: row.created_at,
    };
  }

  const localStore = {
    async getSuggestions() {
      return listGet(KEYS.suggestions);
    },
    async addSuggestion({ name, email, area, topic, message }) {
      return listAdd(KEYS.suggestions, {
        name: (name || "Anonymous").trim() || "Anonymous",
        email: (email || "").trim(),
        area: (area || "").trim(),
        topic: (topic || "General").trim(),
        message: (message || "").trim(),
        status: "new",
      });
    },
    async updateSuggestionStatus(id, status) {
      const next = read(KEYS.suggestions, []).map((s) =>
        s.id === id ? { ...s, status } : s
      );
      write(KEYS.suggestions, next);
      return next;
    },
    async deleteSuggestion(id) {
      listDelete(KEYS.suggestions, id);
    },
    async getUpdates() {
      return listGet(KEYS.updates);
    },
    async addUpdate({ title, body }) {
      return listAdd(KEYS.updates, {
        title: String(title || "").trim(),
        body: String(body || "").trim(),
      });
    },
    async deleteUpdate(id) {
      listDelete(KEYS.updates, id);
    },
    async updateUpdate({ id, title, body }) {
      return listPatch(KEYS.updates, id, {
        title: String(title || "").trim(),
        body: String(body || "").trim(),
      });
    },
    async getEvents() {
      return listGet(KEYS.events);
    },
    async addEvent({ title, when, where, body }) {
      return listAdd(KEYS.events, {
        title: String(title || "").trim(),
        when: String(when || "").trim(),
        where: String(where || "").trim(),
        body: String(body || "").trim(),
      });
    },
    async deleteEvent(id) {
      listDelete(KEYS.events, id);
    },
    async updateEvent({ id, title, when, where, body }) {
      return listPatch(KEYS.events, id, {
        title: String(title || "").trim(),
        when: String(when || "").trim(),
        where: String(where || "").trim(),
        body: String(body || "").trim(),
      });
    },
    async getDonations() {
      return listGet(KEYS.donations);
    },
    async addDonation({ name, amount, note }) {
      return listAdd(KEYS.donations, {
        name: String(name || "Anonymous").trim() || "Anonymous",
        amount: String(amount || "").trim(),
        note: String(note || "").trim(),
      });
    },
    async deleteDonation(id) {
      listDelete(KEYS.donations, id);
    },
    async updateDonation({ id, name, amount, note }) {
      return listPatch(KEYS.donations, id, {
        name: String(name || "Anonymous").trim() || "Anonymous",
        amount: String(amount || "").trim(),
        note: String(note || "").trim(),
      });
    },
    async getJoins() {
      return listGet(KEYS.joins);
    },
    async addJoin({ name, email, cause, note }) {
      return listAdd(KEYS.joins, {
        name: String(name || "Anonymous").trim() || "Anonymous",
        email: String(email || "").trim(),
        cause: String(cause || "").trim(),
        note: String(note || "").trim(),
      });
    },
    async deleteJoin(id) {
      listDelete(KEYS.joins, id);
    },
    async getProfiles() {
      return listGet(KEYS.profiles);
    },
    async getOwnProfile(userId) {
      if (!userId) return null;
      return read(KEYS.profiles, []).find((p) => p.id === userId) || null;
    },
    async upsertProfile({ id, email, town, dateOfBirth, under18 }) {
      const emailNorm = String(email || "").trim();
      if (!emailNorm) return null;
      const list = read(KEYS.profiles, []);
      const emailKey = emailNorm.toLowerCase();
      const existing =
        (id && list.find((p) => p.id === id)) ||
        list.find((p) => String(p.email || "").toLowerCase() === emailKey);
      const townVal = town !== undefined ? String(town || "").trim() : "";
      const dobVal = dateOfBirth !== undefined ? normalizeDob(dateOfBirth) : "";
      const underVal = under18 !== undefined ? parseUnder18Flag(under18) : null;
      if (existing) {
        existing.email = emailNorm;
        if (id) existing.id = id;
        if (town !== undefined) existing.town = townVal;
        if (dateOfBirth !== undefined) existing.dateOfBirth = dobVal;
        if (under18 !== undefined) existing.under18 = underVal;
        write(KEYS.profiles, list);
        return existing;
      }
      const row = {
        id: id || uid(),
        email: emailNorm,
        town: townVal,
        dateOfBirth: dobVal,
        under18: underVal,
        createdAt: new Date().toISOString(),
      };
      list.push(row);
      write(KEYS.profiles, list);
      return row;
    },
    async deleteProfile(id) {
      listDelete(KEYS.profiles, id);
    },
    async getPolls() {
      return listGet(KEYS.polls);
    },
    async getActivePolls() {
      return (await localStore.getPolls()).filter((p) => p.active);
    },
    async createPoll({ question, options }) {
      return listAdd(KEYS.polls, {
        question: question.trim(),
        options: options
          .map((label) => String(label).trim())
          .filter(Boolean)
          .map((label) => ({ id: uid(), label })),
        active: true,
      });
    },
    async setPollActive(id, active) {
      write(
        KEYS.polls,
        read(KEYS.polls, []).map((p) => (p.id === id ? { ...p, active } : p))
      );
    },
    async deletePoll(id) {
      listDelete(KEYS.polls, id);
      const votes = read(KEYS.votes, {});
      delete votes[id];
      write(KEYS.votes, votes);
    },
    async getVotes(pollId) {
      return read(KEYS.votes, {})[pollId] || {};
    },
    async hasVoted(pollId) {
      return false;
    },
    async castVote(pollId, optionId) {
      if (await localStore.hasVoted(pollId)) return { ok: false, reason: "already" };
      const poll = (await localStore.getPolls()).find((p) => p.id === pollId);
      if (!poll || !poll.active) return { ok: false, reason: "closed" };
      if (!poll.options.some((o) => o.id === optionId)) {
        return { ok: false, reason: "invalid" };
      }
      const all = read(KEYS.votes, {});
      const tally = all[pollId] || {};
      tally[optionId] = (tally[optionId] || 0) + 1;
      all[pollId] = tally;
      write(KEYS.votes, all);
      localStorage.setItem("byc_voted_" + pollId, optionId);
      return { ok: true, tally };
    },
    async voteTotals(pollId) {
      const tally = await localStore.getVotes(pollId);
      const total = Object.values(tally).reduce((a, n) => a + n, 0);
      return { tally, total };
    },
  };

  const supabaseStore = {
    async getSuggestions() {
      const { data, error } = await sb
        .from("issues")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(mapIssue);
    },
    async addSuggestion({ name, email, area, topic, message }) {
      const { data, error } = await sb
        .from("issues")
        .insert({
          name: (name || "Anonymous").trim() || "Anonymous",
          email: (email || "").trim(),
          area: (area || "").trim(),
          topic: (topic || "General").trim(),
          message: (message || "").trim(),
          status: "new",
        })
        .select()
        .single();
      if (error) throw error;
      return mapIssue(data);
    },
    async updateSuggestionStatus(id, status) {
      const { error } = await sb.from("issues").update({ status }).eq("id", id);
      if (error) throw error;
    },
    async deleteSuggestion(id) {
      const { error } = await sb.from("issues").delete().eq("id", id);
      if (error) throw error;
    },
    async getUpdates() {
      const { data, error } = await sb
        .from("updates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(mapUpdate);
    },
    async addUpdate({ title, body }) {
      const { data, error } = await sb
        .from("updates")
        .insert({ title: String(title || "").trim(), body: String(body || "").trim() })
        .select()
        .single();
      if (error) throw error;
      return mapUpdate(data);
    },
    async deleteUpdate(id) {
      const { error } = await sb.from("updates").delete().eq("id", id);
      if (error) throw error;
    },
    async updateUpdate({ id, title, body }) {
      const { data, error } = await sb
        .from("updates")
        .update({
          title: String(title || "").trim(),
          body: String(body || "").trim(),
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return mapUpdate(data);
    },
    async getEvents() {
      const { data, error } = await sb
        .from("events")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(mapEvent);
    },
    async addEvent({ title, when, where, body }) {
      const { data, error } = await sb
        .from("events")
        .insert({
          title: String(title || "").trim(),
          event_when: String(when || "").trim(),
          event_where: String(where || "").trim(),
          body: String(body || "").trim(),
        })
        .select()
        .single();
      if (error) throw error;
      return mapEvent(data);
    },
    async deleteEvent(id) {
      const { error } = await sb.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    async updateEvent({ id, title, when, where, body }) {
      const { data, error } = await sb
        .from("events")
        .update({
          title: String(title || "").trim(),
          event_when: String(when || "").trim(),
          event_where: String(where || "").trim(),
          body: String(body || "").trim(),
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return mapEvent(data);
    },
    async getDonations() {
      const { data, error } = await sb
        .from("donations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(mapDonation);
    },
    async addDonation({ name, amount, note }) {
      const { data, error } = await sb
        .from("donations")
        .insert({
          name: String(name || "Anonymous").trim() || "Anonymous",
          amount: String(amount || "").trim(),
          note: String(note || "").trim(),
        })
        .select()
        .single();
      if (error) throw error;
      return mapDonation(data);
    },
    async deleteDonation(id) {
      const { error } = await sb.from("donations").delete().eq("id", id);
      if (error) throw error;
    },
    async updateDonation({ id, name, amount, note }) {
      const { data, error } = await sb
        .from("donations")
        .update({
          name: String(name || "Anonymous").trim() || "Anonymous",
          amount: String(amount || "").trim(),
          note: String(note || "").trim(),
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return mapDonation(data);
    },
    async getJoins() {
      const { data, error } = await sb
        .from("joins")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(mapJoin);
    },
    async addJoin({ name, email, cause, note }) {
      const { data, error } = await sb
        .from("joins")
        .insert({
          name: String(name || "Anonymous").trim() || "Anonymous",
          email: String(email || "").trim(),
          cause: String(cause || "").trim(),
          note: String(note || "").trim(),
        })
        .select()
        .single();
      if (error) throw error;
      return mapJoin(data);
    },
    async deleteJoin(id) {
      const { error } = await sb.from("joins").delete().eq("id", id);
      if (error) throw error;
    },
    async getProfiles() {
      let query = await sb
        .from("profiles_directory")
        .select("id, email, town, created_at")
        .order("created_at", { ascending: false });
      if (query.error) {
        query = await sb
          .from("profiles")
          .select("id, email, town, created_at")
          .order("created_at", { ascending: false });
      }
      if (query.error) throw query.error;
      return (query.data || []).map(mapProfile);
    },
    async getOwnProfile() {
      const user = await supabaseStore.getUser();
      if (!user) return null;
      let query = await sb
        .from("profiles")
        .select("id, email, town, date_of_birth, under_18, created_at")
        .eq("id", user.id)
        .maybeSingle();
      if (query.error) {
        query = await sb
          .from("profiles")
          .select("id, email, town, date_of_birth, created_at")
          .eq("id", user.id)
          .maybeSingle();
      }
      if (query.error) throw query.error;
      return query.data ? mapProfile(query.data) : null;
    },
    async upsertProfile({ id, email, town, dateOfBirth, under18 }) {
      const emailNorm = String(email || "").trim();
      if (!emailNorm) return null;
      let profileId = id;
      if (!profileId) {
        const user = await supabaseStore.getUser();
        if (user) profileId = user.id;
      }
      if (!profileId) return null;
      const row = { id: profileId, email: emailNorm };
      if (town !== undefined) {
        const t = String(town || "").trim();
        row.town = t && isBuryTown(t) ? t : null;
      }
      if (dateOfBirth !== undefined) {
        row.date_of_birth = normalizeDob(dateOfBirth) || null;
      }
      if (under18 !== undefined) {
        row.under_18 = parseUnder18Flag(under18);
      }
      const { data, error } = await sb.from("profiles").upsert(row).select().single();
      if (error) throw error;
      return mapProfile(data);
    },
    async deleteProfile(id) {
      const { error } = await sb.from("profiles").delete().eq("id", id);
      if (error) throw error;
    },
    async getPolls() {
      const { data, error } = await sb
        .from("polls")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(mapPoll);
    },
    async getActivePolls() {
      return (await supabaseStore.getPolls()).filter((p) => p.active);
    },
    async createPoll({ question, options }) {
      const opts = options
        .map((label) => String(label).trim())
        .filter(Boolean)
        .map((label) => ({ id: uid(), label }));
      const { data, error } = await sb
        .from("polls")
        .insert({ question: question.trim(), options: opts, active: true })
        .select()
        .single();
      if (error) throw error;
      return mapPoll(data);
    },
    async setPollActive(id, active) {
      const { error } = await sb.from("polls").update({ active }).eq("id", id);
      if (error) throw error;
    },
    async deletePoll(id) {
      const { error } = await sb.from("polls").delete().eq("id", id);
      if (error) throw error;
    },
    async getVotes(pollId) {
      const { data, error } = await sb.from("votes").select("option_id").eq("poll_id", pollId);
      if (error) throw error;
      const tally = {};
      (data || []).forEach((v) => {
        tally[v.option_id] = (tally[v.option_id] || 0) + 1;
      });
      return tally;
    },
    async getUser() {
      const { data } = await sb.auth.getSession();
      return data.session ? data.session.user : null;
    },
    async hasVoted(pollId) {
      const user = await supabaseStore.getUser();
      if (!user) return false;
      const { data, error } = await sb
        .from("votes")
        .select("id")
        .eq("poll_id", pollId)
        .eq("voter_key", user.id)
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    async voteTotals(pollId) {
      const tally = await supabaseStore.getVotes(pollId);
      const total = Object.values(tally).reduce((a, n) => a + n, 0);
      return { tally, total };
    },
  };

  const data = useSupabase ? supabaseStore : localStore;

  const store = {
    usingSupabase: useSupabase,

    isAdmin() {
      return sessionStorage.getItem(KEYS.session) === "1";
    },
    login(password) {
      if (password === ADMIN_PASSWORD) {
        sessionStorage.setItem(KEYS.session, "1");
        return true;
      }
      return false;
    },
    logout() {
      sessionStorage.removeItem(KEYS.session);
    },

    async getUser() {
      if (!sb) return null;
      const { data } = await sb.auth.getSession();
      return data.session ? data.session.user : null;
    },
    async getAccessToken() {
      if (!sb) return null;
      const { data } = await sb.auth.getSession();
      return data.session && data.session.access_token
        ? data.session.access_token
        : null;
    },
    async getOwnProfile() {
      if (useSupabase && supabaseStore.getOwnProfile) {
        return supabaseStore.getOwnProfile();
      }
      return null;
    },
    async getVoteEligibility() {
      const base = apiBase();
      if (!base) return { configured: false, eligible: false, reason: "unavailable" };
      const token = await store.getAccessToken();
      if (!token) return { configured: true, eligible: false, reason: "login" };
      try {
        const res = await fetch(base + "/vote-eligibility", {
          headers: { Authorization: "Bearer " + token },
        });
        const body = await res.json().catch(function () {
          return {};
        });
        if (res.status === 401) {
          return { configured: true, eligible: false, reason: "login" };
        }
        if (!res.ok) {
          return {
            configured: true,
            eligible: false,
            reason: body.error || "unavailable",
          };
        }
        return {
          configured: true,
          eligible: Boolean(body.eligible),
          reason: body.reason || "",
        };
      } catch (e) {
        return { configured: true, eligible: false, reason: "unavailable" };
      }
    },
    towns: BURY_TOWNS.slice(),
    isBuryTown: isBuryTown,
    ageFromDob: ageFromDob,
    eligibilityFromProfile: eligibilityFromProfile,
    apiBase: apiBase,
    async signIn(email, password) {
      if (!sb) return { error: { message: "Accounts aren't ready yet." } };
      const emailNorm = String(email || "").trim();
      if (!emailNorm || !password) {
        return { error: { message: "Enter your email and password." } };
      }
      return sb.auth.signInWithPassword({ email: emailNorm, password });
    },
    async signUp(email, password, extra) {
      if (!sb) return { error: { message: "Accounts aren't ready yet." } };
      const emailNorm = String(email || "").trim();
      if (!emailNorm || !password) {
        return { error: { message: "Enter your email and password." } };
      }
      const meta = {};
      if (extra && extra.town) meta.town = String(extra.town).trim();
      if (extra && extra.under18 !== undefined) {
        const flag = parseUnder18Flag(extra.under18);
        if (flag != null) meta.under_18 = flag;
      }
      return sb.auth.signUp({
        email: emailNorm,
        password,
        options: {
          emailRedirectTo: loginRedirectUrl(),
          data: meta,
        },
      });
    },
    async signOut() {
      if (!sb) return;
      return sb.auth.signOut();
    },
    onAuthChange(fn) {
      if (!sb) return { data: { subscription: { unsubscribe: function () {} } } };
      return sb.auth.onAuthStateChange(function (event, session) {
        fn(event, session);
      });
    },

    getSuggestions: (...a) => data.getSuggestions(...a),
    addSuggestion: (...a) => data.addSuggestion(...a),
    updateSuggestionStatus: (...a) => data.updateSuggestionStatus(...a),
    deleteSuggestion: (...a) => data.deleteSuggestion(...a),
    getUpdates: (...a) => data.getUpdates(...a),
    addUpdate: (...a) => data.addUpdate(...a),
    updateUpdate: (...a) => data.updateUpdate(...a),
    deleteUpdate: (...a) => data.deleteUpdate(...a),
    getEvents: (...a) => data.getEvents(...a),
    addEvent: (...a) => data.addEvent(...a),
    updateEvent: (...a) => data.updateEvent(...a),
    deleteEvent: (...a) => data.deleteEvent(...a),
    getDonations: (...a) => data.getDonations(...a),
    addDonation: (...a) => data.addDonation(...a),
    updateDonation: (...a) => data.updateDonation(...a),
    deleteDonation: (...a) => data.deleteDonation(...a),
    getJoins: (...a) => data.getJoins(...a),
    addJoin: (...a) => data.addJoin(...a),
    deleteJoin: (...a) => data.deleteJoin(...a),
    getProfiles: (...a) => data.getProfiles(...a),
    upsertProfile: (...a) => data.upsertProfile(...a),
    deleteProfile: (...a) => data.deleteProfile(...a),
    getPolls: (...a) => data.getPolls(...a),
    getActivePolls: (...a) => data.getActivePolls(...a),
    createPoll: (...a) => data.createPoll(...a),
    setPollActive: (...a) => data.setPollActive(...a),
    deletePoll: (...a) => data.deletePoll(...a),
    getVotes: (...a) => data.getVotes(...a),
    hasVoted: (...a) =>
      data.hasVoted(...a).catch(function () {
        return false;
      }),
    async castVote(pollId, optionId) {
      const url = voteUrl();
      if (!url) return { ok: false, reason: "unavailable" };
      const token = await store.getAccessToken();
      if (!token) return { ok: false, reason: "login" };
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify({ pollId: pollId, optionId: optionId }),
        });
        const body = await res.json().catch(function () {
          return {};
        });
        if (!res.ok) {
          const err = String(body.error || "");
          if (res.status === 401) return { ok: false, reason: "login" };
          if (err === "ineligible") return { ok: false, reason: "ineligible" };
          if (err === "already") return { ok: false, reason: "already" };
          if (err === "closed") return { ok: false, reason: "closed" };
          if (err === "invalid" || err === "bad_request") {
            return { ok: false, reason: "invalid" };
          }
          return { ok: false, reason: "unavailable" };
        }
        return { ok: true, tally: body.tally || {} };
      } catch (e) {
        return { ok: false, reason: "unavailable" };
      }
    },
    voteTotals: (...a) => data.voteTotals(...a),
  };

  global.BYC = store;
})(window);
