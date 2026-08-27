/**
 * Save Our Youth data layer
 * Uses Supabase when window.BYC_SUPABASE is configured, otherwise localStorage.
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
  const POLL_QUESTION = "What should be prioritised for Bury's youth?";

  const cfg = global.BYC_SUPABASE || {};
  const useSupabase = Boolean(cfg.url && cfg.anonKey && global.supabase);

  let sb = null;
  if (useSupabase) {
    sb = global.supabase.createClient(cfg.url, cfg.anonKey);
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

  function voterKey() {
    let key = localStorage.getItem("byc_voter_key");
    if (!key) {
      key = uid();
      localStorage.setItem("byc_voter_key", key);
    }
    return key;
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
    hasVoted(pollId) {
      return Boolean(localStorage.getItem("byc_voted_" + pollId));
    },
    async castVote(pollId, optionId) {
      if (localStore.hasVoted(pollId)) return { ok: false, reason: "already" };
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
    hasVoted(pollId) {
      return Boolean(localStorage.getItem("byc_voted_" + pollId));
    },
    async castVote(pollId, optionId) {
      if (supabaseStore.hasVoted(pollId)) return { ok: false, reason: "already" };
      const { error } = await sb.from("votes").insert({
        poll_id: pollId,
        option_id: optionId,
        voter_key: voterKey(),
      });
      if (error) {
        if (String(error.message || "").includes("duplicate")) {
          return { ok: false, reason: "already" };
        }
        throw error;
      }
      localStorage.setItem("byc_voted_" + pollId, optionId);
      const tally = await supabaseStore.getVotes(pollId);
      return { ok: true, tally };
    },
    async voteTotals(pollId) {
      const tally = await supabaseStore.getVotes(pollId);
      const total = Object.values(tally).reduce((a, n) => a + n, 0);
      return { tally, total };
    },
  };

  const data = useSupabase ? supabaseStore : localStore;

  const store = {
    ADMIN_PASSWORD,
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

    getSuggestions: (...a) => data.getSuggestions(...a),
    addSuggestion: (...a) => data.addSuggestion(...a),
    updateSuggestionStatus: (...a) => data.updateSuggestionStatus(...a),
    deleteSuggestion: (...a) => data.deleteSuggestion(...a),
    getUpdates: (...a) => data.getUpdates(...a),
    addUpdate: (...a) => data.addUpdate(...a),
    deleteUpdate: (...a) => data.deleteUpdate(...a),
    getEvents: (...a) => data.getEvents(...a),
    addEvent: (...a) => data.addEvent(...a),
    deleteEvent: (...a) => data.deleteEvent(...a),
    getDonations: (...a) => data.getDonations(...a),
    addDonation: (...a) => data.addDonation(...a),
    deleteDonation: (...a) => data.deleteDonation(...a),
    getJoins: (...a) => data.getJoins(...a),
    addJoin: (...a) => data.addJoin(...a),
    deleteJoin: (...a) => data.deleteJoin(...a),
    getPolls: (...a) => data.getPolls(...a),
    getActivePolls: (...a) => data.getActivePolls(...a),
    createPoll: (...a) => data.createPoll(...a),
    setPollActive: (...a) => data.setPollActive(...a),
    deletePoll: (...a) => data.deletePoll(...a),
    getVotes: (...a) => data.getVotes(...a),
    hasVoted: (...a) => data.hasVoted(...a),
    castVote: (...a) => data.castVote(...a),
    voteTotals: (...a) => data.voteTotals(...a),
  };

  global.BYC = store;
})(window);
