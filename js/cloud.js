/* Shared data: sign-ups + gratitude wall.
   Modes: "firebase" (live, shared), "mock" (?mock=1, this browser only, for previews),
   "off" (no config yet), "error" (couldn't connect). */
window.KXOCloud = (function () {
  var listeners = [];
  var state = { mode: "off", signups: {}, wall: [] };
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
    join: noop, leave: noop, post: noop, remove: noop
  };

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
    var V = "10.12.2";
    return loadScript("https://www.gstatic.com/firebasejs/" + V + "/firebase-app-compat.js")
      .then(function () { return loadScript("https://www.gstatic.com/firebasejs/" + V + "/firebase-firestore-compat.js"); })
      .then(function () {
        firebase.initializeApp(cfg);
        var db = firebase.firestore();
        var stamp = firebase.firestore.FieldValue.serverTimestamp;
        var opts = { serverTimestamps: "estimate" };
        db.collection("signups").onSnapshot(function (snap) {
          var rows = [];
          snap.forEach(function (d) { var x = d.data(opts); rows.push({ activity: x.activity, person: x.person, ts: millis(x.ts) }); });
          setSignups(rows);
        }, function (err) { console.error(err); state.mode = "error"; emit("mode"); });
        db.collection("wall").orderBy("ts", "desc").limit(300).onSnapshot(function (snap) {
          var rows = [];
          snap.forEach(function (d) { var x = d.data(opts); rows.push({ id: d.id, name: x.name, text: x.text, ts: millis(x.ts) }); });
          setWall(rows);
        }, function (err) { console.error(err); });
        api.join = function (act, person) { return db.collection("signups").doc(act + "__" + person).set({ activity: act, person: person, ts: stamp() }); };
        api.leave = function (act, person) { return db.collection("signups").doc(act + "__" + person).delete(); };
        api.post = function (name, text) { return db.collection("wall").add({ name: name, text: text, ts: stamp() }); };
        api.remove = function (id) { return db.collection("wall").doc(id).delete(); };
        state.mode = "firebase";
        emit("mode");
      });
  }

  function startMock() {
    var KEY = "kxo.mock";
    function read() { try { return JSON.parse(localStorage.getItem(KEY)) || { signups: [], wall: [] }; } catch (e) { return { signups: [], wall: [] }; } }
    function write(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} pull(); }
    function pull() { var d = read(); setSignups(d.signups.slice()); setWall(d.wall.slice()); }
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
      startFirebase(cfg).catch(function (err) { console.error(err); state.mode = "error"; emit("mode"); });
    }
  };
  return api;
})();
