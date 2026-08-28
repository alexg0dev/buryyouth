(function () {
  const cfg = window.BYC_SUPABASE || {};

  function loadStore() {
    return new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = "js/store.js";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  const authSources = [
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js",
    "https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js",
  ];

  function loadAuthClient(i) {
    return loadScript(authSources[i]).catch(function () {
      if (i + 1 < authSources.length) return loadAuthClient(i + 1);
      throw new Error("auth client");
    });
  }

  // Client loads only when both url and anonKey are set. After restore, paste
  // the publishable/anon key in js/config.js — never a service-role key.
  window.BYC_READY =
    cfg.url && cfg.anonKey
      ? loadAuthClient(0)
          .then(loadStore)
          .catch(loadStore)
      : loadStore();
})();
