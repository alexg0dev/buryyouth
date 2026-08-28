(function () {
  function showStatus(el, text, ok) {
    if (!el) return;
    el.hidden = false;
    el.textContent = text;
    el.className = ok ? "status" : "status status-err";
  }

  function friendlyAuthError(err) {
    const raw = String((err && (err.message || err.error_description)) || "");
    const code = String((err && err.code) || "").toLowerCase();
    const msg = (raw + " " + code).toLowerCase();
    if (
      code === "email_not_confirmed" ||
      /email not confirmed|email_not_confirmed|user not confirmed/.test(msg)
    ) {
      return "Confirm your email first.";
    }
    if (/otp_expired|expired|invalid.*(link|token)/.test(msg)) {
      return "That link expired. Try again.";
    }
    if (/invalid login|invalid credentials|wrong password|invalid_credentials/.test(msg)) {
      return "Wrong email or password.";
    }
    if (/already registered|already been registered|user already/.test(msg)) {
      return "That email already has an account.";
    }
    if (/password/.test(msg) && /6|least|weak|short/.test(msg)) {
      return "Use at least 6 characters.";
    }
    if (/rate|too many/.test(msg)) {
      return "Too many tries. Wait a moment.";
    }
    if (/network|fetch|failed to fetch|timeout/.test(msg)) {
      return "Couldn't sign in. Try again.";
    }
    return "Couldn't sign in. Try again.";
  }

  function authConfigured() {
    const cfg = window.BYC_SUPABASE || {};
    return Boolean(cfg.url && cfg.anonKey);
  }

  function updateBilling(signedIn) {
    const panel = document.getElementById("billing-panel");
    const portal = document.getElementById("stripe-portal");
    const url = String((window.BYC_STRIPE || {}).customerPortal || "").trim();
    const show = Boolean(signedIn && url);
    if (portal) {
      if (url) portal.href = url;
      portal.hidden = !show;
    }
    if (panel) panel.hidden = !show;
  }

  function consumeRedirectError(loginStatus) {
    try {
      const hash = String(location.hash || "").replace(/^#/, "");
      const search = String(location.search || "").replace(/^\?/, "");
      const params = new URLSearchParams(hash.includes("=") ? hash : search);
      const desc = params.get("error_description") || params.get("error");
      const code = params.get("error_code") || params.get("error");
      if (!desc && !code) return;
      showStatus(loginStatus, friendlyAuthError({ message: desc || "", code: code }), false);
      if (history.replaceState) {
        history.replaceState(null, "", location.pathname + location.search.replace(/[?&](error|error_code|error_description)=[^&]*/g, "").replace(/^&/, "?"));
      }
    } catch (e) {
      // Ignore malformed redirect params.
    }
  }

  function parseUnder18(value) {
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    return null;
  }

  document.addEventListener("DOMContentLoaded", async function () {
    updateBilling(false);

    const loginForm = document.getElementById("login-form");
    const loginStatus = document.getElementById("login-status");
    const loggedIn = document.getElementById("logged-in");
    const loggedOut = document.getElementById("logged-out");
    const userEmail = document.getElementById("user-email");
    const logoutBtn = document.getElementById("logout-btn");
    const setupNotice = document.getElementById("auth-setup-notice");
    const authTitle = document.getElementById("auth-title");
    const authHint = document.getElementById("auth-hint");
    const authSubmit = document.getElementById("auth-submit");
    const tabLogin = document.getElementById("tab-login");
    const tabSignup = document.getElementById("tab-signup");
    const passwordInput = loginForm && loginForm.querySelector('input[name="password"]');

    const signupExtra = document.getElementById("signup-extra");
    const signupTown = document.getElementById("signup-town");
    const signupAge = document.getElementById("signup-age");
    const profileForm = document.getElementById("profile-form");
    const profileTown = document.getElementById("profile-town");
    const profileAge = document.getElementById("profile-age");
    const profileStatus = document.getElementById("profile-status");
    const voteElig = document.getElementById("vote-elig");

    let mode = "login";
    let authReady = false;

    const PROFILE_DRAFT = "byc_profile_draft";

    function saveProfileDraft(extra) {
      if (!extra) return;
      try {
        sessionStorage.setItem(PROFILE_DRAFT, JSON.stringify(extra));
      } catch (e) {
        // Ignore quota / private mode.
      }
    }

    function readProfileDraft() {
      try {
        const raw = sessionStorage.getItem(PROFILE_DRAFT);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }

    function clearProfileDraft() {
      try {
        sessionStorage.removeItem(PROFILE_DRAFT);
      } catch (e) {
        // Ignore.
      }
    }

    function setSignupFields(on) {
      if (signupExtra) signupExtra.hidden = !on;
      if (signupTown) signupTown.required = on;
      if (signupAge) signupAge.required = on;
    }

    function eligibilityMessage(profile) {
      const check = BYC.eligibilityFromProfile
        ? BYC.eligibilityFromProfile(profile)
        : { eligible: false };
      return check.eligible
        ? "You can vote."
        : "Polls are for under-18s in Bury.";
    }

    function fillProfileForm(profile) {
      if (profileTown) {
        profileTown.value = (profile && profile.town) || "";
      }
      if (profileAge) {
        if (profile && profile.under18 === true) profileAge.value = "true";
        else if (profile && profile.under18 === false) profileAge.value = "false";
        else profileAge.value = "";
      }
      if (voteElig) {
        voteElig.textContent = profile ? eligibilityMessage(profile) : "";
      }
    }

    function profileFieldError(town, under18) {
      if (!BYC.isBuryTown || !BYC.isBuryTown(town)) {
        return "Pick a town in Bury.";
      }
      if (under18 == null) return "Select your age group.";
      return "";
    }

    function setMode(next) {
      mode = next;
      const signingUp = mode === "signup";
      if (authTitle) authTitle.textContent = signingUp ? "Create an account" : "Log in";
      if (authHint) {
        authHint.textContent = signingUp ? "At least 6 characters." : "Email and password.";
      }
      if (authSubmit) authSubmit.textContent = signingUp ? "Create account" : "Log in";
      if (tabLogin) {
        tabLogin.classList.toggle("is-active", !signingUp);
        tabLogin.setAttribute("aria-selected", signingUp ? "false" : "true");
      }
      if (tabSignup) {
        tabSignup.classList.toggle("is-active", signingUp);
        tabSignup.setAttribute("aria-selected", signingUp ? "true" : "false");
      }
      if (passwordInput) {
        passwordInput.autocomplete = signingUp ? "new-password" : "current-password";
      }
      setSignupFields(signingUp);
    }

    if (tabLogin) {
      tabLogin.addEventListener("click", function () {
        setMode("login");
        if (loginStatus) loginStatus.hidden = true;
      });
    }
    if (tabSignup) {
      tabSignup.addEventListener("click", function () {
        setMode("signup");
        if (loginStatus) loginStatus.hidden = true;
      });
    }

    try {
      await window.BYC_READY;
    } catch (e) {
      if (setupNotice) {
        setupNotice.hidden = false;
        setupNotice.textContent = "Couldn't reach accounts. Refresh the page.";
      }
      if (loginForm) {
        loginForm.addEventListener("submit", function (ev) {
          ev.preventDefault();
          showStatus(loginStatus, "Couldn't reach accounts. Refresh the page.", false);
        });
      }
      updateBilling(false);
      return;
    }

    if (!window.BYC || !BYC.usingSupabase) {
      if (setupNotice) {
        setupNotice.hidden = false;
        if (authConfigured()) {
          setupNotice.textContent = "Couldn't reach accounts. Refresh the page.";
        }
      }
      if (loginForm) {
        loginForm.addEventListener("submit", function (e) {
          e.preventDefault();
          showStatus(
            loginStatus,
            authConfigured()
              ? "Couldn't reach accounts. Refresh the page."
              : "Accounts aren't ready yet. You can still send issues without logging in.",
            false
          );
        });
      }
      updateBilling(false);
      return;
    }

    if (setupNotice) setupNotice.hidden = true;
    authReady = true;
    consumeRedirectError(loginStatus);

    async function recordProfile(user, extra) {
      if (!user || !BYC.upsertProfile) return;
      const email = user.email || "";
      if (!email) return;
      const payload = { id: user.id, email: email };
      const draft = extra || readProfileDraft();
      const meta = user.user_metadata || {};
      if (draft) {
        if (draft.town !== undefined) payload.town = draft.town;
        if (draft.under18 !== undefined) payload.under18 = draft.under18;
      } else if (!extra) {
        let existing = null;
        try {
          existing = BYC.getOwnProfile ? await BYC.getOwnProfile() : null;
        } catch (e) {
          existing = null;
        }
        if ((!existing || !existing.town) && meta.town) payload.town = meta.town;
        if (existing == null || existing.under18 == null) {
          const metaUnder = parseUnder18(meta.under_18 != null ? meta.under_18 : meta.under18);
          if (metaUnder != null) payload.under18 = metaUnder;
        }
      }
      try {
        await BYC.upsertProfile(payload);
        if (draft && (draft.town || draft.under18 != null)) clearProfileDraft();
      } catch (err) {
        // Ignore: profile insert needs a confirmed session.
      }
    }

    async function refreshSession() {
      const user = await BYC.getUser();
      if (user) {
        if (loggedIn) loggedIn.hidden = false;
        if (loggedOut) loggedOut.hidden = true;
        if (userEmail) userEmail.textContent = user.email || "";
        updateBilling(true);
        let profile = null;
        try {
          profile = BYC.getOwnProfile ? await BYC.getOwnProfile() : null;
        } catch (err) {
          profile = null;
        }
        fillProfileForm(profile);
      } else {
        if (loggedIn) loggedIn.hidden = true;
        if (loggedOut) loggedOut.hidden = false;
        if (userEmail) userEmail.textContent = "";
        updateBilling(false);
        fillProfileForm(null);
      }
      return user;
    }

    BYC.onAuthChange(async function (event, session) {
      await refreshSession();
      if (
        event &&
        event !== "SIGNED_IN" &&
        event !== "USER_UPDATED" &&
        event !== "INITIAL_SESSION"
      ) {
        return;
      }
      const user = session && session.user;
      if (user) await recordProfile(user);
    });
    const existing = await refreshSession();
    if (existing) await recordProfile(existing);

    if (loginForm) {
      loginForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        if (!authReady) return;
        const data = new FormData(loginForm);
        const email = String(data.get("email") || "").trim();
        const password = String(data.get("password") || "");
        if (!email || !password) return;

        let extra = null;
        if (mode === "signup") {
          const town = String(data.get("town") || "").trim();
          const under18 = parseUnder18(data.get("under_18"));
          const blocked = profileFieldError(town, under18);
          if (blocked) {
            showStatus(loginStatus, blocked, false);
            return;
          }
          extra = { town: town, under18: under18 };
        }

        const result =
          mode === "signup"
            ? await BYC.signUp(email, password, extra)
            : await BYC.signIn(email, password);

        if (result.error) {
          showStatus(loginStatus, friendlyAuthError(result.error), false);
          return;
        }

        const authedUser = result.data && result.data.user;
        const session = result.data && result.data.session;
        const identities = authedUser && authedUser.identities;

        if (mode === "signup" && Array.isArray(identities) && identities.length === 0) {
          showStatus(loginStatus, "That email already has an account.", false);
          setMode("login");
          return;
        }

        if (mode === "signup" && authedUser && !session) {
          saveProfileDraft(extra);
          setMode("login");
          if (authHint) authHint.textContent = "Confirm your email, then log in.";
          showStatus(loginStatus, "Check your email", true);
          return;
        }

        await recordProfile(authedUser, extra);
        loginForm.reset();
        setSignupFields(mode === "signup");
        showStatus(loginStatus, "You're in.", true);
        await refreshSession();
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async function () {
        await BYC.signOut();
        showStatus(loginStatus, "Signed out.", true);
        await refreshSession();
      });
    }

    if (profileForm) {
      profileForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        if (!authReady) return;
        const user = await BYC.getUser();
        if (!user) return;
        const data = new FormData(profileForm);
        const town = String(data.get("town") || "").trim();
        const under18 = parseUnder18(data.get("under_18"));
        const blocked = profileFieldError(town, under18);
        if (blocked) {
          showStatus(profileStatus, blocked, false);
          return;
        }
        try {
          await recordProfile(user, { town: town, under18: under18 });
          const profile = BYC.getOwnProfile
            ? await BYC.getOwnProfile()
            : { town: town, under18: under18 };
          fillProfileForm(profile || { town: town, under18: under18 });
          showStatus(profileStatus, "Saved.", true);
        } catch (err) {
          showStatus(profileStatus, "Couldn't save. Try again.", false);
        }
      });
    }
  });
})();
