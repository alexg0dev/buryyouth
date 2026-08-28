(function () {
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function whenReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  whenReady(function () {
    window.BYC_READY.then(function () {
      if (!window.BYC) return;

    const form = document.getElementById("suggestion-form");
    const statusEl = document.getElementById("form-status");

    if (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        const data = new FormData(form);
        if (!data.get("area") || !data.get("topic")) return;
        await BYC.addSuggestion({
          name: data.get("name"),
          email: data.get("email"),
          area: data.get("area"),
          topic: data.get("topic"),
          message: data.get("message"),
        });
        form.reset();
        statusEl.hidden = false;
        statusEl.textContent = "Got it. Thanks.";
        setTimeout(function () {
          statusEl.hidden = true;
        }, 3500);
      });
    }

    const joinForm = document.getElementById("join-form");
    const joinStatus = document.getElementById("join-status");
    if (joinForm) {
      joinForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const data = new FormData(joinForm);
        await BYC.addJoin({
          name: data.get("name"),
          email: data.get("email"),
          cause: data.get("cause"),
          note: data.get("note"),
        });
        joinForm.reset();
        joinStatus.hidden = false;
        joinStatus.textContent = "Thanks. I'll be in touch.";
        setTimeout(function () {
          joinStatus.hidden = true;
        }, 4000);
      });
    }

    async function renderPolls() {
      const pollsList = document.getElementById("polls-list");
      const pollsEmpty = document.getElementById("polls-empty");
      if (!pollsList) return;

      const polls = await BYC.getActivePolls();
      pollsList.innerHTML = "";
      if (pollsEmpty) pollsEmpty.hidden = polls.length > 0;

      const user = BYC.usingSupabase ? await BYC.getUser() : null;
      const needLogin = !user;
      const loginHint = document.getElementById("polls-login-hint");
      const ineligibleHint = document.getElementById("polls-ineligible");
      const statusEl = document.getElementById("polls-status");

      let elig = { configured: false, eligible: false, reason: "unavailable" };
      if (user && BYC.getVoteEligibility) {
        try {
          elig = await BYC.getVoteEligibility();
        } catch (e) {
          elig = { configured: false, eligible: false, reason: "unavailable" };
        }
      }
      const canVote = Boolean(user && elig.configured && elig.eligible);
      const showIneligible = Boolean(
        user &&
          elig.configured &&
          !elig.eligible &&
          (elig.reason === "ineligible" || elig.reason === "incomplete")
      );

      if (loginHint) loginHint.hidden = !needLogin;
      if (ineligibleHint) ineligibleHint.hidden = !showIneligible;

      for (const poll of polls) {
        const { tally, total } = await BYC.voteTotals(poll.id);
        const voted = user
          ? await BYC.hasVoted(poll.id).catch(function () {
              return false;
            })
          : false;
        const el = document.createElement("div");
        el.className = "poll";
        let body = "";
        poll.options.forEach(function (opt) {
          const count = tally[opt.id] || 0;
          const pct = total ? Math.round((count / total) * 100) : 0;
          if (voted) {
            body +=
              '<div class="row"><span>' +
              esc(opt.label) +
              "</span><span>" +
              pct +
              "%</span></div>" +
              '<div class="track"><b style="width:' +
              pct +
              '%"></b></div>';
          } else if (!canVote) {
            body += '<p class="poll-opt">' + esc(opt.label) + "</p>";
          } else {
            body +=
              '<button type="button" class="vote" data-p="' +
              esc(poll.id) +
              '" data-o="' +
              esc(opt.id) +
              '">' +
              esc(opt.label) +
              "</button>";
          }
        });
        var meta = total === 1 ? "1 vote so far" : total + " votes so far";
        if (voted) meta = "You voted · " + meta;
        el.innerHTML =
          "<h3>" +
          esc(poll.question) +
          "</h3><p class=\"poll-meta\">" +
          esc(meta) +
          "</p>" +
          body;
        pollsList.appendChild(el);
      }

      pollsList.querySelectorAll(".vote").forEach(function (btn) {
        btn.addEventListener("click", async function () {
          btn.disabled = true;
          const result = await BYC.castVote(btn.dataset.p, btn.dataset.o);
          if (result.ok) {
            if (statusEl) statusEl.hidden = true;
            renderPolls();
            return;
          }
          btn.disabled = false;
          if (result.reason === "login") {
            window.location.href = "login.html";
            return;
          }
          if (result.reason === "ineligible") {
            if (ineligibleHint) ineligibleHint.hidden = false;
            if (statusEl) {
              statusEl.hidden = false;
              statusEl.textContent = "Polls are for under-18s in Bury.";
              statusEl.className = "status status-err";
            }
            return;
          }
          if (result.reason === "already") {
            renderPolls();
            return;
          }
          if (statusEl) {
            statusEl.hidden = false;
            statusEl.textContent =
              result.reason === "closed" ? "This poll is closed." : "Couldn't vote. Try again.";
            statusEl.className = "status status-err";
          }
        });
      });
    }

    async function boot() {
      await renderPolls();
      if (BYC.onAuthChange) {
        BYC.onAuthChange(function () {
          renderPolls();
        });
      }
    }

    if ("requestIdleCallback" in window) {
      requestIdleCallback(function () {
        boot();
      });
    } else {
      setTimeout(boot, 0);
    }
    });
  });
})();
