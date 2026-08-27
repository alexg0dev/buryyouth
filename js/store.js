/**
 * Shared localStorage store — Save Our Youth
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
  };

  const ADMIN_PASSWORD = "8872";

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

  function seedAll() {
    seedIfEmpty(KEYS.polls, [
      {
        id: uid(),
        question: "What should be prioritised for Bury's youth?",
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

    seedIfEmpty(KEYS.mentions, [
      {
        id: uid(),
        name: "Everyone who’s shared the page",
        note: "Thanks for helping more young people find this.",
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  seedAll();

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

  const store = {
    ADMIN_PASSWORD,

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

    getSuggestions() {
      return listGet(KEYS.suggestions);
    },

    addSuggestion({ name, email, area, topic, message }) {
      return listAdd(KEYS.suggestions, {
        name: (name || "Anonymous").trim() || "Anonymous",
        email: (email || "").trim(),
        area: (area || "").trim(),
        topic: (topic || "General").trim(),
        message: (message || "").trim(),
        status: "new",
      });
    },

    updateSuggestionStatus(id, status) {
      const next = read(KEYS.suggestions, []).map((s) =>
        s.id === id ? { ...s, status } : s
      );
      write(KEYS.suggestions, next);
      return next;
    },

    deleteSuggestion(id) {
      listDelete(KEYS.suggestions, id);
    },

    getUpdates() {
      return listGet(KEYS.updates);
    },
    addUpdate({ title, body }) {
      return listAdd(KEYS.updates, {
        title: String(title || "").trim(),
        body: String(body || "").trim(),
      });
    },
    deleteUpdate(id) {
      listDelete(KEYS.updates, id);
    },

    getEvents() {
      return listGet(KEYS.events);
    },
    addEvent({ title, when, where, body }) {
      return listAdd(KEYS.events, {
        title: String(title || "").trim(),
        when: String(when || "").trim(),
        where: String(where || "").trim(),
        body: String(body || "").trim(),
      });
    },
    deleteEvent(id) {
      listDelete(KEYS.events, id);
    },

    getDonations() {
      return listGet(KEYS.donations);
    },
    addDonation({ name, amount, note }) {
      return listAdd(KEYS.donations, {
        name: String(name || "Anonymous").trim() || "Anonymous",
        amount: String(amount || "").trim(),
        note: String(note || "").trim(),
      });
    },
    deleteDonation(id) {
      listDelete(KEYS.donations, id);
    },

    getJoins() {
      return listGet(KEYS.joins);
    },
    addJoin({ name, email, cause, note }) {
      return listAdd(KEYS.joins, {
        name: String(name || "Anonymous").trim() || "Anonymous",
        email: String(email || "").trim(),
        cause: String(cause || "").trim(),
        note: String(note || "").trim(),
      });
    },
    deleteJoin(id) {
      listDelete(KEYS.joins, id);
    },

    getMentions() {
      return listGet(KEYS.mentions);
    },
    addMention({ name, note }) {
      return listAdd(KEYS.mentions, {
        name: String(name || "").trim(),
        note: String(note || "").trim(),
      });
    },
    deleteMention(id) {
      listDelete(KEYS.mentions, id);
    },

    getPolls() {
      return listGet(KEYS.polls);
    },

    getActivePolls() {
      return store.getPolls().filter((p) => p.active);
    },

    createPoll({ question, options }) {
      return listAdd(KEYS.polls, {
        question: question.trim(),
        options: options
          .map((label) => String(label).trim())
          .filter(Boolean)
          .map((label) => ({ id: uid(), label })),
        active: true,
      });
    },

    setPollActive(id, active) {
      write(
        KEYS.polls,
        read(KEYS.polls, []).map((p) => (p.id === id ? { ...p, active } : p))
      );
    },

    deletePoll(id) {
      listDelete(KEYS.polls, id);
      const votes = read(KEYS.votes, {});
      delete votes[id];
      write(KEYS.votes, votes);
    },

    getVotes(pollId) {
      return read(KEYS.votes, {})[pollId] || {};
    },

    hasVoted(pollId) {
      return Boolean(localStorage.getItem("byc_voted_" + pollId));
    },

    castVote(pollId, optionId) {
      if (store.hasVoted(pollId)) return { ok: false, reason: "already" };
      const poll = store.getPolls().find((p) => p.id === pollId);
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

    voteTotals(pollId) {
      const tally = store.getVotes(pollId);
      const total = Object.values(tally).reduce((a, n) => a + n, 0);
      return { tally, total };
    },
  };

  global.BYC = store;
})(window);
