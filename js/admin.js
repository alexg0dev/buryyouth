(function () {
  const TABS = [
    "overview",
    "issues",
    "contacts",
    "donations",
    "campaigns",
    "updates",
    "events",
    "polls",
  ];

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function when(iso) {
    try {
      return new Date(iso).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return iso || "";
    }
  }

  function mailto(email) {
    const e = String(email || "").trim();
    if (!e) return '<span class="meta">No email</span>';
    if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(e)) {
      return '<span class="meta">' + esc(e) + "</span>";
    }
    return '<a href="mailto:' + encodeURIComponent(e) + '">' + esc(e) + "</a>";
  }

  function empty(text) {
    return '<p class="empty">' + esc(text || "None yet.") + "</p>";
  }

  function compileContacts(profiles, issues, joins) {
    const map = new Map();

    function add(email, name, source, createdAt, extra) {
      const raw = String(email || "").trim();
      if (!raw) return;
      const key = raw.toLowerCase();
      let row = map.get(key);
      if (!row) {
        row = {
          email: raw,
          name: "",
          sources: [],
          createdAt: createdAt,
          profileId: null,
        };
        map.set(key, row);
      }
      if (name && name !== "Anonymous" && !row.name) row.name = name;
      if (!row.sources.includes(source)) row.sources.push(source);
      if (extra && extra.profileId) row.profileId = extra.profileId;
      if (extra && extra.town && !row.town) row.town = extra.town;
      if (createdAt && (!row.createdAt || new Date(createdAt) < new Date(row.createdAt))) {
        row.createdAt = createdAt;
      }
    }

    (profiles || []).forEach(function (p) {
      add(p.email, "", "Account", p.createdAt, { profileId: p.id, town: p.town });
    });
    (issues || []).forEach(function (s) {
      add(s.email, s.name, "Issue", s.createdAt);
    });
    (joins || []).forEach(function (j) {
      add(j.email, j.name, "Campaign", j.createdAt);
    });

    return Array.from(map.values()).sort(function (a, b) {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }

  async function safe(fn, fallback) {
    try {
      return await fn();
    } catch (err) {
      console.warn(err);
      return fallback;
    }
  }

  function statusLabel(status) {
    if (status === "forwarded") return "for council";
    return status || "new";
  }

  function whenReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  whenReady(function () {
    window.BYC_READY.then(boot);
  });

  async function boot() {
    if (!window.BYC) return;

    const loginView = document.getElementById("login-view");
    const dashView = document.getElementById("dash-view");
    const optionFields = document.getElementById("option-fields");

    function showDash() {
      loginView.hidden = true;
      dashView.hidden = false;
      const hash = (location.hash || "").replace("#", "");
      setTab(TABS.indexOf(hash) >= 0 ? hash : "overview", true);
      refresh();
    }

    function showLogin() {
      dashView.hidden = true;
      loginView.hidden = false;
    }

    function setTab(id, skipHash) {
      TABS.forEach(function (tab) {
        const panel = document.getElementById("panel-" + tab);
        const btn = document.querySelector('.admin-tab[data-tab="' + tab + '"]');
        const on = tab === id;
        if (panel) panel.hidden = !on;
        if (btn) {
          btn.classList.toggle("is-active", on);
          btn.setAttribute("aria-selected", on ? "true" : "false");
        }
      });
      if (!skipHash) {
        history.replaceState(null, "", "#" + id);
      }
    }

    if (BYC.isAdmin()) showDash();
    else showLogin();

    document.getElementById("login-form").addEventListener("submit", function (e) {
      e.preventDefault();
      const err = document.getElementById("login-error");
      if (BYC.login(document.getElementById("password").value)) {
        err.hidden = true;
        showDash();
      } else {
        err.hidden = false;
      }
    });

    document.getElementById("logout-btn").addEventListener("click", function () {
      BYC.logout();
      showLogin();
    });

    document.querySelectorAll("[data-tab]").forEach(function (el) {
      el.addEventListener("click", function () {
        const tab = el.getAttribute("data-tab");
        if (TABS.indexOf(tab) >= 0) setTab(tab);
      });
    });

    document.getElementById("add-option").addEventListener("click", function () {
      const n = optionFields.querySelectorAll("input").length + 1;
      const input = document.createElement("input");
      input.name = "option";
      input.placeholder = "Option " + n;
      input.setAttribute("aria-label", "Option " + n);
      optionFields.appendChild(input);
    });

    function bindForm(id, handler) {
      document.getElementById(id).addEventListener("submit", async function (e) {
        e.preventDefault();
        await handler(new FormData(e.target));
        e.target.reset();
        refresh();
      });
    }

    bindForm("donation-form", function (d) {
      return BYC.addDonation({
        name: d.get("name"),
        amount: d.get("amount"),
        note: d.get("note"),
      });
    });
    bindForm("update-form", function (d) {
      return BYC.addUpdate({ title: d.get("title"), body: d.get("body") });
    });
    bindForm("event-form", function (d) {
      return BYC.addEvent({
        title: d.get("title"),
        when: d.get("when"),
        where: d.get("where"),
        body: d.get("body"),
      });
    });

    document.getElementById("poll-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      const data = new FormData(e.target);
      const options = data.getAll("option");
      if (options.filter(function (o) {
        return String(o).trim();
      }).length < 2) return;
      await BYC.createPoll({ question: data.get("question"), options: options });
      e.target.reset();
      optionFields.innerHTML =
        '<input name="option" required placeholder="Option 1" aria-label="Option 1" />' +
        '<input name="option" required placeholder="Option 2" aria-label="Option 2" />';
      refresh();
    });

    dashView.addEventListener("submit", async function (e) {
      const form = e.target;
      if (!form.classList || !form.classList.contains("js-edit")) return;
      e.preventDefault();
      const id = form.getAttribute("data-id");
      const kind = form.getAttribute("data-kind");
      const data = new FormData(form);
      if (kind === "donation") {
        await BYC.updateDonation({
          id: id,
          name: data.get("name"),
          amount: data.get("amount"),
          note: data.get("note"),
        });
      } else if (kind === "update") {
        await BYC.updateUpdate({
          id: id,
          title: data.get("title"),
          body: data.get("body"),
        });
      } else if (kind === "event") {
        await BYC.updateEvent({
          id: id,
          title: data.get("title"),
          when: data.get("when"),
          where: data.get("where"),
          body: data.get("body"),
        });
      }
      refresh();
    });

    dashView.addEventListener("click", async function (e) {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const act = btn.getAttribute("data-act");
      const id = btn.getAttribute("data-id");

      if (act === "del-issue") {
        if (!confirm("Delete this issue?")) return;
        await BYC.deleteSuggestion(id);
      } else if (act === "status") {
        await BYC.updateSuggestionStatus(id, btn.getAttribute("data-v"));
      } else if (act === "del-donation") {
        if (!confirm("Delete this donation?")) return;
        await BYC.deleteDonation(id);
      } else if (act === "del-join") {
        if (!confirm("Delete this sign-up?")) return;
        await BYC.deleteJoin(id);
      } else if (act === "del-update") {
        if (!confirm("Delete this update?")) return;
        await BYC.deleteUpdate(id);
      } else if (act === "del-event") {
        if (!confirm("Delete this event?")) return;
        await BYC.deleteEvent(id);
      } else if (act === "del-profile") {
        if (!confirm("Remove this account email?")) return;
        await BYC.deleteProfile(id);
      } else if (act === "toggle-poll") {
        await BYC.setPollActive(id, btn.getAttribute("data-on") !== "true");
      } else if (act === "del-poll") {
        if (!confirm("Delete this poll?")) return;
        await BYC.deletePoll(id);
      } else {
        return;
      }
      refresh();
    });

    async function refresh() {
      const issues = await safe(function () {
        return BYC.getSuggestions();
      }, []);
      const profiles = await safe(function () {
        return BYC.getProfiles();
      }, []);
      const donations = await safe(function () {
        return BYC.getDonations();
      }, []);
      const joins = await safe(function () {
        return BYC.getJoins();
      }, []);
      const updates = await safe(function () {
        return BYC.getUpdates();
      }, []);
      const events = await safe(function () {
        return BYC.getEvents();
      }, []);
      const polls = await safe(function () {
        return BYC.getPolls();
      }, []);
      const contacts = compileContacts(profiles, issues, joins);

      let votes = 0;
      const pollStats = [];
      for (let i = 0; i < polls.length; i++) {
        const totals = await safe(function () {
          return BYC.voteTotals(polls[i].id);
        }, { tally: {}, total: 0 });
        votes += totals.total || 0;
        pollStats.push(totals);
      }

      document.getElementById("stat-issues").textContent = issues.length;
      document.getElementById("stat-contacts").textContent = contacts.length;
      document.getElementById("stat-donations").textContent = donations.length;
      document.getElementById("stat-joins").textContent = joins.length;
      document.getElementById("stat-updates").textContent = updates.length;
      document.getElementById("stat-events").textContent = events.length;
      document.getElementById("stat-polls").textContent = polls.filter(function (p) {
        return p.active;
      }).length;
      document.getElementById("stat-votes").textContent = votes;

      document.getElementById("overview-issues").innerHTML = issues.length
        ? issues
            .slice(0, 4)
            .map(function (s) {
              return (
                '<article class="card"><h3>' +
                esc(s.topic || "Issue") +
                "</h3><p class=\"meta\">" +
                esc(s.area || "Bury") +
                " · " +
                when(s.createdAt) +
                " · " +
                esc(statusLabel(s.status)) +
                "</p><p class=\"admin-msg\">" +
                esc(s.message) +
                "</p></article>"
              );
            })
            .join("")
        : empty("No issues yet.");

      document.getElementById("overview-donations").innerHTML = donations.length
        ? donations
            .slice(0, 4)
            .map(function (d) {
              return (
                '<article class="card"><h3>' +
                esc(d.name) +
                " · " +
                esc(d.amount) +
                "</h3>" +
                (d.note ? "<p>" + esc(d.note) + "</p>" : "") +
                "</article>"
              );
            })
            .join("")
        : empty("No donations listed.");

      document.getElementById("admin-issues").innerHTML = issues.length
        ? issues
            .map(function (s) {
              return (
                '<article class="card">' +
                "<h3>" +
                esc(s.name || "Anonymous") +
                "</h3>" +
                '<p class="meta">' +
                esc(s.topic || "General") +
                " · " +
                esc(s.area || "—") +
                " · " +
                when(s.createdAt) +
                " · " +
                esc(statusLabel(s.status)) +
                "</p>" +
                '<p class="meta">' +
                mailto(s.email) +
                "</p>" +
                '<p class="admin-msg">' +
                esc(s.message) +
                "</p>" +
                '<div class="admin-actions">' +
                '<button type="button" class="btn-ghost" data-act="status" data-id="' +
                esc(s.id) +
                '" data-v="reviewed">Reviewed</button>' +
                '<button type="button" class="admin-save" data-act="status" data-id="' +
                esc(s.id) +
                '" data-v="forwarded">For council</button>' +
                '<button type="button" class="btn-bad" data-act="del-issue" data-id="' +
                esc(s.id) +
                '">Delete</button>' +
                "</div></article>"
              );
            })
            .join("")
        : empty("None yet.");

      document.getElementById("admin-contacts").innerHTML = contacts.length
        ? contacts
            .map(function (c) {
              const tags = c.sources
                .map(function (src) {
                  return '<span class="admin-tag">' + esc(src) + "</span>";
                })
                .join("");
              const del = c.profileId
                ? '<div class="admin-actions"><button type="button" class="btn-bad" data-act="del-profile" data-id="' +
                  esc(c.profileId) +
                  '">Remove account</button></div>'
                : "";
              return (
                '<article class="card">' +
                "<h3>" +
                mailto(c.email) +
                "</h3>" +
                (c.name ? "<p>" + esc(c.name) + "</p>" : "") +
                '<p class="meta">' +
                (c.town ? esc(c.town) + " · " : "") +
                tags +
                (c.createdAt ? " · " + when(c.createdAt) : "") +
                "</p>" +
                del +
                "</article>"
              );
            })
            .join("")
        : empty("No emails yet.");

      document.getElementById("admin-donations").innerHTML = donations.length
        ? donations
            .map(function (d) {
              return (
                '<article class="card">' +
                '<form class="admin-edit js-edit" data-kind="donation" data-id="' +
                esc(d.id) +
                '">' +
                "<label>Name <input name=\"name\" value=\"" +
                esc(d.name) +
                '" /></label>' +
                "<label>Amount <input name=\"amount\" required value=\"" +
                esc(d.amount) +
                '" /></label>' +
                "<label>Note <input name=\"note\" value=\"" +
                esc(d.note || "") +
                '" /></label>' +
                '<p class="meta">' +
                when(d.createdAt) +
                "</p>" +
                '<div class="admin-actions">' +
                '<button type="submit" class="admin-save">Save</button>' +
                '<button type="button" class="btn-bad" data-act="del-donation" data-id="' +
                esc(d.id) +
                '">Delete</button>' +
                "</div></form></article>"
              );
            })
            .join("")
        : empty("None yet.");

      document.getElementById("admin-joins").innerHTML = joins.length
        ? joins
            .map(function (j) {
              return (
                '<article class="card">' +
                "<h3>" +
                esc(j.name || "Anonymous") +
                "</h3>" +
                '<p class="meta">' +
                esc(j.cause || "—") +
                " · " +
                when(j.createdAt) +
                "</p>" +
                '<p class="meta">' +
                mailto(j.email) +
                "</p>" +
                (j.note ? '<p class="admin-msg">' + esc(j.note) + "</p>" : "") +
                '<div class="admin-actions">' +
                '<button type="button" class="btn-bad" data-act="del-join" data-id="' +
                esc(j.id) +
                '">Delete</button>' +
                "</div></article>"
              );
            })
            .join("")
        : empty("None yet.");

      document.getElementById("admin-updates").innerHTML = updates.length
        ? updates
            .map(function (u) {
              return (
                '<article class="card">' +
                '<form class="admin-edit js-edit" data-kind="update" data-id="' +
                esc(u.id) +
                '">' +
                "<label>Title <input name=\"title\" required value=\"" +
                esc(u.title) +
                '" /></label>' +
                "<label>Details <textarea name=\"body\" required rows=\"3\">" +
                esc(u.body) +
                "</textarea></label>" +
                '<p class="meta">' +
                when(u.createdAt) +
                "</p>" +
                '<div class="admin-actions">' +
                '<button type="submit" class="admin-save">Save</button>' +
                '<button type="button" class="btn-bad" data-act="del-update" data-id="' +
                esc(u.id) +
                '">Delete</button>' +
                "</div></form></article>"
              );
            })
            .join("")
        : empty("None yet.");

      document.getElementById("admin-events").innerHTML = events.length
        ? events
            .map(function (ev) {
              return (
                '<article class="card">' +
                '<form class="admin-edit js-edit" data-kind="event" data-id="' +
                esc(ev.id) +
                '">' +
                "<label>Title <input name=\"title\" required value=\"" +
                esc(ev.title) +
                '" /></label>' +
                "<label>When <input name=\"when\" required value=\"" +
                esc(ev.when || "") +
                '" /></label>' +
                "<label>Where <input name=\"where\" value=\"" +
                esc(ev.where || "") +
                '" /></label>' +
                "<label>Details <textarea name=\"body\" rows=\"2\">" +
                esc(ev.body || "") +
                "</textarea></label>" +
                '<p class="meta">' +
                when(ev.createdAt) +
                "</p>" +
                '<div class="admin-actions">' +
                '<button type="submit" class="admin-save">Save</button>' +
                '<button type="button" class="btn-bad" data-act="del-event" data-id="' +
                esc(ev.id) +
                '">Delete</button>' +
                "</div></form></article>"
              );
            })
            .join("")
        : empty("None yet.");

      const pollCards = polls.map(function (poll, idx) {
        const totals = pollStats[idx] || { tally: {}, total: 0 };
        const rows = (poll.options || [])
          .map(function (o) {
            const c = totals.tally[o.id] || 0;
            const pct = totals.total ? Math.round((c / totals.total) * 100) : 0;
            return (
              "<li><span>" +
              esc(o.label) +
              "</span><span>" +
              c +
              " (" +
              pct +
              "%)</span></li>"
            );
          })
          .join("");
        return (
          '<article class="card">' +
          "<h3>" +
          esc(poll.question) +
          "</h3>" +
          '<p class="meta">' +
          when(poll.createdAt) +
          " · " +
          totals.total +
          " votes · " +
          (poll.active ? "Open" : "Closed") +
          "</p>" +
          '<div class="admin-actions">' +
          '<button type="button" class="btn-ghost" data-act="toggle-poll" data-id="' +
          esc(poll.id) +
          '" data-on="' +
          poll.active +
          '">' +
          (poll.active ? "Close" : "Reopen") +
          "</button>" +
          '<button type="button" class="btn-bad" data-act="del-poll" data-id="' +
          esc(poll.id) +
          '">Delete</button>' +
          "</div>" +
          "<ul class=\"admin-tally\">" +
          rows +
          "</ul></article>"
        );
      });
      document.getElementById("admin-polls").innerHTML = pollCards.join("") || empty("No polls.");
    }
  }
})();
