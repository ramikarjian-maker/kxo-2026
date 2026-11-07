/* Shared data: sign-ups + gratitude wall.
   Modes: "firebase" (live, shared), "mock" (?mock=1, this browser only, for previews),
   "off" (no config yet), "error" (couldn't connect). */
window.KXOCloud = (function () {
  var listeners = [];
  var state = { mode: "off", signups: {}, wall: [], games: {}, photos: [] };
  function emit(kind) { listeners.forEach(function (f) { try { f(kind); } catch (e) { console.error(e); } }); }

  function setSignups(rows) {
    var m = {};
    rows.forEach(function (r) { (m[r.activity] = m[r.activity] || []).push(r); });
    Object.keys(m).forEach(function (k) { m[k].sort(function (a, b) { return a.ts - b.ts; }); });
    state.signups = m;
    emit("signups");
  }
  function setWall(rows) { state.wall = rows.sort(function (a, b) { return b.ts - a.ts; }); emit("wall"); }
  function noop() { return Promise.reject(new Error("Sign-ups aren't connected yet.")); }

  var api = {
    state: state,
    on: function (f) { listeners.push(f); },
    who: function (act) { return (state.signups[act] || []).map(function (r) { return r.person; }); },
    join: noop, leave: noop, post: noop, remove: noop,
    game: function (id) { return state.games[id] || null; },
    gameUpdate: noop, gameSet: noop,
    addPhoto: noop, removePhoto: noop, getPhoto: noop
  };
  function setPhotos(rows) { state.photos = rows.sort(function (a, b) { return b.ts - a.ts; }); emit("photos"); }
  var fullCache = {};
  function cached(id, load) { if (fullCache[id]) return Promise.resolve(fullCache[id]); return load().then(function (d) { if (d) fullCache[id] = d; return d; }); }
  function setGames(g) { state.games = g || {}; emit("games"); }
  // "a/b/c" paths -> nested object (for Firestore merge writes)
  function nest(updates) {
    var out = {};
    Object.keys(updates).forEach(function (path) {
      var parts = path.split("/"), o = out;
      for (var i = 0; i < parts.length - 1; i++) { o[parts[i]] = o[parts[i]] || {}; o = o[parts[i]]; }
      o[parts[parts.length - 1]] = updates[path] == null && window.firebase && firebase.firestore ? firebase.firestore.FieldValue.delete() : updates[path];
    });
    return out;
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error("Couldn't load " + src)); };
      document.head.appendChild(s);
    });
  }
  api.loadScript = loadScript;

  function millis(v) { return v && typeof v.toMillis === "function" ? v.toMillis() : Date.now(); }

  function startFirebase(cfg) {
    var V = "https://www.gstatic.com/firebasejs/10.12.2/";
    return loadScript(V + "firebase-app-compat.js").then(function () {
      firebase.initializeApp(cfg);
      return tryFirestore(V).catch(function (err) {
        console.warn("Firestore not available, trying Realtime Database:", err && (err.code || err.message));
        if (!cfg.databaseURL) throw err;
        return tryRtdb(V);
      });
    });
  }

  function tryFirestore(V) {
    return loadScript(V + "firebase-firestore-compat.js").then(function () {
      var db = firebase.firestore(), stamp = firebase.firestore.FieldValue.serverTimestamp, opts = { serverTimestamps: "estimate" };
      return new Promise(function (resolve, reject) {
        var done = false, unsub = null;
        var timer = setTimeout(function () { if (!done) { done = true; if (unsub) unsub(); reject(new Error("Firestore timeout")); } }, 8000);
        unsub = db.collection("signups").onSnapshot(function (snap) {
          var rows = [];
          snap.forEach(function (d) { var x = d.data(opts); rows.push({ activity: x.activity, person: x.person, ts: millis(x.ts) }); });
          if (!done) {
            if (snap.metadata.fromCache) return;
            done = true; clearTimeout(timer); resolve();
          }
          setSignups(rows);
        }, function (err) {
          if (!done) { done = true; clearTimeout(timer); reject(err); }
          else { console.error(err); state.mode = "error"; state.error = err.code || String(err); emit("mode"); }
        });
      }).then(function () {
        db.collection("wall").orderBy("ts", "desc").limit(300).onSnapshot(function (snap) {
          var rows = [];
          snap.forEach(function (d) { var x = d.data(opts); rows.push({ id: d.id, name: x.name, text: x.text, ts: millis(x.ts) }); });
          setWall(rows);
        }, function (err) { console.error(err); });
        api.join = function (act, person) { return db.collection("signups").doc(act + "__" + person).set({ activity: act, person: person, ts: stamp() }); };
        api.leave = function (act, person) { return db.collection("signups").doc(act + "__" + person).delete(); };
        api.post = function (name, text) { return db.collection("wall").add({ name: name, text: text, ts: stamp() }); };
        api.remove = function (id) { return db.collection("wall").doc(id).delete(); };
        db.collection("games").onSnapshot(function (snap) {
          var g = {}; snap.forEach(function (d) { g[d.id] = d.data(); }); setGames(g);
        }, function (err) { console.error(err); });
        api.gameUpdate = function (id, updates) { return db.collection("games").doc(id).set(nest(updates), { merge: true }); };
        api.gameSet = function (id, val) { return val == null ? db.collection("games").doc(id).delete() : db.collection("games").doc(id).set(val); };
        db.collection("photos").orderBy("ts", "desc").limit(500).onSnapshot(function (snap) {
          var rows = []; snap.forEach(function (d) { var x = d.data(opts); rows.push({ id: d.id, name: x.name, thumb: x.thumb, w: x.w, h: x.h, ts: millis(x.ts) }); }); setPhotos(rows);
        }, function (err) { console.error(err); });
        api.addPhoto = function (meta, full) {
          var ref = db.collection("photos").doc(), b = db.batch();
          b.set(ref, { name: meta.name, thumb: meta.thumb, w: meta.w, h: meta.h, ts: stamp() });
          b.set(db.collection("photoFull").doc(ref.id), { d: full });
          return b.commit();
        };
        api.removePhoto = function (id) { var b = db.batch(); b.delete(db.collection("photos").doc(id)); b.delete(db.collection("photoFull").doc(id)); return b.commit(); };
        api.getPhoto = function (id) { return cached(id, function () { return db.collection("photoFull").doc(id).get().then(function (d) { return d.exists ? d.data().d : null; }); }); };
        state.mode = "firebase"; state.backend = "Firestore"; emit("mode");
      });
    });
  }

  function tryRtdb(V) {
    return loadScript(V + "firebase-database-compat.js").then(function () {
      var db = firebase.database(), TS = firebase.database.ServerValue.TIMESTAMP;
      return new Promise(function (resolve, reject) {
        var done = false;
        var timer = setTimeout(function () { if (!done) { done = true; reject(new Error("Realtime Database timeout")); } }, 8000);
        db.ref("signups").on("value", function (snap) {
          var rows = [];
          snap.forEach(function (c) { var x = c.val() || {}; rows.push({ activity: x.activity, person: x.person, ts: x.ts || Date.now() }); return false; });
          setSignups(rows);
          if (!done) { done = true; clearTimeout(timer); resolve(); }
        }, function (err) {
          if (!done) { done = true; clearTimeout(timer); reject(err); }
          else { console.error(err); state.mode = "error"; state.error = err.code || String(err); emit("mode"); }
        });
      }).then(function () {
        db.ref("wall").on("value", function (snap) {
          var rows = [];
          snap.forEach(function (c) { var x = c.val() || {}; rows.push({ id: c.key, name: x.name, text: x.text, ts: x.ts || Date.now() }); return false; });
          setWall(rows);
        }, function (err) { console.error(err); });
        api.join = function (act, person) { return db.ref("signups/" + act + "__" + person).set({ activity: act, person: person, ts: TS }); };
        api.leave = function (act, person) { return db.ref("signups/" + act + "__" + person).remove(); };
        api.post = function (name, text) { return db.ref("wall").push({ name: name, text: text, ts: TS }); };
        api.remove = function (id) { return db.ref("wall/" + id).remove(); };
        db.ref("games").on("value", function (snap) { setGames(snap.val() || {}); }, function (err) { console.error(err); });
        api.gameUpdate = function (id, updates) { var u = {}; Object.keys(updates).forEach(function (k) { u[id + "/" + k] = updates[k]; }); return db.ref("games").update(u); };
        api.gameSet = function (id, val) { return db.ref("games/" + id).set(val == null ? null : val); };
        db.ref("photos").on("value", function (snap) {
          var rows = []; snap.forEach(function (c) { var x = c.val() || {}; rows.push({ id: c.key, name: x.name, thumb: x.thumb, w: x.w, h: x.h, ts: x.ts || Date.now() }); return false; }); setPhotos(rows);
        }, function (err) { console.error(err); });
        api.addPhoto = function (meta, full) {
          var id = db.ref("photos").push().key, u = {};
          u["photos/" + id] = { name: meta.name, thumb: meta.thumb, w: meta.w, h: meta.h, ts: TS };
          u["photoFull/" + id] = { d: full };
          return db.ref().update(u);
        };
        api.removePhoto = function (id) { var u = {}; u["photos/" + id] = null; u["photoFull/" + id] = null; return db.ref().update(u); };
        api.getPhoto = function (id) { return cached(id, function () { return db.ref("photoFull/" + id).once("value").then(function (x) { var v = x.val(); return v ? v.d : null; }); }); };
        state.mode = "firebase"; state.backend = "Realtime Database"; emit("mode");
      });
    });
  }

  function startMock() {
    var KEY = "kxo.mock";
    function read() { var d; try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) {} d = d || {}; d.signups = d.signups || []; d.wall = d.wall || []; d.games = d.games || {}; return d; }
    function write(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} pull(); }
    function pull() { var d = read(); setSignups(d.signups.slice()); setWall(d.wall.slice()); setGames(d.games); }
    api.gameUpdate = function (id, updates) {
      var d = read(); d.games[id] = d.games[id] || {};
      Object.keys(updates).forEach(function (path) {
        var parts = path.split("/"), o = d.games[id];
        for (var i = 0; i < parts.length - 1; i++) { o[parts[i]] = o[parts[i]] || {}; o = o[parts[i]]; }
        if (updates[path] == null) delete o[parts[parts.length - 1]]; else o[parts[parts.length - 1]] = updates[path];
      });
      write(d); return Promise.resolve();
    };
    api.gameSet = function (id, val) { var d = read(); if (val == null) delete d.games[id]; else d.games[id] = val; write(d); return Promise.resolve(); };
    var memPhotos = [], memFull = {};
    api.addPhoto = function (meta, full) { var id = "p" + Date.now() + Math.floor(Math.random() * 1000); memPhotos.push({ id: id, name: meta.name, thumb: meta.thumb, w: meta.w, h: meta.h, ts: Date.now() }); memFull[id] = full; setPhotos(memPhotos.slice()); return Promise.resolve(); };
    api.removePhoto = function (id) { memPhotos = memPhotos.filter(function (p) { return p.id !== id; }); delete memFull[id]; setPhotos(memPhotos.slice()); return Promise.resolve(); };
    api.getPhoto = function (id) { return Promise.resolve(memFull[id] || null); };
    api.join = function (act, person) { var d = read(); d.signups = d.signups.filter(function (r) { return !(r.activity === act && r.person === person); }); d.signups.push({ activity: act, person: person, ts: Date.now() }); write(d); return Promise.resolve(); };
    api.leave = function (act, person) { var d = read(); d.signups = d.signups.filter(function (r) { return !(r.activity === act && r.person === person); }); write(d); return Promise.resolve(); };
    api.post = function (name, text) { var d = read(); d.wall.push({ id: "m" + Date.now(), name: name, text: text, ts: Date.now() }); write(d); return Promise.resolve(); };
    api.remove = function (id) { var d = read(); d.wall = d.wall.filter(function (n) { return n.id !== id; }); write(d); return Promise.resolve(); };
    window.addEventListener("storage", function (e) { if (e.key === KEY) pull(); });
    state.mode = "mock";
    emit("mode");
    pull();
  }

  api.start = function () {
    var q = new URLSearchParams(location.search);
    var cfg = window.KXO_FIREBASE;
    if (q.get("mock") === "1") { startMock(); return; }
    if (cfg && cfg.projectId) {
      startFirebase(cfg).catch(function (err) { console.error(err); state.mode = "error"; state.error = (err && (err.code || err.message)) || "unknown"; emit("mode"); });
    }
  };
  return api;
})();
