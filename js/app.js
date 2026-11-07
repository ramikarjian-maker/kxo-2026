/* Runs after js/gate.js unlocks and decrypts the content into window.KXO. */
window.KXO_BOOT = function () {
  "use strict";
  var K = window.KXO, Cloud = window.KXOCloud;
  var PL = K.PL, DAYS = K.DAYS, PREP = K.PREP, ACTS = K.ACTS;
  var SITE = location.origin + location.pathname;

  /* ---------- clock (with ?now=2026-11-26T15:30 preview override) ---------- */
  var LOAD = Date.now();
  var Q = new URLSearchParams(location.search);
  var OVERRIDE = (function () {
    var v = Q.get("now"); if (!v) return null;
    var d = new Date(v.length <= 16 ? v + ":00-08:00" : v);
    return isNaN(d.getTime()) ? null : d;
  })();
  function now() { return OVERRIDE ? new Date(OVERRIDE.getTime() + (Date.now() - LOAD)) : new Date(); }
  var ptFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" });
  var clkFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" });
  var dowFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short" });
  function today() { return ptFmt.format(now()); }
  function dayNum(iso) { var p = iso.split("-"); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000; }
  function ptInstant(local) { return new Date(local + ":00-08:00"); } // late Nov 2026 is PST
  function ms(local) { return ptInstant(local).getTime(); }
  function clock(d) { return clkFmt.format(d).replace(/\s*AM$/, "a").replace(/\s*PM$/, "p"); }
  function inText(d) {
    if (d <= 60000) return "now";
    var m = Math.ceil(d / 60000);
    if (m < 60) return "in " + m + " min";
    var h = Math.floor(m / 60), r = m % 60;
    if (h >= 48) return "in " + Math.round(h / 24) + " days";
    return "in " + h + "h" + (r ? " " + r + "m" : "");
  }
  function cdHtml(d) {
    d = Math.max(0, d);
    var s = Math.floor(d / 1000), dd = Math.floor(s / 86400), hh = Math.floor(s % 86400 / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60;
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return dd + '<span class="u">d</span>' + p(hh) + '<span class="u">h</span>' + p(mm) + '<span class="u">m</span>' + p(ss) + '<span class="u">s</span>';
  }
  function ago(t) { var d = (now().getTime() - t) / 60000; if (d < 1) return "just now"; if (d < 60) return Math.floor(d) + " min ago"; if (d < 1440) return Math.floor(d / 60) + "h ago"; return Math.floor(d / 1440) + "d ago"; }

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var ICON = {
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>',
    out: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3h7v7h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H14V3ZM5 5h6v2H5v12h12v-6h2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/></svg>',
    plane: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5Z"/></svg>'
  };
  function appleUrl(p) { return "https://maps.apple.com/?daddr=" + encodeURIComponent(p.q) + "&dirflg=d"; }
  function googleUrl(p) { return "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(p.q) + "&travelmode=driving"; }
  function trackUrl(f) { var id = f.cs || (f.flight || "").replace(/\s+/g, "").toUpperCase(); return id ? "https://www.flightaware.com/live/flight/" + encodeURIComponent(id) : "https://www.flightaware.com/live/airport/KSEA"; }
  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ---------- identity ---------- */
  var ALLNAMES = [].concat.apply([], K.PEOPLE.map(function (g) { return g[1]; }));
  var ME = null;
  try { ME = localStorage.getItem("kxo.me"); } catch (e) {}
  if (ALLNAMES.indexOf(ME) < 0) ME = null;
  function setMe(n) { ME = n; try { localStorage.setItem("kxo.me", n); } catch (e) {} updateMeChip(); }
  function updateMeChip() {
    var c = document.getElementById("mechip");
    c.textContent = ME ? "I'm " + ME : "Who are you?";
    c.classList.toggle("unset", !ME);
  }
  function joined(act, name) { return !!name && Cloud.who(act).indexOf(name) >= 0; }
  function live() { return Cloud.state.mode === "firebase" || Cloud.state.mode === "mock"; }

  /* ---------- events (flattened) ---------- */
  var EVENTS = [];
  DAYS.forEach(function (d) { d.items.forEach(function (it) { EVENTS.push({ d: d, it: it, s: ms(it.at), e: ms(it.end) }); }); });
  function relevant(it, name) {
    if (!name) return true;
    if (it.all) return true;
    if (it.act && ACTS[it.act].kind === "driver") return joined(it.act, name) || (it.people || []).indexOf(name) >= 0;
    if (it.act) return joined(it.act, name);
    return true;
  }

  /* ---------- weather (Open-Meteo, no key) ---------- */
  var WXPTS = { home: K.HOME };
  Object.keys(PL).forEach(function (k) { WXPTS[k] = PL[k]; });
  var WX = {};
  var WX_FIRST = "2026-11-25", WX_LAST = "2026-11-29";
  function wxOpen() { var t = dayNum(today()); return dayNum(WX_FIRST) - t <= 10 && t <= dayNum(WX_LAST); }
  function wxCode(c) {
    if (c === 0) return ["☀︎", "Clear"];
    if (c === 1) return ["☀︎", "Mostly clear"];
    if (c === 2) return ["⛅︎", "Partly cloudy"];
    if (c === 3) return ["☁︎", "Cloudy"];
    if (c === 45 || c === 48) return ["☁︎", "Fog"];
    if (c >= 51 && c <= 57) return ["☂︎", "Drizzle"];
    if (c >= 61 && c <= 67) return ["☂︎", "Rain"];
    if (c >= 71 && c <= 77) return ["❄︎", "Snow"];
    if (c >= 80 && c <= 82) return ["☂︎", "Showers"];
    if (c === 85 || c === 86) return ["❄︎", "Snow showers"];
    if (c >= 95) return ["☂︎", "Storms"];
    return ["☁︎", "Cloudy"];
  }
  function loadWeather() {
    if (!wxOpen()) return;
    Object.keys(WXPTS).forEach(function (k) {
      var key = "kxo.wx." + k;
      try { var c = JSON.parse(localStorage.getItem(key)); if (c && Date.now() - c.at < 3600000) { WX[k] = c.j; return; } } catch (e) {}
      var p = WXPTS[k];
      var url = "https://api.open-meteo.com/v1/forecast?latitude=" + p.lat + "&longitude=" + p.lon +
        "&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
        "&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles&start_date=" + WX_FIRST + "&end_date=" + WX_LAST;
      fetch(url).then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); }).then(function (j) {
        WX[k] = j; try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), j: j })); } catch (e) {}
        softRender();
      }).catch(function () {});
    });
  }
  function wxHour(k, local) {
    var j = WX[k]; if (!j || !j.hourly) return null;
    var i = j.hourly.time.indexOf(local.slice(0, 13) + ":00"); if (i < 0) return null;
    return { t: j.hourly.temperature_2m[i], p: j.hourly.precipitation_probability[i], c: j.hourly.weather_code[i] };
  }
  function wxDay(k, date) {
    var j = WX[k]; if (!j || !j.daily) return null;
    var i = j.daily.time.indexOf(date); if (i < 0) return null;
    return { hi: j.daily.temperature_2m_max[i], lo: j.daily.temperature_2m_min[i], p: j.daily.precipitation_probability_max[i], c: j.daily.weather_code[i] };
  }
  function wxChip(it) {
    var k = it.place === "Home" ? "home" : (WXPTS[it.place] ? it.place : null); if (!k) return "";
    var w = wxHour(k, it.at); if (!w || w.t == null) return "";
    var g = wxCode(w.c);
    return '<span class="wx" title="' + esc(g[1]) + '">' + g[0] + " " + Math.round(w.t) + "°" + (w.p != null ? " · " + w.p + "% rain" : "") + "</span>";
  }
  function dayWxHtml(d) {
    var w = wxDay("home", d.date);
    if (!w) return '<div class="daywx pending">' + (wxOpen() ? "Loading the forecast…" : "The forecast shows up here about 10 days out, around Nov 15.") + "</div>";
    var g = wxCode(w.c);
    return '<div class="daywx"><span class="g">' + g[0] + "</span><span><b>" + Math.round(w.hi) + "° / " + Math.round(w.lo) + "°</b> · " + esc(g[1]) + (w.p != null ? " · " + w.p + "% chance of rain" : "") + " · Mercer Island</span></div>";
  }

  /* ---------- sign-ups ---------- */
  function whoHtml(actId, compact) {
    var a = ACTS[actId], names = Cloud.who(actId), mine = joined(actId, ME);
    var full = a.cap && names.length >= a.cap && !mine;
    var label = a.kind === "driver" ? "Driver" : "Who's in";
    var empty = a.kind === "driver" ? "No driver yet" : a.kind === "dish" ? "Open" : "No one yet";
    var chips = names.length ? names.map(function (n) { return '<span class="pchip' + (n === ME ? " me" : "") + '">' + esc(n) + "</span>"; }).join("") : '<span class="none">' + empty + "</span>";
    var count = a.cap && a.cap > 1 ? '<span class="cap">' + names.length + " of " + a.cap + "</span>" : (names.length && !a.cap ? '<span class="cap">' + names.length + "</span>" : "");
    var btn;
    if (Cloud.state.mode === "error") btn = '<span class="soon">Can\'t reach sign-ups right now. Try again in a bit.</span>';
    else if (!live()) btn = '<span class="soon">Sign-ups open soon</span>';
    else if (mine) btn = '<button class="joinbtn on" data-leave="' + actId + '">' + (a.kind === "driver" ? "You're driving · Undo" : a.kind === "dish" ? "You're making it · Undo" : "You're in · Undo") + "</button>";
    else if (full) btn = '<button class="joinbtn" disabled>Full</button>';
    else btn = '<button class="joinbtn" data-join="' + actId + '">' + (a.kind === "driver" ? "I'll drive" : a.kind === "dish" ? "I'll make it" : "I'm in") + "</button>";
    return '<div class="who' + (compact ? " compact" : "") + '">' + (compact ? "" : '<div class="who-top"><span class="sec-label">' + label + "</span>" + count + "</div>") +
      '<div class="pchips">' + chips + "</div>" + btn + "</div>";
  }
  function doJoin(act) {
    if (!ME) { pickMe(function () { doJoin(act); }); return; }
    var a = ACTS[act], who = Cloud.who(act);
    if (a.cap && who.length >= a.cap && who.indexOf(ME) < 0) { toast("That one's full."); return; }
    Cloud.join(act, ME).then(function () { toast(a.kind === "driver" ? "Thanks for driving, " + ME + "!" : a.kind === "dish" ? "Thanks, " + ME + "! You're on " + (a.short || a.title).toLowerCase() + "." : "You're in, " + ME + "!"); }, function () { toast("Couldn't save that. Check your connection."); });
  }
  function doLeave(act) { if (!ME) return; Cloud.leave(act, ME).catch(function () { toast("Couldn't save that. Check your connection."); }); }

  /* ---------- item + day renderers ---------- */
  function placeChip(key) {
    var p = PL[key];
    if (!p) return '<span class="tag">' + esc(key) + "</span>";
    return '<button class="dirbtn" data-place="' + key + '">' + ICON.pin + 'Directions <span class="dt">' + esc(p.drive) + "</span></button>";
  }
  function statusTag(s) { return s ? '<span class="tag status ' + s[0] + '">' + esc(s[1]) + "</span>" : ""; }
  function ownsStep(it, name) { if (!it.owner || !name) return false; if (it.owner === name) return true; var r = K.OWNER_ROLE[it.owner]; return !!r && Cloud.who(r).indexOf(name) >= 0; }
  function ownerLabel(o) { var r = K.OWNER_ROLE[o]; if (!r) return o; var n = Cloud.who(r); return n.length ? o + ": " + n.join(" + ") : o + ": open"; }

  function itemHtml(it, isNext) {
    var cls = "item" + (it.feature ? " feature" : "") + (isNext ? " next" : "");
    var meta = placeChip(it.place) + (it.all ? '<span class="tag">Everyone</span>' : "") + (it.owner ? '<span class="tag">' + esc(ownerLabel(it.owner)) + "</span>" : "") + statusTag(it.status) + statusTag(it.status2) + wxChip(it);
    var h = '<li class="' + cls + '"><div class="time">' + esc(it.t) + '</div><div class="card">';
    if (isNext) h += '<span class="next-tag">Up next</span>';
    h += "<h3>" + esc(it.title) + '</h3><div class="meta">' + meta + "</div>";
    if (it.what) h += '<div class="sec what"><div class="sec-label">What it is</div><p>' + esc(it.what) + "</p></div>";
    if (it.logi) h += '<div class="sec"><div class="sec-label">Logistics</div><ul class="logi">' + it.logi.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul></div>";
    if (it.todo) h += '<div class="sec"><div class="sec-label">Need to do</div><div class="todos">' + it.todo.map(function (t) { return '<a class="btn-todo" href="' + esc(t[1]) + '" target="_blank" rel="noopener">' + esc(t[0]) + ICON.out + "</a>"; }).join("") + "</div></div>";
    if (it.notes) h += '<ul class="notes">' + it.notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul>";
    if (it.menu) h += '<div class="menu-title">On the table · who\'s making it</div><ul class="menu">' + it.menu.map(function (m) {
      var cooks = m[2] && ACTS[m[2]] ? Cloud.who(m[2]) : null;
      return "<li>" + esc(m[0]) + (m[1] ? '<span class="veg">VEG</span>' : "") + (cooks ? '<span class="cook' + (cooks.length ? "" : " open") + '">' + (cooks.length ? esc(cooks.join(" + ")) : "open") + "</span>" : "") + "</li>";
    }).join("") + '</ul><button class="linkbtn menu-go" data-go="prep">Sign up for a dish →</button>';
    if (it.act) h += whoHtml(it.act);
    if (/Karaoke/.test(it.title)) h += '<div class="pk-entry"><button class="btn-todo" data-go="karaoke">Pick your song</button><span class="muted small">' + (kQueue().length ? kQueue().length + " on the set list" : "Set list is open") + "</span></div>";
    if (it.act === "pickle") { var ch = pkChamps(pkGame()); h += '<div class="pk-entry">' + (ch ? '<span class="tag status ok">Champions: ' + names(ch) + "</span>" : "") + '<button class="btn-todo" data-go="pickle">Open the tournament</button></div>'; }
    return h + "</div></li>";
  }
  function railHtml(items, date) {
    var n = -1;
    if (date === today()) { var t = now().getTime(); for (var i = 0; i < items.length; i++) { if (ms(items[i].at) > t) { n = i; break; } } }
    return '<ol class="rail">' + items.map(function (it, i) { return itemHtml(it, i === n); }).join("") + "</ol>";
  }

  /* ---------- flip board ---------- */
  var FLAPCHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:+~";
  function flaps(s, n, right) {
    s = s.toUpperCase();
    while (s.length < n) s = right ? " " + s : s + " ";
    return '<span class="flaps" data-final="' + esc(s) + '">' + s.split("").map(function (c) { return '<span class="ch">' + (c === " " ? "&nbsp;" : esc(c)) + "</span>"; }).join("") + "</span>";
  }
  function boardHtml(dir) {
    var rows = K.FLIGHTS.filter(function (f) { return f.dir === dir; });
    var missing = rows.some(function (f) { return !f.flight; });
    return '<div class="board" data-board="' + dir + '" role="table" aria-label="' + (dir === "arr" ? "SEA arrivals" : "SEA departures") + '"><div class="board-title">' + ICON.plane + (dir === "arr" ? "SEA Arrivals" : "SEA Departures") + '<button class="board-live" data-go="' + (dir === "arr" ? "fly-in" : "fly-out") + '">Live map →</button></div>' +
      '<div class="board-cols"><span>WHO</span><span>' + (dir === "arr" ? "LANDS" : "DEPARTS") + "</span></div>" +
      rows.map(function (f) {
        var drv = Cloud.who(f.drive)[0];
        return '<div class="board-row" role="row"><div class="flaprow" aria-label="' + esc(f.who + ", " + f.time) + '">' + flaps(f.who.replace(/ /g, ""), 10) + flaps(f.time, 7, true) + "</div>" +
          '<div class="board-sub"><span>' + (f.flight ? esc(f.flight.toUpperCase()) + (f.from ? " · " + f.from + "→" + f.to : "") : "Flight # coming") + " · Driver: " + (drv ? esc(drv) : "TBD") + "</span>" +
          '<a class="track" href="' + trackUrl(f) + '" target="_blank" rel="noopener">' + (f.flight ? "Track flight" : "Live SEA board") + "</a></div></div>";
      }).join("") +
      (missing ? '<div class="board-note">Flight numbers are on the way. Until then, the button opens the live SEA board.</div>' : "") + "</div>";
  }
  var flapped = {};
  function animateBoards() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    Array.prototype.forEach.call(document.querySelectorAll(".board[data-board]"), function (b) {
      var dir = b.getAttribute("data-board"); if (flapped[dir]) return; flapped[dir] = true;
      var cells = [];
      Array.prototype.forEach.call(b.querySelectorAll(".flaps"), function (f, row) {
        var fin = f.getAttribute("data-final");
        Array.prototype.forEach.call(f.children, function (ch, i) { cells.push({ el: ch, fin: fin[i], left: 6 + i + row * 3 + Math.floor(Math.random() * 4) }); });
      });
      var timer = setInterval(function () {
        var busy = false;
        cells.forEach(function (c) {
          if (c.left > 0) { c.left--; busy = true; c.el.textContent = c.left === 0 ? (c.fin === " " ? " " : c.fin) : FLAPCHARS[Math.floor(Math.random() * FLAPCHARS.length)]; }
        });
        if (!busy) clearInterval(timer);
      }, 55);
    });
  }

  /* ---------- turkeys ---------- */
  function turkeysHtml() {
    return '<section class="turkeys" aria-labelledby="tk-h"><div class="kicker">About the turkeys</div><h2 id="tk-h">Two birds with a family tree</h2>' +
      "<p>Our turkeys come from Heritage Foods and were raised by Frank Reese on Good Shepherd Poultry Ranch in Lindsborg, Kansas. His flock is one of the oldest continuous turkey bloodlines in America, with genetics going back to the 1840s. He raises rare breeds like the Standard Bronze, Bourbon Red, White Holland, Black and Narragansett.</p>" +
      '<div class="kicker">What makes a turkey heritage</div><div class="tests">' +
      '<div class="test"><b>Mates naturally</b><span>No artificial insemination, unlike supermarket birds.</span></div>' +
      '<div class="test"><b>Lives long</b><span>Breeding hens keep going 5–7 years, outdoors.</span></div>' +
      '<div class="test"><b>Grows slowly</b><span>26–28 weeks to reach full size.</span></div></div>' +
      '<div class="kicker">Trace the DNA</div><ol class="dna">' + K.DNA.map(function (d) {
        return '<li><div class="node"><i></i></div><div class="txt"><div class="when">' + esc(d[0]) + "</div><span>" + esc(d[1]) + "</span></div></li>";
      }).join("") + "</ol>" +
      '<div class="src">Sources: Heritage Foods, The Livestock Conservancy, and ancient-DNA research led by Camilla Speller (PNAS, 2010).</div></section>';
  }

  /* ---------- now & next ---------- */
  var ARRIVE = ms("2026-11-25T16:58"), TRIP_START = ms("2026-11-25T16:00"), TRIP_END = ms("2026-11-29T18:00");
  var THU_STEPS = PREP.sections[PREP.sections.length - 1].items;
  function kitchenStep(t) {
    if (today() !== "2026-11-26") return null;
    var cur = null, nxt = null;
    THU_STEPS.forEach(function (it) { var s = ms(it.at); if (s <= t) cur = it; else if (!nxt) nxt = it; });
    return { cur: cur, nxt: nxt };
  }
  function nowInner() {
    var t = now().getTime();
    if (t < TRIP_START) {
      return '<div class="kicker">Countdown</div><div class="cd" data-until="' + ARRIVE + '">' + cdHtml(ARRIVE - t) + '</div><div class="now-sub">until the Ohs land at SEA · Wed, Nov 25, 4:58p PT</div>';
    }
    if (t > TRIP_END) return '<div class="kicker">That\'s a wrap</div><div class="now-title">Thanks for coming, everyone.</div><div><button class="maplink" data-go="thanks">Read the gratitude wall</button></div>';
    var evs = EVENTS.filter(function (e) { return relevant(e.it, ME); });
    if (!evs.length) evs = EVENTS;
    var cur = evs.filter(function (e) { return e.s <= t && t < e.e; }).pop();
    var nxt = evs.filter(function (e) { return e.s > t; })[0];
    var h = '<div class="kicker">' + (ME ? esc(ME) + "'s now + next" : "Now + next") + "</div>";
    if (cur) h += '<div class="now-row"><span class="now-tag live">Now</span><div><div class="now-title">' + esc(cur.it.title) + '</div><div class="now-sub">until ' + clock(new Date(cur.e)) + "</div></div></div>";
    if (nxt) {
      h += '<div class="now-row"><span class="now-tag">Next</span><div><div class="now-title">' + esc(nxt.it.title) + '</div><div class="now-sub">' + nxt.d.dow + " " + esc(nxt.it.t) + ' · <b data-until="' + nxt.s + '" data-fmt="in">' + inText(nxt.s - t) + "</b>" +
        (nxt.it.leave ? " · leave " + esc(nxt.it.leave) : "") + "</div>" + (PL[nxt.it.place] ? '<button class="dirbtn" data-place="' + nxt.it.place + '">' + ICON.pin + "Directions</button>" : "") + "</div></div>";
    }
    if (!cur && !nxt) h += '<div class="now-sub">Nothing else on the schedule. Enjoy it.</div>';
    var k = kitchenStep(t);
    if (k && k.nxt && t >= ms("2026-11-26T08:00") - 3600000) {
      var mineNext = ME ? THU_STEPS.filter(function (it) { return ms(it.at) > t && ownsStep(it, ME); })[0] : null;
      var ks = mineNext || k.nxt;
      h += '<div class="now-row"><span class="now-tag kitchen">' + (mineNext ? "Your job" : "Kitchen") + '</span><div><div class="now-title">' + esc(ks.title) + '</div><div class="now-sub">' + esc(ks.t) + (ks.owner && !mineNext ? " · " + esc(ownerLabel(ks.owner)) : "") + ' · <b data-until="' + ms(ks.at) + '" data-fmt="in">' + inText(ms(ks.at) - t) + "</b></div></div></div>";
    }
    return h;
  }
  function kitchenClockInner() {
    var t = now().getTime(), k = kitchenStep(t);
    if (!k) return "";
    var a = ms("2026-11-26T08:00"), b = ms("2026-11-26T17:00"), pct = Math.max(0, Math.min(100, (t - a) / (b - a) * 100));
    var h = '<div class="kicker">Kitchen clock · dinner <b data-until="' + b + '" data-fmt="in">' + inText(b - t) + '</b></div><div class="kbar"><i style="width:' + pct.toFixed(1) + '%"></i></div>';
    if (k.cur) h += '<div class="now-row"><span class="now-tag live">Now</span><div><div class="now-title">' + esc(k.cur.title) + '</div><div class="now-sub">' + esc(k.cur.t) + (k.cur.owner ? " · " + esc(ownerLabel(k.cur.owner)) : "") + "</div></div></div>";
    if (k.nxt) h += '<div class="now-row"><span class="now-tag kitchen">Next</span><div><div class="now-title">' + esc(k.nxt.title) + '</div><div class="now-sub">' + esc(k.nxt.t) + (k.nxt.owner ? " · " + esc(ownerLabel(k.nxt.owner)) : "") + ' · <b data-until="' + ms(k.nxt.at) + '" data-fmt="in">' + inText(ms(k.nxt.at) - t) + "</b></div></div></div>";
    return h;
  }

  /* ---------- my week ---------- */
  function myWeekHtml() {
    if (!ME) return '<button class="me-prompt" data-pickme><span class="kicker" style="color:var(--accent)">Make it yours</span><b>Tap your name to see your week</b><span>Your flights, your plans, your jobs, and what you still need to sign.</span></button>';
    var rows = [];
    K.FLIGHTS.forEach(function (f) {
      if (f.people.indexOf(ME) < 0) return;
      var drv = Cloud.who(f.drive)[0];
      rows.push({ s: ms(f.at), when: (f.dir === "arr" ? "Wed " : "Sat ") + f.time, txt: (f.dir === "arr" ? "You land at SEA" : "Your flight leaves SEA") + (f.flight ? " · " + f.flight.toUpperCase() : ""), tag: drv ? "Driver: " + drv : "Driver TBD", c: drv ? "ok" : "wait" });
    });
    EVENTS.forEach(function (e) {
      var it = e.it, isDrv = it.act && ACTS[it.act].kind === "driver";
      if (isDrv) { if (joined(it.act, ME)) rows.push({ s: e.s, when: e.d.dow + " " + it.t, txt: it.title.replace("Airport run", "Drive"), tag: "You're driving", c: "ok" }); return; }
      if (!relevant(it, ME)) return;
      rows.push({ s: e.s, when: e.d.dow + " " + it.t, txt: it.title, tag: it.all ? "" : "You're in", c: "ok" });
    });
    Object.keys(ACTS).forEach(function (id) { var a = ACTS[id]; if (a.kind === "dish" && joined(id, ME)) rows.push({ s: ms(a.at), when: a.when, txt: a.title, tag: "Your dish", c: "ok" }); });
    rows.sort(function (a, b) { return a.s - b.s; });
    var todos = Object.keys(ACTS).filter(function (id) { return ACTS[id].todo && joined(id, ME); });
    var open = Object.keys(ACTS).filter(function (id) { return !ACTS[id].kind && !joined(id, ME); });
    var h = '<section class="myweek"><div class="mw-head"><div><div class="kicker">Your week</div><h2>' + esc(ME) + '</h2></div><button class="linkbtn" data-pickme>Not ' + esc(ME) + "?</button></div>";
    h += '<ol class="mw-list">' + rows.map(function (r) { return '<li><span class="mw-when">' + esc(r.when) + '</span><span class="mw-txt">' + esc(r.txt) + (r.tag ? ' <span class="tag status ' + r.c + '">' + esc(r.tag) + "</span>" : "") + "</span></li>"; }).join("") + "</ol>";
    if (todos.length) h += '<div class="sec"><div class="sec-label">Need to do</div><div class="todos">' + todos.map(function (id) { var t = ACTS[id].todo; return '<a class="btn-todo" href="' + esc(t[1]) + '" target="_blank" rel="noopener">' + esc(t[0]) + ICON.out + "</a>"; }).join("") + "</div></div>";
    if (open.length) {
      h += '<div class="sec"><div class="sec-label">Want in?</div>' + (live()
        ? '<div class="mw-chips">' + open.map(function (id) { var a = ACTS[id], full = a.cap && Cloud.who(id).length >= a.cap; return '<button class="joinbtn small" data-join="' + id + '"' + (full ? " disabled" : "") + ">+ " + esc(a.title) + " · " + esc(a.when) + (full ? " (full)" : "") + "</button>"; }).join("") + "</div>"
        : '<span class="soon">Sign-ups open soon</span>') + "</div>";
    }
    return h + "</section>";
  }

  /* ---------- views ---------- */
  function dayView(d) {
    return '<div class="view-anim"><div class="day-head"><div class="kicker">' + esc(d.long) + '</div><h2 class="headline">' + esc(d.headline) + "</h2>" + dayWxHtml(d) + "</div>" +
      (d.board ? boardHtml(d.board) : "") + railHtml(d.items, d.date) + (d.turkeys ? turkeysHtml() : "") + "</div>";
  }
  function weekView() {
    var todos = [
      ["Register for the Turkey Trot", "Everyone running or walking · Thu 9:00a", K.LINKS.trot],
      ["Sign the pickleball waiver", "Everyone playing · Fri 11:00a", K.LINKS.pickleWaiver],
      ["Sign the escape room waiver", "The 6 players · Fri 8:00p", K.LINKS.escapeWaiver]
    ];
    var pkBanner = flyBannerHtml() + pkBannerHtml() + kBannerHtml();
    return '<div class="view-anim"><div class="now" id="nowcard">' + nowInner() + "</div>" + pkBanner + photoStripHtml() + myWeekHtml() +
      '<div class="hl-intro"><div class="kicker">The big picture</div><h2 class="headline">Five days, 14 of us, two turkeys.</h2></div>' +
      '<div class="hl-list">' + DAYS.map(function (d) {
        return '<button class="hl-card" data-go="' + d.id + '"><div class="hl-date"><span class="dow">' + d.dow + '</span><span class="num">' + d.num + '</span></div><div class="hl-body"><h3>' + esc(d.headline) + '</h3><ul class="moments">' +
          d.moments.map(function (m) { return "<li><b>" + esc(m[0]) + "</b>" + esc(m[1]) + "</li>"; }).join("") + '</ul><span class="hl-more">See the day →</span></div></button>';
      }).join("") + "</div>" +
      '<div class="todo-box"><div class="kicker" style="color:var(--accent)">Before you come</div>' + todos.map(function (t) {
        return '<div class="todo-row"><div><div style="font-weight:700">' + esc(t[0]) + '</div><div class="who-l">' + esc(t[1]) + '</div></div><a class="btn-todo" href="' + esc(t[2]) + '" target="_blank" rel="noopener">Open' + ICON.out + "</a></div>";
      }).join("") + "</div></div>";
  }

  function radarSvg() {
    var C = 170, R = 150, MAXMI = 17, k = R / MAXMI, cosLat = Math.cos(K.HOME.lat * Math.PI / 180);
    var s = '<svg class="radar" viewBox="0 0 340 340" role="img" aria-label="Map of places, with home at the center and rings every 5 miles">';
    [5, 10, 15].forEach(function (mi) {
      s += '<circle class="ring" cx="' + C + '" cy="' + C + '" r="' + (mi * k).toFixed(1) + '"/><text class="ringlbl" x="' + (C + 4) + '" y="' + (C - mi * k - 4).toFixed(1) + '">' + mi + " mi</text>";
    });
    s += '<text class="compass" x="' + C + '" y="12">N</text>';
    Object.keys(PL).forEach(function (key) {
      var p = PL[key], dy = (p.lat - K.HOME.lat) * 69.0, dx = (p.lon - K.HOME.lon) * 69.17 * cosLat;
      var dist = Math.sqrt(dx * dx + dy * dy), far = dist > MAXMI, sc = far ? (R + 8) / dist : k, x = C + dx * sc, y = C - dy * sc;
      if (far) s += '<line class="arrow" x1="' + (C + dx / dist * R * 0.88).toFixed(1) + '" y1="' + (C - dy / dist * R * 0.88).toFixed(1) + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>';
      s += '<g class="pin" data-place="' + key + '" role="button" tabindex="0" aria-label="' + esc(p.name) + ', directions"><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="11"/><text class="n" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '">' + p.n + '</text><text class="lbl" text-anchor="' + p.lbl[0] + '" x="' + (x + p.lbl[1]).toFixed(1) + '" y="' + (y + p.lbl[2]).toFixed(1) + '">' + esc(p.short) + "</text></g>";
    });
    return s + '<g class="home"><circle cx="' + C + '" cy="' + C + '" r="7"/><text x="' + C + '" y="' + (C + 22) + '">Home</text></g></svg>';
  }
  function mapView() {
    return '<div class="view-anim"><div class="map-head"><div class="kicker">Where we\'re going</div><h2 class="headline">Everything, from home</h2></div>' +
      '<div id="lmap" class="lmap" aria-label="Map"></div><div class="map-tools" id="map-tools"><button class="maplink" data-mapfit="near">Around home</button><button class="maplink" data-mapfit="all">Include the cabin</button></div>' +
      '<div class="fly-links"><div class="kicker">Live flight maps</div><div class="map-tools"><button class="maplink primary" data-go="fly-in">Wed arrivals</button><button class="maplink primary" data-go="fly-out">Sat departures</button></div></div>' +
      '<ol class="places">' + Object.keys(PL).map(function (key) {
        var p = PL[key];
        return '<li class="place"><span class="n">' + p.n + '</span><div><h3>' + esc(p.name) + '</h3><div class="when">' + esc(p.when) + '</div><div class="addr">' + esc(p.addr) + '</div><div class="drive">' + esc(p.drive) + " from home</div>" +
          '<div class="maplinks"><a class="maplink primary" href="' + appleUrl(p) + '" target="_blank" rel="noopener">Apple Maps</a><a class="maplink" href="' + googleUrl(p) + '" target="_blank" rel="noopener">Google Maps</a></div></div></li>';
      }).join("") + "</ol></div>";
  }
  var lmap = null;
  function initMap() {
    if (lmap) { lmap.remove(); lmap = null; }
    var el = document.getElementById("lmap"); if (!el) return;
    if (!window.L) {
      el.outerHTML = '<div class="radar-wrap">' + radarSvg() + '<div class="map-note">Pins sit at their real direction and distance from home. Tap one for directions. The cabin is off the edge, 46 miles southeast.</div></div>';
      var tools = document.getElementById("map-tools"); if (tools) tools.hidden = true;
      return;
    }
    lmap = L.map(el, { scrollWheelZoom: false, zoomControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(lmap);
    L.marker([K.HOME.lat, K.HOME.lon], { icon: L.divIcon({ className: "", html: '<span class="lhome">Home</span>', iconSize: [56, 22], iconAnchor: [28, 11] }), keyboard: false }).addTo(lmap);
    Object.keys(PL).forEach(function (key) {
      var p = PL[key];
      L.marker([p.lat, p.lon], { title: p.name, icon: L.divIcon({ className: "", html: '<span class="lpin">' + p.n + "</span>", iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -12] }) })
        .addTo(lmap)
        .bindPopup('<div class="lpop"><b>' + esc(p.name) + "</b><span>" + esc(p.when) + "</span><span>" + esc(p.drive) + ' from home</span><button class="dirbtn" data-popplace="' + key + '">Directions</button></div>');
    });
    lmap.on("popupopen", function (e) {
      var b = e.popup.getElement().querySelector("[data-popplace]");
      if (b) b.addEventListener("click", function () { openSheet(b.getAttribute("data-popplace")); });
    });
    fitMap("near");
  }
  function fitMap(mode) {
    if (!lmap) return;
    var pts = Object.keys(PL).filter(function (k) { return mode === "all" || k !== "cabin"; }).map(function (k) { return [PL[k].lat, PL[k].lon]; });
    pts.push([K.HOME.lat, K.HOME.lon]);
    lmap.fitBounds(pts, { padding: [28, 28] });
  }

  function prepView() {
    var t = now().getTime();
    var clockCard = today() === "2026-11-26"
      ? '<div class="now" id="kclock">' + kitchenClockInner() + "</div>"
      : (t < ms("2026-11-26T00:00") ? '<div class="teaser">On Thanksgiving morning this becomes a live kitchen clock: what\'s happening now, who\'s on it, and a countdown to the next step.</div>' : "");
    var dishes = Object.keys(ACTS).filter(function (id) { return ACTS[id].kind === "dish"; }), taken = dishes.filter(function (id) { return Cloud.who(id).length; }).length;
    var roles = '<div class="roles"><div class="menu-title">Who\'s making what · ' + taken + " of " + dishes.length + ' dishes claimed</div><div class="role-what">Sign up for a dish (up to 2 people each) and you own it start to finish: the make-ahead and the Thursday cooking. Your steps show up in the run sheet below and on your Highlights.</div>' +
      dishes.map(function (id) {
        var a = ACTS[id];
        return '<div class="role"><div class="role-who">' + esc(a.title) + '</div><div class="role-what">' + esc(a.what) + "</div>" + whoHtml(id, true) + "</div>";
      }).join("") + "</div>";
    return '<div class="view-anim"><div class="day-head"><div class="kicker">Kitchen + setup</div><h2 class="headline">Make it ahead, so Thursday is mostly reheating</h2></div>' + clockCard + roles +
      PREP.sections.map(function (s) { return '<h3 class="sec-head">' + esc(s.head) + "</h3>" + railHtml(s.items, s.date); }).join("") + "</div>";
  }

  function wallListHtml() {
    var w = Cloud.state.wall;
    if (!w.length) return '<p class="muted" style="margin-top:16px">No notes yet. Be the first.</p>';
    return '<ul class="wall">' + w.map(function (n) {
      return '<li class="note"><p>' + esc(n.text) + '</p><div class="note-meta"><b>' + esc(n.name) + "</b> · " + ago(n.ts) +
        (n.name === ME ? ' · <button class="linkbtn" data-unpost="' + esc(n.id) + '">Delete</button>' : "") + "</div></li>";
    }).join("") + "</ul>";
  }
  function thanksView() {
    var composer;
    if (Cloud.state.mode === "error") composer = '<div class="soon-box">Can\'t reach the wall right now. Try again in a bit.</div>';
    else if (!live()) composer = '<div class="soon-box">The wall opens soon. Start thinking about what you\'d write.</div>';
    else composer = '<form class="wall-form" id="wall-form"><label class="sec-label" for="wall-text">Add a note</label><textarea id="wall-text" maxlength="280" rows="3" placeholder="I\'m thankful for…"></textarea>' +
      '<div class="wall-row"><span>' + (ME ? "Posting as " + esc(ME) : "You'll pick your name first") + '</span><button class="btn-todo" type="submit">Post</button></div></form>';
    return '<div class="view-anim"><div class="day-head"><div class="kicker">Gratitude wall</div><h2 class="headline">What are you thankful for?</h2></div>' + composer +
      '<div class="map-tools"><button class="maplink" data-go="tv">Show on the TV</button></div><div id="wall-list">' + wallListHtml() + "</div></div>";
  }

  /* ---------- TV mode ---------- */
  var tvTimer = null, tvIdx = 0, tvSeen = {};
  function tvView() {
    return '<div class="tv"><div class="tv-top"><span class="tv-brand">Karjian <span class="x">×</span> Oh Thanksgiving</span><button class="maplink" data-go="thanks">Exit</button></div>' +
      '<div class="tv-stage" aria-live="polite"><p class="tv-note" id="tv-note"></p><div class="tv-name" id="tv-name"></div></div>' +
      '<div class="tv-foot"><div class="tv-qr" id="tv-qr"></div><div>Add yours: scan this, or open the app and tap Thanks.</div></div></div>';
  }
  function tvShow(force) {
    var note = document.getElementById("tv-note"), who = document.getElementById("tv-name"); if (!note) return;
    var w = Cloud.state.wall;
    if (!w.length) { note.textContent = "What are you thankful for?"; who.textContent = "Be the first to add a note."; return; }
    var fresh = w.filter(function (n) { return !tvSeen[n.id]; })[0];
    var n = fresh || w[tvIdx++ % w.length];
    tvSeen[n.id] = 1;
    note.classList.remove("in"); who.classList.remove("in"); void note.offsetWidth;
    note.textContent = n.text; who.textContent = n.name;
    note.classList.add("in"); who.classList.add("in");
  }
  function startTv() {
    stopTv(); tvShow(); tvTimer = setInterval(tvShow, 8000);
    var box = document.getElementById("tv-qr");
    var draw = function () { if (window.QRCode && box && !box.firstChild) new QRCode(box, { text: SITE + "#thanks", width: 120, height: 120, colorDark: "#0d1915", colorLight: "#f2eadb" }); };
    if (window.QRCode) draw(); else Cloud.loadScript("https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js").then(draw).catch(function () {});
  }
  function stopTv() { if (tvTimer) { clearInterval(tvTimer); tvTimer = null; } }


  /* ---------- pickleball tournament: doubles teams, pool play, semis, final ---------- */
  var PK = "pickle", COURTS = [["c1", "Indoor 6"], ["c2", "Indoor 7"]], SLOT_MIN = 15, BUDGET_MIN = 135;
  var pkResetArmed = false, pkResetTimer = null, pkEditing = {}, celebrated = {}, pkSel = null;
  function pkGame() { var g = Cloud.game(PK); return g && g.v === 2 ? g : {}; }
  function pkPlayers() { return Cloud.who("pickle"); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function names(a) { return (a || []).map(esc).join(" + "); }
  function getPath(o, path) { return path.split("/").reduce(function (x, k) { return x == null ? x : x[k]; }, o); }
  function pkOpen() { return live() && (today() >= "2026-11-27" || Cloud.state.mode === "mock" || !!OVERRIDE); }
  function tIds(g) { return Object.keys(g.teams || {}).sort(function (x, y) { return +x.slice(1) - +y.slice(1); }); }
  function tName(g, id) { var t = (g.teams || {})[id]; return t ? names(t.p) : "TBD"; }
  function hasMe(g, id) { var t = (g.teams || {})[id]; return !!(ME && t && t.p.indexOf(ME) >= 0); }
  function pkList(sched) {
    var s = sched || {};
    return Object.keys(s).map(function (k) { var x = {}; for (var f in s[k]) x[f] = s[k][f]; x.key = k; return x; }).sort(function (a, b) { return a.ord - b.ord; });
  }
  function pkDraw(players) {
    var p = shuffle(players.slice()), teams = {}, n = Math.floor(p.length / 2);
    for (var i = 0; i < n; i++) teams["t" + (i + 1)] = { p: [p[2 * i], p[2 * i + 1]] };
    if (p.length % 2 && n) teams["t" + n].p.push(p[p.length - 1]); // odd number: one team of three rotates
    return teams;
  }
  function circleRounds(ids) {
    var t = ids.slice(); if (t.length % 2) t.push(null);
    var n = t.length, rounds = [];
    for (var r = 0; r < n - 1; r++) {
      var rnd = [];
      for (var i = 0; i < n / 2; i++) { var a = t[i], b = t[n - 1 - i]; if (a && b) rnd.push(r % 2 ? [b, a] : [a, b]); }
      rounds.push(rnd);
      t.splice(1, 0, t.pop());
    }
    return rounds;
  }
  function slotsFor(pairs) { // greedy packing onto 2 courts, no team twice in a slot
    var q = pairs.slice(), slots = 0;
    while (q.length) {
      var used = {}, n = 0, i = 0;
      while (i < q.length && n < 2) { var g = q[i]; if (!used[g[0]] && !used[g[1]]) { used[g[0]] = used[g[1]] = 1; q.splice(i, 1); n++; } else i++; }
      slots++;
    }
    return slots;
  }
  function poSlots(T) { return T >= 4 ? 2 : T === 3 ? 1 : 0; }
  function pkPlan(ids) {
    var T = ids.length, base = circleRounds(ids), maxC = T <= 3 ? 3 : 2, rounds = [], best = null;
    for (var c = 0; c < maxC; c++) base.forEach(function (r) { rounds.push(c % 2 ? r.map(function (m) { return [m[1], m[0]]; }) : r); });
    for (var R = 1; R <= rounds.length; R++) {
      var list = [].concat.apply([], rounds.slice(0, R)), mins = (slotsFor(list) + poSlots(T)) * SLOT_MIN;
      if (!best || mins <= BUDGET_MIN) best = { list: list, mins: mins };
      if (mins > BUDGET_MIN) break;
    }
    return best;
  }
  function perTeam(pairs) {
    var c = {}; pairs.forEach(function (m) { c[m[0]] = (c[m[0]] || 0) + 1; c[m[1]] = (c[m[1]] || 0) + 1; });
    var v = Object.keys(c).map(function (k) { return c[k]; }); if (!v.length) return "0";
    var lo = Math.min.apply(null, v), hi = Math.max.apply(null, v); return lo === hi ? String(lo) : lo + "–" + hi;
  }
  function dur(m) { var h = Math.floor(m / 60), r = m % 60; return (h ? h + "h" : "") + (r ? (h ? " " : "") + r + "m" : ""); }
  function standings(g) {
    var st = {}; tIds(g).forEach(function (id) { st[id] = { id: id, gp: 0, w: 0, l: 0, pf: 0, pa: 0 }; });
    pkList(g.sched).forEach(function (x) {
      if (x.ph !== "pool" || !x.done) return;
      var A = st[x.a], B = st[x.b]; if (!A || !B) return;
      var sa = +x.sa || 0, sb = +x.sb || 0;
      A.gp++; B.gp++; A.pf += sa; A.pa += sb; B.pf += sb; B.pa += sa;
      if (sa > sb) { A.w++; B.l++; } else { B.w++; A.l++; }
    });
    return Object.keys(st).map(function (k) { return st[k]; }).sort(function (a, b) {
      var ra = a.gp ? a.w / a.gp : 0, rb = b.gp ? b.w / b.gp : 0;
      return (rb - ra) || ((b.pf - b.pa) - (a.pf - a.pa)) || (b.pf - a.pf) || (+a.id.slice(1) - +b.id.slice(1));
    });
  }
  function winner(x) { return (+x.sa > +x.sb) ? x.a : x.b; }
  function pkChampTeam(g) {
    var L = pkList(g.sched); if (!L.length) return null;
    var f = L.filter(function (x) { return x.ph === "final"; })[0];
    if (f) return f.done ? winner(f) : null;
    if (tIds(g).length === 2 && L.every(function (x) { return x.done; })) return standings(g)[0].id;
    return null;
  }
  function pkChamps(g) { var id = pkChampTeam(g); return id ? g.teams[id].p : null; }
  function nextFor(list, court) {
    var busy = {};
    list.forEach(function (x) { if (x.court && !x.done && x.court !== court) { busy[x.a] = 1; busy[x.b] = 1; } });
    for (var i = 0; i < list.length; i++) { var x = list[i]; if (!x.done && !x.court && !busy[x.a] && !busy[x.b]) return x; }
    return null;
  }
  function newGame(a, b, ph, ord, court) { return { a: a, b: b, ph: ph, ord: ord, sa: 0, sb: 0, done: false, court: court }; }
  /* scorekeepers: one per game, never someone in that game; random, spread evenly; swappable */
  function pkPool(g) {
    var seen = {}, out = [];
    pkPlayers().concat([].concat.apply([], tIds(g).map(function (id) { return g.teams[id].p; }))).forEach(function (n) { if (!seen[n]) { seen[n] = 1; out.push(n); } });
    return out;
  }
  function inGame(g, x) { return x ? (((g.teams || {})[x.a] || {}).p || []).concat((((g.teams || {})[x.b] || {}).p) || []) : []; }
  function refLoad(list) { var c = {}; list.forEach(function (x) { if (x.ref) c[x.ref] = (c[x.ref] || 0) + 1; }); return c; }
  function pickRef(pool, avoid, soft, load) {
    var ok = pool.filter(function (n) { return avoid.indexOf(n) < 0; }), pref = ok.filter(function (n) { return soft.indexOf(n) < 0; }), c = pref.length ? pref : ok;
    if (!c.length) return "";
    var min = Math.min.apply(null, c.map(function (n) { return load[n] || 0; })), pick = shuffle(c.filter(function (n) { return (load[n] || 0) === min; }))[0];
    load[pick] = (load[pick] || 0) + 1;
    return pick;
  }
  // When a game goes on court: its scorekeeper can't be playing on the other court, and the other
  // court's scorekeeper can't be playing in this game. Reassign either one if needed.
  function refFix(g, list, x, up) {
    var other = list.filter(function (y) { return y.court && !y.done && y.key !== x.key; })[0], load = refLoad(list), pool = pkPool(g);
    var busyX = inGame(g, x).concat(inGame(g, other));
    if (!x.ref || busyX.indexOf(x.ref) >= 0) { if (x.ref) load[x.ref]--; x.ref = pickRef(pool, busyX, [], load); up["sched/" + x.key + "/ref"] = x.ref; }
    if (other && other.ref && inGame(g, x).indexOf(other.ref) >= 0) { load[other.ref]--; other.ref = pickRef(pool, busyX.concat([x.ref]), [], load); up["sched/" + other.key + "/ref"] = other.ref; }
  }
  function phaseUpdates(g, list, up) {
    var T = tIds(g).length, maxOrd = list.reduce(function (m, x) { return Math.max(m, x.ord); }, 0);
    var pool = list.filter(function (x) { return x.ph === "pool"; }), semis = list.filter(function (x) { return x.ph === "semi"; }), fin = list.filter(function (x) { return x.ph === "final"; });
    if (pool.length && pool.every(function (x) { return x.done; }) && !semis.length && !fin.length) {
      var gg = { teams: g.teams, sched: {} }; list.forEach(function (x) { gg.sched[x.key] = x; });
      var seeds = standings(gg).map(function (s) { return s.id; });
      if (T >= 4) {
        var s1 = newGame(seeds[0], seeds[3], "semi", maxOrd + 1, "c1"), s2 = newGame(seeds[1], seeds[2], "semi", maxOrd + 2, "c2"), ld = refLoad(list), both = inGame(g, s1).concat(inGame(g, s2));
        s1.ref = pickRef(pkPool(g), both, [], ld); s2.ref = pickRef(pkPool(g), both.concat([s1.ref]), [], ld);
        up["sched/s1"] = s1; up["sched/s2"] = s2;
      } else if (T === 3) { var f3 = newGame(seeds[0], seeds[1], "final", maxOrd + 1, "c1"); f3.ref = pickRef(pkPool(g), inGame(g, f3), [], refLoad(list)); up["sched/f"] = f3; }
    }
    if (semis.length === 2 && semis.every(function (x) { return x.done; }) && !fin.length) { var fz = newGame(winner(semis[0]), winner(semis[1]), "final", maxOrd + 1, "c1"); fz.ref = pickRef(pkPool(g), inGame(g, fz), [], refLoad(list)); up["sched/f"] = fz; }
  }
  var PH = { pool: "Pool play", semi: "Semifinal", final: "Final" };
  function courtHtml(g, x, label, big) {
    var sa = +x.sa || 0, sb = +x.sb || 0, done = !!x.done, edit = !!pkEditing[x.key], live = !done || edit;
    function side(id, score, key, win) {
      return '<div class="team' + (done && win ? " win" : "") + (hasMe(g, id) ? " mine" : "") + '"><div class="tn">' + tName(g, id) + "</div>" +
        (!live || big ? '<div class="score fixed">' + score + "</div>"
          : '<div class="score"><button class="stp" data-pk="dec" data-path="sched/' + x.key + "/" + key + '" aria-label="Minus one">−</button><span>' + score + '</span><button class="stp" data-pk="inc" data-path="sched/' + x.key + "/" + key + '" aria-label="Plus one">+</button></div>') + "</div>";
    }
    var foot = "";
    if (!big) {
      if (!done) foot = '<div class="court-foot"><span class="muted small">To 11, win by 2</span><button class="joinbtn small" data-pk="done" data-key="' + x.key + '" data-court="' + esc(x.court || "") + '"' + (sa === sb ? " disabled" : "") + ">Game over</button></div>";
      else foot = '<div class="court-foot"><span class="status tag ok">Final ' + Math.max(sa, sb) + "–" + Math.min(sa, sb) + '</span><button class="linkbtn" data-pk="fix" data-key="' + x.key + '">' + (edit ? "Done fixing" : "Fix score") + "</button></div>";
    }
    return '<div class="court' + (big ? " big" : "") + (x.ph === "final" ? " final" : "") + '"><div class="court-h">' + esc(label) + " · " + PH[x.ph] + "</div>" + side(x.a, sa, "sa", sa > sb) + '<div class="vs">vs</div>' + side(x.b, sb, "sb", sb > sa) + refHtml(g, x, !big && !done) + foot + "</div>";
  }
  function refHtml(g, x, canEdit) {
    var who = x.ref || "", mine = !!ME && who === ME;
    if (!canEdit) return who ? '<div class="pk-ref' + (mine ? " me" : "") + '">Scorekeeper <b>' + esc(who) + "</b></div>" : "";
    var out = inGame(g, x);
    if (x.court) pkList(g.sched).forEach(function (y) { if (y.court && !y.done && y.key !== x.key) out = out.concat(inGame(g, y), y.ref ? [y.ref] : []); }); // busy on the other court right now
    var opts = pkPool(g).filter(function (n) { return out.indexOf(n) < 0 || n === who; });
    if (!opts.length) return '<div class="pk-ref muted">No one free, so the players keep score</div>';
    return '<label class="pk-ref' + (mine ? " me" : "") + '"><span>' + (mine ? "You're keeping score" : "Scorekeeper") + '</span><select data-pkref="' + x.key + '" aria-label="Scorekeeper for this game">' +
      (who ? "" : '<option value="">Pick someone</option>') + opts.map(function (n) { return "<option" + (n === who ? " selected" : "") + ">" + esc(n) + "</option>"; }).join("") + "</select></label>";
  }
  function champHtml(team) {
    return '<div class="champ"><div class="kicker">Pickleball champions</div><div class="champ-names">' + names(team) + '</div><div class="muted small">Bragging rights until next Thanksgiving.</div></div>';
  }
  function standingsHtml(g, limit) {
    var rows = standings(g).slice(0, limit || 99);
    if (!rows.length) return "";
    var any = rows.some(function (r) { return r.gp; });
    return '<table class="lb"><thead><tr><th>#</th><th>Team</th><th>W–L</th><th>+/−</th></tr></thead><tbody>' + rows.map(function (r, i) {
      var d = r.pf - r.pa;
      return '<tr' + (hasMe(g, r.id) ? ' class="me"' : "") + "><td>" + (i + 1) + "</td><td>" + tName(g, r.id) + "</td><td>" + r.w + "–" + r.l + "</td><td>" + (any ? (d > 0 ? "+" : "") + d : "–") + "</td></tr>";
    }).join("") + "</tbody></table>" + (tIds(g).length >= 4 ? '<p class="muted small">Top 4 after pool play go to the semifinals: #1 vs #4, #2 vs #3.</p>' : "");
  }
  function pkPace(g) {
    var L = pkList(g.sched), T = tIds(g).length; if (!L.length || pkChampTeam(g)) return "";
    var queued = L.filter(function (x) { return !x.done && !x.court && x.ph === "pool"; }).map(function (x) { return [x.a, x.b]; });
    var hasSemi = L.some(function (x) { return x.ph === "semi"; }), hasFinal = L.some(function (x) { return x.ph === "final"; });
    var po = hasFinal ? 0 : hasSemi ? 1 : poSlots(T), playing = L.some(function (x) { return x.court && !x.done; }) ? 0.5 : 0;
    var mins = (slotsFor(queued) + po + playing) * SLOT_MIN;
    return "On pace to finish around " + clock(new Date(now().getTime() + mins * 60000));
  }

  function pkSlots(g) { // [[names...], ...] in team order, plus players not on a team
    var teams = tIds(g).map(function (id) { return g.teams[id].p.slice(); });
    var on = {}; teams.forEach(function (t) { t.forEach(function (p) { on[p] = 1; }); });
    return { teams: teams, bench: pkPlayers().filter(function (p) { return !on[p]; }) };
  }
  function pkSaveTeams(g, teams) {
    var out = {}, n = 0;
    teams.forEach(function (t) { if (t.length) out["t" + (++n)] = { p: t }; });
    pkSel = null;
    Cloud.gameSet(PK, { v: 2, teams: out, at: g.at || Date.now() }).catch(function () { toast("Couldn't save that. Check your connection."); });
  }
  function pkFind(slots, name) {
    for (var i = 0; i < slots.teams.length; i++) { var j = slots.teams[i].indexOf(name); if (j >= 0) return { t: i, j: j }; }
    var b = slots.bench.indexOf(name); return b >= 0 ? { t: -1, j: b } : null;
  }
  function pkTap(name) {
    var g = pkGame();
    if (!pkSel) { pkSel = name; render(true); return; }
    if (pkSel === name) { pkSel = null; render(true); return; }
    var s = pkSlots(g), A = pkFind(s, pkSel), B = pkFind(s, name);
    if (!A || !B) { pkSel = null; render(true); return; }
    var arrA = A.t < 0 ? s.bench : s.teams[A.t], arrB = B.t < 0 ? s.bench : s.teams[B.t];
    arrA[A.j] = name; arrB[B.j] = pkSel;
    toast("Swapped " + pkSel + " and " + name + ".");
    pkSaveTeams(g, s.teams);
  }
  function pkMove(target) {
    var g = pkGame(), s = pkSlots(g), A = pkFind(s, pkSel); if (!A) return;
    (A.t < 0 ? s.bench : s.teams[A.t]).splice(A.j, 1);
    if (target === "new") s.teams.push([pkSel]); else s.teams[+target].push(pkSel);
    toast(pkSel + " moved.");
    pkSaveTeams(g, s.teams);
  }
  function teamEditorHtml(g) {
    var s = pkSlots(g), selIn = pkSel ? pkFind(s, pkSel) : null;
    function chip(n) { return '<button class="pk-chip' + (n === pkSel ? " sel" : "") + (n === ME ? " me" : "") + '" data-pkp="' + esc(n) + '">' + esc(n) + "</button>"; }
    var h = '<p class="muted small" style="margin-top:8px">Want to pick your own teams? <b>Tap two people to swap them</b>, or tap someone and then <b>Move here</b>. Teams lock when the first game starts.</p><div class="pk-teams">';
    s.teams.forEach(function (t, i) {
      var mineSel = selIn && selIn.t === i;
      h += '<div class="pk-team edit' + (mineSel ? " sel-team" : "") + '"><span class="n">' + (i + 1) + '</span><div class="pk-members">' + t.map(chip).join("") +
        (t.length < 2 ? '<span class="tag status wait">Needs a partner</span>' : t.length > 3 ? '<span class="tag status wait">4+ rotate two at a time</span>' : t.length === 3 ? '<span class="tag">Trio · rotates</span>' : "") + "</div>" +
        (pkSel && !mineSel ? '<button class="maplink small" data-pkmove="' + i + '">Move here</button>' : "") + "</div>";
    });
    if (pkSel) h += '<div class="pk-team edit ghost"><span class="n">+</span><div class="pk-members muted small">Start a new team with ' + esc(pkSel) + '</div><button class="maplink small" data-pkmove="new">New team</button></div>';
    h += "</div>";
    if (s.bench.length) h += '<div class="sec" style="margin-top:10px"><span class="sec-label">Not on a team yet</span><div class="pk-members">' + s.bench.map(chip).join("") + "</div></div>";
    return h;
  }
  function pickleView() {
    var g = pkGame(), L = pkList(g.sched), ids = tIds(g), players = pkPlayers(), champs = pkChamps(g), open = pkOpen();
    var h = '<div class="view-anim"><div class="day-head"><div class="kicker">Fri, Nov 27 · Picklewood · Indoor 6 + 7</div><h2 class="headline">Pickleball Tournament</h2></div>';
    if (champs) h += champHtml(champs);
    h += '<div class="pk-rules"><b>Doubles all the way.</b> Teams of two are drawn at random (with an odd number, one team of three rotates in). Pool play, then the top 4 teams play semifinals and a final. Games to 11, win by 2. Every game gets a scorekeeper who isn\'t playing, picked at random (tap the name to swap). The whole thing fits in about 2 hours. Running behind? Play to 9.</div>';
    if (!live()) return h + '<div class="soon-box">The tournament opens when sign-ups are live.</div></div>';

    if (!ids.length) {
      h += '<div class="sec" style="margin-top:14px"><div class="who-top"><span class="sec-label">Players</span><span class="cap">' + players.length + "</span></div>" + whoHtml("pickle", true) + "</div>";
      if (players.length >= 4) { var est = pkPlan(Array.apply(null, Array(Math.floor(players.length / 2))).map(function (_, i) { return "t" + (i + 1); })); h += '<p class="muted small">' + Math.floor(players.length / 2) + " teams · each plays " + perTeam(est.list) + " pool games · about " + dur(est.mins) + " total</p>"; }
      if (!open) h += '<div class="teaser">Teams get drawn at the courts on Friday.</div>';
      else if (players.length < 4) h += '<div class="teaser">Need at least 4 players. ' + players.length + " signed up so far.</div>";
      else h += '<div class="map-tools"><button class="btn-todo" data-pk="draw">Draw teams</button></div>';
      return h + "</div>";
    }

    if (!L.length && open) h += '<h3 class="sec-head">Teams</h3>' + teamEditorHtml(g);
    else h += '<h3 class="sec-head">Teams</h3><div class="pk-teams">' + ids.map(function (id, i) { return '<div class="pk-team' + (hasMe(g, id) ? " mine" : "") + '"><span class="n">' + (i + 1) + "</span>" + tName(g, id) + "</div>"; }).join("") + "</div>";

    if (!L.length) {
      var plan = pkPlan(ids);
      h += '<p class="muted small" style="margin-top:10px">' + ids.length + " teams · each plays " + perTeam(plan.list) + " pool games · about " + dur(plan.mins) + " including the playoffs</p>";
      h += '<div class="map-tools">' + (open ? '<button class="btn-todo" data-pk="start">Start the tournament</button><button class="maplink" data-pk="draw">Redraw teams</button>' : "") + '<button class="maplink" data-go="pickle-tv">Show on the TV</button></div>';
    } else {
      if (!champs) {
        h += '<div class="pk-pace">' + esc(pkPace(g)) + "</div>";
        h += COURTS.map(function (c) {
          var x = L.filter(function (y) { return y.court === c[0] && !y.done; })[0];
          return x ? courtHtml(g, x, c[1]) : '<div class="court idle"><div class="court-h">' + c[1] + '</div><span class="muted small">Free</span></div>';
        }).join("");
        var nextUp = L.filter(function (x) { return !x.done && !x.court; }).slice(0, 4);
        if (nextUp.length) h += '<h3 class="sec-head">Up next</h3><ol class="pk-next">' + nextUp.map(function (x) { return "<li><div>" + tName(g, x.a) + ' <span class="muted">vs</span> ' + tName(g, x.b) + "</div>" + refHtml(g, x, true) + "</li>"; }).join("") + "</ol>";
      }
      h += '<div class="map-tools"><button class="maplink" data-go="pickle-tv">Show on the TV</button></div>';
      h += '<h3 class="sec-head">Standings</h3>' + standingsHtml(g);
      var done = L.filter(function (x) { return x.done; }).reverse();
      if (done.length) h += '<details class="pk-past"' + (champs ? " open" : "") + "><summary>Results (" + done.length + ")</summary>" + done.map(function (x) { return courtHtml(g, x, (COURTS.filter(function (c) { return c[0] === x.court; })[0] || ["", "Court"])[1]); }).join("") + "</details>";
    }
    h += '<div style="margin-top:22px"><button class="linkbtn" data-pk="reset">' + (pkResetArmed ? "Tap again to erase the tournament" : "Start the tournament over") + "</button></div>";
    return h + "</div>";
  }
  function pickleTvView() {
    var g = pkGame(), L = pkList(g.sched), champs = pkChamps(g), main;
    if (champs) main = '<div class="tv-champ">' + champHtml(champs) + "</div>";
    else if (L.length) {
      main = COURTS.map(function (c) { var x = L.filter(function (y) { return y.court === c[0] && !y.done; })[0]; return x ? courtHtml(g, x, c[1], true) : ""; }).join("");
      var nx = L.filter(function (x) { return !x.done && !x.court; }).slice(0, 3);
      if (nx.length) main += '<div class="kicker" style="margin-top:2vh">Up next</div><ol class="pk-next">' + nx.map(function (x) { return "<li>" + tName(g, x.a) + ' <span class="muted">vs</span> ' + tName(g, x.b) + (x.ref ? ' <span class="muted small">· score: ' + esc(x.ref) + "</span>" : "") + "</li>"; }).join("") + "</ol>";
      main += '<div class="pk-pace">' + esc(pkPace(g)) + "</div>";
    } else if (tIds(g).length) main = '<div class="kicker">Teams</div><div class="pk-teams">' + tIds(g).map(function (id, i) { return '<div class="pk-team"><span class="n">' + (i + 1) + "</span>" + tName(g, id) + "</div>"; }).join("") + "</div>";
    else main = '<p class="tv-note">The tournament starts soon.</p>';
    return '<div class="tv pk-tv"><div class="tv-top"><span class="tv-brand">Pickleball Tournament</span><button class="maplink" data-go="pickle">Exit</button></div>' +
      '<div class="pk-tv-grid"><div class="pk-tv-main">' + main + '</div><div class="pk-tv-side"><div class="kicker">Standings</div>' + standingsHtml(g, 8) + "</div></div></div>";
  }
  function pkBannerHtml() {
    var g = pkGame(), L = pkList(g.sched), ch = pkChamps(g);
    if (ch) return '<button class="pk-banner" data-go="pickle"><span class="kicker">Pickleball champions</span><b>' + names(ch) + "</b></button>";
    if (!L.length) return "";
    var mine = ME && L.filter(function (x) { return !x.done && x.ref === ME; })[0];
    if (mine) { var ct = (COURTS.filter(function (c) { return c[0] === mine.court; })[0] || [])[1]; return '<button class="pk-banner" data-go="pickle"><span class="kicker">Pickleball · you\'re scorekeeper</span><b>' + (ct ? "Now, on " + ct : "Coming up soon") + "</b><span>" + tName(g, mine.a) + " vs " + tName(g, mine.b) + " →</span></button>"; }
    var ph = L.some(function (x) { return x.ph === "final"; }) ? "The final is on" : L.some(function (x) { return x.ph === "semi"; }) ? "Semifinals are on" : "Pool play in progress";
    return '<button class="pk-banner" data-go="pickle"><span class="kicker">Pickleball tournament</span><b>' + ph + "</b><span>Courts, scores + standings →</span></button>";
  }
  function pkAction(btn) {
    var act = btn.getAttribute("data-pk"), g = pkGame(), up = {}, path = btn.getAttribute("data-path"), key = btn.getAttribute("data-key");
    if (act === "inc" || act === "dec") { var v = +getPath(g, path) || 0; up[path] = Math.max(0, Math.min(40, v + (act === "inc" ? 1 : -1))); }
    else if (act === "fix") { pkEditing[key] = !pkEditing[key]; render(true); return; }
    else if (act === "draw") {
      pkSel = null;
      var pl = pkPlayers(); if (pl.length < 4) { toast("Need at least 4 players."); return; }
      Cloud.gameSet(PK, { v: 2, teams: pkDraw(pl), at: Date.now() }).catch(function () { toast("Couldn't save that. Check your connection."); }); return;
    }
    else if (act === "start") {
      var ids = tIds(g);
      if (ids.some(function (id) { return g.teams[id].p.length < 2; })) { toast("Every team needs at least 2 players."); return; }
      if (ids.length < 2) { toast("Need at least 2 teams."); return; }
      pkSel = null;
      var plan = pkPlan(ids), sched = {};
      plan.list.forEach(function (m, i) { sched["g" + (i < 9 ? "0" : "") + (i + 1)] = newGame(m[0], m[1], "pool", i + 1, ""); });
      var list = pkList(sched), pool = pkPool(g), load = {};
      list.forEach(function (x, i) { // random + even; softly avoid players in the neighbouring games (likely on the other court)
        var soft = inGame(g, list[i - 1]).concat(inGame(g, list[i + 1]));
        x.ref = sched[x.key].ref = pickRef(pool, inGame(g, x), soft, load);
      });
      COURTS.forEach(function (c) { var x = nextFor(list, c[0]); if (x) { x.court = c[0]; refFix(g, list, x, {}); } });
      list.forEach(function (x) { sched[x.key].court = x.court; sched[x.key].ref = x.ref; });
      up.sched = sched; up.startedAt = Date.now(); up.est = plan.mins;
    }
    else if (act === "done") {
      var court = btn.getAttribute("data-court"), list2 = pkList(g.sched);
      up["sched/" + key + "/done"] = true;
      list2.forEach(function (x) { if (x.key === key) x.done = true; });
      if (court) { var nx = nextFor(list2, court); if (nx) { up["sched/" + nx.key + "/court"] = court; nx.court = court; refFix(g, list2, nx, up); } }
      phaseUpdates(g, list2, up);
    }
    else if (act === "reset") {
      if (!pkResetArmed) { pkResetArmed = true; clearTimeout(pkResetTimer); pkResetTimer = setTimeout(function () { pkResetArmed = false; render(true); }, 5000); render(true); return; }
      pkResetArmed = false; Cloud.gameSet(PK, null).catch(function () { toast("Couldn't reset. Check your connection."); }); return;
    }
    Cloud.gameUpdate(PK, up).catch(function () { toast("Couldn't save that. Check your connection."); });
  }
  function maybeConfetti() {
    var c = pkChamps(pkGame()); if (!c) return;
    var key = c.join("+"); if (celebrated[key]) return; celebrated[key] = true;
    try { if (sessionStorage.getItem("kxo.conf." + key)) return; sessionStorage.setItem("kxo.conf." + key, "1"); } catch (e) {}
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var cv = document.createElement("canvas"); cv.className = "confetti"; document.body.appendChild(cv);
    var ctx = cv.getContext("2d"), W = cv.width = innerWidth, H = cv.height = innerHeight, cols = ["#e45b6b", "#f6c453", "#8bd0a3", "#f2eadb"], parts = [];
    for (var i = 0; i < 160; i++) parts.push({ x: Math.random() * W, y: -20 - Math.random() * H * 0.5, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4, r: 4 + Math.random() * 5, a: Math.random() * 6, c: cols[i % 4] });
    var t0 = Date.now();
    (function frame() {
      ctx.clearRect(0, 0, W, H);
      parts.forEach(function (p) { p.x += p.vx; p.y += p.vy; p.a += 0.15; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore(); });
      if (Date.now() - t0 < 4000) requestAnimationFrame(frame); else cv.parentNode.removeChild(cv);
    })();
  }

  /* ---------- photo stream ---------- */
  var dayLblFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric" });
  function stampLabel(ts) { var d = new Date(ts); return dowFmt.format(d) + " " + clock(d); }
  function compress(file, max, q) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, max / Math.max(w, h));
        var cv = document.createElement("canvas"); cv.width = Math.round(w * s); cv.height = Math.round(h * s);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        res({ d: cv.toDataURL("image/jpeg", q), w: cv.width, h: cv.height });
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("Couldn't read that image")); };
      img.src = url;
    });
  }
  function uploadFiles(files) {
    if (!ME) { pickMe(function () { uploadFiles(files); }); return; }
    var list = Array.prototype.slice.call(files).filter(function (f) { return /^image\//.test(f.type) || /\.(jpe?g|png|heic|webp)$/i.test(f.name); });
    if (!list.length) return;
    var done = 0, failed = 0;
    toast("Adding " + list.length + " photo" + (list.length > 1 ? "s" : "") + "…");
    list.reduce(function (p, f) {
      return p.then(function () {
        return Promise.all([compress(f, 1600, 0.72), compress(f, 360, 0.6)]).then(function (r) {
          return Cloud.addPhoto({ name: ME, thumb: r[1].d, w: r[0].w, h: r[0].h }, r[0].d);
        }).then(function () { done++; }, function () { failed++; });
      });
    }, Promise.resolve()).then(function () {
      toast(failed ? "Added " + done + ", " + failed + " didn't upload." : "Added " + done + " photo" + (done > 1 ? "s" : "") + ". Thanks, " + ME + "!");
    });
  }
  function photosView() {
    var ph = Cloud.state.photos;
    var h = '<div class="view-anim"><div class="day-head"><div class="kicker">Photo stream</div><h2 class="headline">Every moment, from every phone</h2></div>';
    if (Cloud.state.mode === "error") h += '<div class="soon-box">Can\'t reach the photo stream right now. Try again in a bit.</div>';
    else if (!live()) h += '<div class="soon-box">The photo stream opens soon.</div>';
    else h += '<div class="map-tools"><button class="btn-todo" data-addphoto>Add photos</button><button class="maplink" data-go="photos-tv">Show on the TV</button></div>' +
      '<p class="muted small">Photos are shrunk on your phone before upload, so they\'re quick to share. Anyone with the app can see them.</p>';
    if (!ph.length) return h + (live() ? '<p class="muted" style="margin-top:16px">No photos yet. Start with the arrivals.</p>' : "") + "</div>";
    var groups = [], cur = null;
    ph.forEach(function (p) { var k = ptFmt.format(new Date(p.ts)); if (!cur || cur.k !== k) { cur = { k: k, lbl: dayLblFmt.format(new Date(p.ts)), items: [] }; groups.push(cur); } cur.items.push(p); });
    return h + groups.map(function (g) {
      return '<h3 class="sec-head">' + esc(g.lbl) + ' <span class="muted small">' + g.items.length + '</span></h3><div class="pgrid">' + g.items.map(function (p) {
        return '<button class="pthumb" data-photo="' + esc(p.id) + '" aria-label="Photo by ' + esc(p.name) + '"><img src="' + p.thumb + '" alt="" loading="lazy"><span>' + esc(p.name) + "</span></button>";
      }).join("") + "</div>";
    }).join("") + "</div>";
  }
  function photoStripHtml() {
    var ph = Cloud.state.photos.slice(0, 8); if (!ph.length) return "";
    return '<button class="pstrip" data-go="photos"><div class="pstrip-h"><span class="kicker">Latest photos</span><span class="muted small">' + Cloud.state.photos.length + " so far →</span></div><div class=\"pstrip-row\">" +
      ph.map(function (p) { return '<img src="' + p.thumb + '" alt="">'; }).join("") + "</div></button>";
  }
  var lbId = null;
  function openPhoto(id) {
    var p = Cloud.state.photos.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    lbId = id;
    var sc = document.getElementById("photo-scrim"), img = document.getElementById("lb-img");
    img.src = p.thumb; img.alt = "Photo by " + p.name;
    document.getElementById("lb-cap").textContent = p.name + " · " + stampLabel(p.ts);
    document.getElementById("lb-del").hidden = p.name !== ME;
    sc.hidden = false;
    Cloud.getPhoto(id).then(function (d) { if (d && lbId === id) img.src = d; });
  }
  function closePhoto() { document.getElementById("photo-scrim").hidden = true; lbId = null; }

  var ptvTimer = null, ptvIdx = 0, ptvSeen = {}, ptvLayer = 0;
  function photosTvView() {
    return '<div class="tv ptv"><div class="tv-top"><span class="tv-brand">Karjian <span class="x">×</span> Oh Thanksgiving</span><button class="maplink" data-go="photos">Exit</button></div>' +
      '<div class="ptv-stage"><img class="ptv-img" id="ptv-a" alt=""><img class="ptv-img" id="ptv-b" alt=""><p class="tv-note" id="ptv-empty" hidden>Add the first photo from your phone.</p></div>' +
      '<div class="tv-foot"><div class="tv-qr" id="tv-qr"></div><div><div class="ptv-cap" id="ptv-cap"></div><div>Add yours: scan this, or open the app and tap Photos.</div></div></div></div>';
  }
  function ptvShow() {
    var ph = Cloud.state.photos, empty = document.getElementById("ptv-empty"); if (!empty) return;
    empty.hidden = !!ph.length; if (!ph.length) return;
    var fresh = ph.filter(function (p) { return !ptvSeen[p.id]; }).slice(-1)[0];
    var p = fresh || ph[ptvIdx++ % ph.length]; ptvSeen[p.id] = 1;
    Cloud.getPhoto(p.id).then(function (d) {
      var next = document.getElementById(ptvLayer ? "ptv-a" : "ptv-b"), prev = document.getElementById(ptvLayer ? "ptv-b" : "ptv-a");
      if (!next) return;
      next.onload = function () { next.classList.add("on"); prev.classList.remove("on"); ptvLayer = 1 - ptvLayer; document.getElementById("ptv-cap").textContent = p.name + " · " + stampLabel(p.ts); };
      next.src = d || p.thumb;
    });
  }
  function startPtv() {
    stopPtv(); ptvShow(); ptvTimer = setInterval(ptvShow, 7000);
    var box = document.getElementById("tv-qr");
    var draw = function () { if (window.QRCode && box && !box.firstChild) new QRCode(box, { text: SITE + "#photos", width: 120, height: 120, colorDark: "#0d1915", colorLight: "#f2eadb" }); };
    if (window.QRCode) draw(); else Cloud.loadScript("https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js").then(draw).catch(function () {});
  }
  function stopPtv() { if (ptvTimer) { clearInterval(ptvTimer); ptvTimer = null; } }


  /* ---------- karaoke: song picker + shared set list ---------- */
  var KQ = "karaoke", SONGS = window.KXO_SONGS || [];
  var VIBES = [["party", "Party anthem"], ["ballad", "Ballad"], ["duet", "Duet"], ["group", "Everyone sings"], ["rock", "Rock"], ["pop", "Pop"], ["country", "Country"], ["soul", "R&B + soul"], ["musical", "Disney + musicals"], ["kpop", "K-pop"], ["rap", "Rap"]];
  var DECADES = [["60", "60s + earlier"], ["70", "70s"], ["80", "80s"], ["90", "90s"], ["00", "2000s"], ["10", "2010s"], ["20", "2020s"]];
  var LEVELS = [["easy", "Keep it easy"], ["any", "Medium is fine"], ["belt", "I can belt it"]];
  var kp = (function () { try { return JSON.parse(localStorage.getItem("kxo.kpick")) || null; } catch (e) { return null; } })() || { v: [], d: [], lv: "easy", q: "" };
  var kSeed = Math.random();
  function kSave() { try { localStorage.setItem("kxo.kpick", JSON.stringify(kp)); } catch (e) {} }
  function decadeOf(y) { return y < 1970 ? "60" : y < 1980 ? "70" : y < 1990 ? "80" : y < 2000 ? "90" : y < 2010 ? "00" : y < 2020 ? "10" : "20"; }
  function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
  function kItems() { var q = (Cloud.game(KQ) || {}).q || {}; return Object.keys(q).map(function (k) { var x = {}; for (var f in q[k]) x[f] = q[k][f]; x.id = k; return x; }); }
  function kQueue() { // fair rotation: everyone's 1st song, then everyone's 2nd...
    var pend = kItems().filter(function (x) { return !x.done; }).sort(function (a, b) { return a.ts - b.ts; });
    var by = {}, order = [];
    pend.forEach(function (x) { if (!by[x.who]) { by[x.who] = []; order.push(x.who); } by[x.who].push(x); });
    var out = [], more = true;
    for (var r = 0; more; r++) { more = false; order.forEach(function (w) { if (by[w][r]) { out.push(by[w][r]); more = true; } }); }
    return out;
  }
  function kOnList(title) { return kItems().some(function (x) { return !x.done && x.who === ME && norm(x.title) === norm(title); }); }
  function kScore(s) {
    var tags = s[3].split(" "), sc = 0, q = norm(kp.q);
    kp.v.forEach(function (v) { if (tags.indexOf(v) >= 0) sc += 3; });
    if (kp.d.length && kp.d.indexOf(decadeOf(s[2])) >= 0) sc += 3;
    if (q && (norm(s[1]).indexOf(q) >= 0 || norm(s[0]).indexOf(q) >= 0)) sc += 8;
    if (kp.lv === "easy") sc += s[4] === 1 ? 2 : s[4] === 3 ? -3 : 0;
    else if (kp.lv === "any") sc += s[4] === 3 ? -1 : 0;
    else sc += s[4] === 3 ? 1 : 0;
    var h = Math.sin((s[0].length * 31 + s[2]) * (kSeed + 1)) * 0.5; // stable shuffle for ties
    return sc + h;
  }
  function kResultsHtml() {
    var ranked = SONGS.slice().sort(function (a, b) { return kScore(b) - kScore(a); }).slice(0, 8);
    var diff = ["", "Easy", "Medium", "Big voice"];
    return ranked.map(function (s) {
      var on = kOnList(s[0]);
      return '<div class="ksong"><div class="ksong-t"><b>' + esc(s[0]) + "</b><span>" + esc(s[1]) + " · " + s[2] + '</span><span class="kdiff d' + s[4] + '">' + diff[s[4]] + "</span></div>" +
        (on ? '<span class="tag status ok">On your list</span>' : '<button class="joinbtn small" data-ksing="' + esc(s[0]) + '" data-kartist="' + esc(s[1]) + '">I\'ll sing this</button>') + "</div>";
    }).join("");
  }
  function chipRow(list, sel, key, single) {
    return '<div class="kchips">' + list.map(function (c) {
      var on = single ? sel === c[0] : sel.indexOf(c[0]) >= 0;
      return '<button class="kchip' + (on ? " on" : "") + '" data-kchip="' + key + ":" + c[0] + '" aria-pressed="' + on + '">' + esc(c[1]) + "</button>";
    }).join("") + "</div>";
  }
  function setRowHtml(x, i, big) {
    var mine = x.who === ME;
    return '<li class="kq' + (big ? " now" : "") + '"><span class="kq-n">' + (big ? "Up now" : i) + '</span><div class="kq-b"><b>' + esc(x.who) + "</b><span>" + esc(x.title) + (x.artist ? " · " + esc(x.artist) : "") + "</span></div>" +
      (big ? '<div class="kq-act"><button class="btn-todo" data-kdone="' + esc(x.id) + '">Done, next singer</button><button class="linkbtn" data-kskip="' + esc(x.id) + '">Skip for now</button></div>'
        : (mine ? '<button class="linkbtn" data-kdel="' + esc(x.id) + '" aria-label="Remove">Remove</button>' : "")) + "</li>";
  }
  function karaokeView() {
    var h = '<div class="view-anim"><div class="day-head"><div class="kicker">Thu, Nov 26 · after dinner</div><h2 class="headline">Karaoke Night</h2></div>';
    if (Cloud.state.mode === "error") return h + '<div class="soon-box">Can\'t reach the set list right now. Try again in a bit.</div></div>';
    if (!live()) return h + '<div class="soon-box">The karaoke set list opens soon.</div></div>';
    var q = kQueue();
    h += '<div class="now kset"><div class="kicker">Tonight\'s set list · ' + q.length + " to go</div>";
    if (q.length) {
      h += '<ol class="kqlist">' + setRowHtml(q[0], 0, true) + q.slice(1).map(function (x, i) { return setRowHtml(x, i + 1); }).join("") + "</ol>";
    } else h += '<p class="now-sub">No songs yet. Pick one below and you\'re first up.</p>';
    h += '<div class="map-tools"><button class="maplink" data-go="karaoke-tv">Show on the TV</button></div><p class="muted small">Everyone gets a turn before anyone sings twice. Find the song in Ikarao when you\'re up.</p></div>';
    h += '<h3 class="sec-head">Find your song</h3><p class="muted small">Pick a vibe and a decade or two. We\'ll suggest easy crowd-pleasers.</p>' +
      '<div class="sec-label" style="margin-top:10px">Vibe</div>' + chipRow(VIBES, kp.v, "v") +
      '<div class="sec-label" style="margin-top:10px">Decades</div>' + chipRow(DECADES, kp.d, "d") +
      '<div class="sec-label" style="margin-top:10px">Comfort</div>' + chipRow(LEVELS, kp.lv, "lv", true) +
      '<label class="sec-label" for="kq" style="display:block;margin-top:10px">An artist you love (optional)</label><input id="kq" class="kinput" type="search" autocomplete="off" placeholder="Taylor Swift, ABBA, Queen…" value="' + esc(kp.q) + '">' +
      '<div id="kresults" class="kresults">' + kResultsHtml() + '</div><div class="map-tools"><button class="maplink" data-kmore>More ideas</button></div>' +
      '<details class="kcustom"><summary>Not on the list? Add any song</summary><form id="kform"><input class="kinput" id="ktitle" placeholder="Song title" required><input class="kinput" id="kartist" placeholder="Artist"><button class="btn-todo" type="submit">Add to the set list</button></form></details>';
    return h + "</div>";
  }
  function karaokeTvView() {
    var q = kQueue(), main;
    if (!q.length) main = '<p class="tv-note">Who\'s first? Add a song from your phone.</p>';
    else main = '<div class="kicker">Now singing</div><p class="tv-note">' + esc(q[0].who) + '</p><div class="tv-name">' + esc(q[0].title) + (q[0].artist ? " · " + esc(q[0].artist) : "") + "</div>" +
      (q.length > 1 ? '<div class="kicker" style="margin-top:4vh">Up next</div><ol class="pk-next">' + q.slice(1, 5).map(function (x) { return "<li><b>" + esc(x.who) + "</b> · " + esc(x.title) + "</li>"; }).join("") + "</ol>" : "");
    return '<div class="tv ktv"><div class="tv-top"><span class="tv-brand">Karaoke Night</span><button class="maplink" data-go="karaoke">Exit</button></div><div class="tv-stage">' + main + '</div>' +
      '<div class="tv-foot"><div class="tv-qr" id="tv-qr"></div><div>Add your song: scan this, or open the app → Karaoke.</div></div></div>';
  }
  function kAdd(title, artist) {
    if (!ME) { pickMe(function () { kAdd(title, artist); }); return; }
    var id = "k" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), up = {};
    up["q/" + id] = { who: ME, title: title, artist: artist || "", ts: Date.now(), done: false };
    Cloud.gameUpdate(KQ, up).then(function () {
      var q = kQueue(), pos = q.map(function (x) { return x.id; }).indexOf(id);
      toast(pos === 0 ? "You're up first!" : "Added. You're #" + (pos + 1) + " in line.");
    }, function () { toast("Couldn't add that. Check your connection."); });
  }
  function kRefreshResults() { var r = document.getElementById("kresults"); if (r) r.innerHTML = kResultsHtml(); }
  function kTvQr() {
    var box = document.getElementById("tv-qr");
    var draw = function () { if (window.QRCode && box && !box.firstChild) new QRCode(box, { text: SITE + "#karaoke", width: 120, height: 120, colorDark: "#0d1915", colorLight: "#f2eadb" }); };
    if (window.QRCode) draw(); else Cloud.loadScript("https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js").then(draw).catch(function () {});
  }
  function kBannerHtml() {
    var q = kQueue(); if (!q.length) return "";
    return '<button class="pk-banner kb" data-go="karaoke"><span class="kicker">Karaoke set list</span><b>Up now: ' + esc(q[0].who) + "</b><span>" + esc(q[0].title) + " · " + q.length + " to go →</span></button>";
  }

  /* ---------- live flight maps (Wed arrivals + Sat departures) ---------- */
  // Route map: great-circle paths, ETD/ETA chips, and planes placed by the schedule clock.
  // Live radar: real ADS-B positions from adsb.lol (embeds fine; its API blocks browser calls).
  var AP = {
    SEA: { city: "Seattle", lat: 47.4502, lon: -122.3088 },
    LAX: { city: "Los Angeles", lat: 33.9416, lon: -118.4085 },
    STL: { city: "St. Louis", lat: 38.7487, lon: -90.3700 },
    OAK: { city: "Oakland", lat: 37.7126, lon: -122.2197 }
  };
  var FLYCOL = ["#f6c453", "#e45b6b", "#7cc8f2"];
  var APCHIP = { SEA: "above", OAK: "right", LAX: "below", STL: "below" }; // label side, so West Coast chips don't collide
  var FLYDIR = { "fly-in": "arr", "fly-out": "dep" };
  var flyTab = Q.get("radar") ? "radar" : "route", fmap = null, fLayer = null, flyTimer = null;
  function flyList(dir) { return K.FLIGHTS.filter(function (f) { return f.dir === dir && f.cs && AP[f.from] && AP[f.to]; }); }
  function flyColor(f) { var l = flyList(f.dir); return FLYCOL[l.indexOf(f) % FLYCOL.length]; }
  function tz(s) { return /\b[A-Z]T$/.test(s) ? s : s + " PT"; }
  var RAD = Math.PI / 180;
  function gcPoint(a, b, f) {
    var p1 = a.lat * RAD, l1 = a.lon * RAD, p2 = b.lat * RAD, l2 = b.lon * RAD;
    var d = 2 * Math.asin(Math.sqrt(Math.pow(Math.sin((p2 - p1) / 2), 2) + Math.cos(p1) * Math.cos(p2) * Math.pow(Math.sin((l2 - l1) / 2), 2)));
    if (!d) return [a.lat, a.lon];
    var A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    var x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
    var y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
    var z = A * Math.sin(p1) + B * Math.sin(p2);
    return [Math.atan2(z, Math.sqrt(x * x + y * y)) / RAD, Math.atan2(y, x) / RAD];
  }
  function gcLine(a, b, f0, f1) { var pts = [], n = 48; for (var i = 0; i <= n; i++) pts.push(gcPoint(a, b, f0 + (f1 - f0) * i / n)); return pts; }
  function bearing(p, q) {
    var p1 = p[0] * RAD, p2 = q[0] * RAD, dl = (q[1] - p[1]) * RAD;
    return (Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) / RAD + 360) % 360;
  }
  function flyState(f, t) {
    var d = ms(f.dep), a = ms(f.arr), TAXI = 12 * 60000, s = { d: d, a: a, frac: 0 };
    if (t < d - 3 * 3600000) { s.k = "sched"; s.label = "Scheduled"; s.c = "wait"; }
    else if (t < d) { s.k = "soon"; s.label = "Departs soon"; s.c = "wait"; }
    else if (t < a) { s.k = "air"; s.label = "En route"; s.c = "ok"; s.frac = Math.max(0, Math.min(1, (t - d - TAXI) / (a - d - 2 * TAXI))); }
    else if (t < a + 45 * 60000) { s.k = "landed"; s.label = "Landing now"; s.c = "ok"; s.frac = 1; }
    else { s.k = "done"; s.label = "Arrived"; s.c = "ok"; s.frac = 1; }
    return s;
  }
  function flyAirborne(list, t) { return list.some(function (f) { var s = flyNow(f, t); return s.k === "air" || s.k === "soon"; }); }

  /* live positions via the Apps Script relay (window.KXO_LIVE); schedule clock is the fallback */
  var LIVE_URL = Q.get("liveurl") || window.KXO_LIVE || "", FLYTEST = (Q.get("flytest") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  var LIVE = { ac: {}, at: 0, ok: null }, trails = {}, liveTimer = null, liveBusy = false;
  function csOf(f) { return FLYTEST && flyList(f.dir)[0] === f ? FLYTEST : f.cs; }
  function isTest(f) { return csOf(f) !== f.cs; }
  function liveOn() { return !!LIVE_URL && (!OVERRIDE || !!FLYTEST); }
  function liveWanted(f) { if (isTest(f)) return true; var t = Date.now(); return t >= ms(f.dep) - 3600000 && t <= ms(f.arr) + 3 * 3600000; }
  function kmBetween(p, q) {
    var p1 = p[0] * RAD, p2 = q[0] * RAD, dp = p2 - p1, dl = (q[1] - p[1]) * RAD;
    return 2 * 6371 * Math.asin(Math.sqrt(Math.pow(Math.sin(dp / 2), 2) + Math.cos(p1) * Math.cos(p2) * Math.pow(Math.sin(dl / 2), 2)));
  }
  function alongRoute(a, b, pt) {
    var A = [a.lat, a.lon], B = [b.lat, b.lon], d13 = kmBetween(A, pt) / 6371, D = kmBetween(A, B);
    var dth = (bearing(A, pt) - bearing(A, B)) * RAD, xt = Math.asin(Math.sin(d13) * Math.sin(dth));
    var at = Math.acos(Math.max(-1, Math.min(1, Math.cos(d13) / Math.cos(xt)))) * 6371 * (Math.cos(dth) < 0 ? -1 : 1);
    return { xt: xt * 6371, at: at, D: D };
  }
  function livePos(f) {
    if (!liveOn()) return null;
    var d = LIVE.ac[csOf(f)]; if (!d || !d.found) return null;
    if (Date.now() - (d.at || 0) - (d.age || 0) * 1000 > 5 * 60000) return null;
    var a = AP[f.from], b = AP[f.to], pt = [d.lat, d.lon], g = alongRoute(a, b, pt);
    if (!isTest(f)) {
      if (Math.abs(g.xt) > 350 || g.at < -100 || g.at > g.D + 100) return null;
      if (!d.gnd && d.trk != null) { var rb = bearing(pt, [b.lat, b.lon]), dd = Math.abs(((d.trk - rb) % 360 + 540) % 360 - 180); if (dd > 110 && kmBetween(pt, [b.lat, b.lon]) > 60) return null; }
    }
    var remain = kmBetween(pt, [b.lat, b.lon]);
    return { lat: d.lat, lon: d.lon, trk: d.trk, alt: d.alt, gs: d.gs, gnd: d.gnd, src: d.src, frac: Math.max(0, Math.min(1, g.at / g.D)), remain: remain,
      eta: !d.gnd && d.gs > 120 ? Date.now() + (remain / (d.gs * 1.852)) * 3600000 + 7 * 60000 : null };
  }
  function flyNow(f, t) {
    var s = flyState(f, t), lp = livePos(f);
    if (!lp) return s;
    s.live = lp;
    if (lp.gnd) { if (lp.frac > 0.5) { s.k = "landed"; s.label = "Landed"; s.c = "ok"; s.frac = 1; } else { s.k = "soon"; s.label = "Taxiing"; s.c = "wait"; s.frac = 0; } }
    else { s.k = "air"; s.label = "Live"; s.c = "ok live"; s.frac = lp.frac; }
    return s;
  }
  function liveLine(lp) {
    if (lp.gnd) return "";
    var bits = [];
    if (lp.alt) bits.push(Math.round(lp.alt / 100) * 100 >= 1000 ? (Math.round(lp.alt / 100) * 100).toLocaleString("en-US") + " ft" : lp.alt + " ft");
    if (lp.gs) bits.push(Math.round(lp.gs * 1.151) + " mph");
    if (lp.eta) bits.push("lands ≈ " + clock(new Date(lp.eta)) + " PT");
    return bits.join(" · ");
  }
  function livePoll() {
    var r = route(); if (!FLYDIR[r] || !liveOn() || liveBusy) return;
    var want = flyList(FLYDIR[r]).filter(liveWanted).map(csOf);
    if (!want.length) { LIVE.idle = true; flyRefresh(); return; }
    LIVE.idle = false; liveBusy = true;
    fetch(LIVE_URL + (LIVE_URL.indexOf("?") < 0 ? "?" : "&") + "cs=" + want.join(","), { cache: "no-store" })
      .then(function (res) { return res.json(); })
      .then(function (d) {
        if (!d || !d.ok || !d.ac) throw new Error("bad");
        LIVE.ok = true; LIVE.at = Date.now();
        Object.keys(d.ac).forEach(function (cs) {
          var v = d.ac[cs]; LIVE.ac[cs] = v;
          if (v && v.found) { var tr = trails[cs] = trails[cs] || [], last = tr[tr.length - 1]; if (!last || last[0] !== v.lat || last[1] !== v.lon) tr.push([v.lat, v.lon]); if (tr.length > 400) tr.shift(); }
        });
      })
      .catch(function () { LIVE.ok = false; })
      .then(function () { liveBusy = false; flyRefresh(); });
  }
  function liveStatusHtml(dir) {
    if (!liveOn()) return '<span class="fl-dot"></span>Planes move on the schedule clock. For delays and gates, use FlightAware. For the real plane, switch to Live radar.';
    var list = flyList(dir), tracked = list.filter(function (f) { return !!livePos(f); }), n = tracked.length;
    var srcs = tracked.map(function (f) { return LIVE.ac[csOf(f)].src; }).filter(function (x, i, arr) { return x && arr.indexOf(x) === i; });
    if (LIVE.idle || LIVE.ok === null && !list.some(liveWanted)) return '<span class="fl-dot"></span>Live tracking switches on an hour before each departure. Until then, planes follow the schedule.';
    if (LIVE.ok === null) return '<span class="fl-dot"></span>Connecting to live tracking…';
    if (!LIVE.ok) return '<span class="fl-dot"></span>Live tracking is unreachable right now, so planes follow the schedule. FlightAware has the official status.';
    var ago = Math.max(0, Math.round((Date.now() - LIVE.at) / 1000));
    return n
      ? '<span class="fl-dot on"></span><b>Live:</b> ' + n + " of " + list.length + " planes tracked · updated " + ago + "s ago" + (srcs.length ? " via " + esc(srcs.join(" + ")) : "") + ". Any others follow the schedule."
      : '<span class="fl-dot on"></span>Live tracking is on. No transponder signal yet, so planes follow the schedule. They show up once a plane is at the gate or taxiing.';
  }
  function flyRefresh() {
    var rr = route(); if (!FLYDIR[rr]) return;
    if (flyTab === "route") drawFlights(rr);
    var c = document.getElementById("fcards"); if (c) c.innerHTML = fcardsHtml(FLYDIR[rr]);
    var st = document.getElementById("flylive"); if (st) st.innerHTML = liveStatusHtml(FLYDIR[rr]);
    var dot = document.querySelector(".livedot"); if (dot) dot.classList.toggle("on", flyAirborne(flyList(FLYDIR[rr]), now().getTime()));
  }
  function fcardsHtml(dir) {
    var t = now().getTime();
    return flyList(dir).map(function (f) {
      var s = flyNow(f, t), c = flyColor(f), drv = Cloud.who(f.drive)[0], pct = (s.frac * 100).toFixed(1), lp = s.live;
      var line = lp ? (lp.gnd ? (s.k === "landed" ? (f.dir === "arr" ? "On the ground at " + f.to + ". Head to arrivals." : "Landed in " + f.to + ".") : "On the ground at " + f.from + ", taxiing or at the gate.") : liveLine(lp))
        : s.k === "sched" ? "Departs " + tz(f.etd) + " · lands " + tz(f.eta)
        : s.k === "soon" ? 'Wheels up <b data-until="' + s.d + '" data-fmt="in">' + inText(s.d - t) + "</b>"
        : s.k === "air" ? 'Lands <b data-until="' + s.a + '" data-fmt="in">' + inText(s.a - t) + "</b> (on schedule)"
        : f.dir === "arr" ? "Scheduled in at " + tz(f.eta) + ". Check FlightAware for the gate." : "Scheduled in at " + tz(f.eta) + ".";
      return '<div class="fcard" style="--fc:' + c + '"><div class="fc-top"><b>' + esc(f.who) + '</b><span class="fc-no">' + esc(f.flight) + (isTest(f) ? " (test: " + esc(csOf(f)) + ")" : "") + '</span><span class="tag status ' + s.c + '">' + esc(s.label) + "</span></div>" +
        '<div class="fc-route"><div class="fc-end"><span class="ap">' + f.from + '</span><span class="tm">' + esc(tz(f.etd)) + '</span><span class="lb">ETD</span></div>' +
        '<div class="fc-bar" aria-hidden="true"><i style="width:' + pct + '%"></i><span class="pl" style="left:' + pct + '%">' + ICON.plane + "</span></div>" +
        '<div class="fc-end"><span class="ap">' + f.to + '</span><span class="tm">' + esc(tz(f.eta)) + '</span><span class="lb">ETA</span></div></div>' +
        '<div class="fc-sub"><span>' + line + "</span><span>" + (f.dir === "arr" ? "Pickup" : "Drop-off") + ": " + (drv ? esc(drv) : "TBD") + "</span></div>" +
        '<div class="fc-links"><a class="track" href="' + trackUrl(f) + '" target="_blank" rel="noopener">FlightAware: delays + gate</a></div></div>';
    }).join("");
  }
  function radarUrl(list, w) {
    var la = [], lo = [];
    list.forEach(function (f) { [AP[f.from], AP[f.to]].forEach(function (p) { la.push(p.lat); lo.push(p.lon); }); });
    var cLat = (Math.min.apply(0, la) + Math.max.apply(0, la)) / 2, cLon = (Math.min.apply(0, lo) + Math.max.apply(0, lo)) / 2;
    var span = Math.max(Math.max.apply(0, lo) - Math.min.apply(0, lo), (Math.max.apply(0, la) - Math.min.apply(0, la)) * 1.4, 4);
    var z = Math.max(3, Math.min(8, Math.round(Math.log(w * 360 / (256 * span * 1.2)) / Math.LN2 * 10) / 10));
    var re = Q.get("radar") || "^(" + list.map(function (f) { return f.cs; }).join("|") + ")$";
    return "https://adsb.lol/?filterCallSign=" + encodeURIComponent(re) + "&hideSideBar&hideButtons&enableLabels&extendedLabels=1&tempTrails=3600&lat=" + cLat.toFixed(2) + "&lon=" + cLon.toFixed(2) + "&zoom=" + z;
  }
  function flyView(r) {
    var dir = FLYDIR[r], list = flyList(dir), t = now().getTime(), live = flyAirborne(list, t);
    var w = Math.min(viewEl.clientWidth || window.innerWidth, 900);
    var body = flyTab === "radar"
      ? '<div class="radar"><iframe src="' + esc(radarUrl(list, w)) + '" title="Live radar of our flights" loading="lazy" referrerpolicy="no-referrer"></iframe></div>' +
        '<div class="fly-note">The real planes, live, from adsb.lol\'s volunteer receivers, showing only our ' + list.length + ' flights. A plane appears once its transponder is on (at the gate or taxiing), so before then the map is empty. <a href="' + esc(radarUrl(list, 1100)) + '" target="_blank" rel="noopener">Open full screen</a></div>'
      : '<div id="fmap" class="lmap fmap" aria-label="Flight route map"></div>' +
        '<div class="fly-note fly-live" id="flylive">' + liveStatusHtml(dir) + "</div>";
    return '<div class="view-anim fly"><div class="day-head"><div class="kicker">Live flight map · ' + (dir === "arr" ? "Wed, Nov 25" : "Sat, Nov 28") + '</div><h2 class="headline">' + (dir === "arr" ? "Three flights in to SEA" : "Three flights home from SEA") + "</h2></div>" +
      '<div class="seg" role="tablist" aria-label="Which day"><button role="tab" data-go="fly-in" aria-selected="' + (r === "fly-in") + '">Wed arrivals</button><button role="tab" data-go="fly-out" aria-selected="' + (r === "fly-out") + '">Sat departures</button></div>' +
      '<div class="seg sub" role="tablist" aria-label="Map type"><button role="tab" data-flytab="route" aria-selected="' + (flyTab === "route") + '">Route map</button><button role="tab" data-flytab="radar" aria-selected="' + (flyTab === "radar") + '">Live radar<span class="livedot' + (live ? " on" : "") + '"></span></button></div>' +
      body + '<div class="fcards" id="fcards">' + fcardsHtml(dir) + "</div></div>";
  }
  function initFly(r) {
    if (fmap) { fmap.remove(); fmap = null; }
    var el = document.getElementById("fmap"); if (!el) return;
    if (!window.L) { el.outerHTML = '<div class="map-note">The map couldn\'t load here. The flight cards below still update.</div>'; return; }
    var list = flyList(FLYDIR[r]);
    fmap = L.map(el, { scrollWheelZoom: false, zoomControl: true, zoomSnap: 0.25 });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 12, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(fmap);
    var codes = {}, pts = [];
    list.forEach(function (f) { [["from", f.from], ["to", f.to]].forEach(function (x) { (codes[x[1]] = codes[x[1]] || []).push({ f: f, end: x[0] }); }); });
    Object.keys(codes).forEach(function (code) {
      var p = AP[code], rows = codes[code], hub = rows.length > 1;
      var sub = hub ? "" : rows.map(function (x) { return '<small style="color:' + flyColor(x.f) + '">' + (x.end === "from" ? "ETD " + esc(tz(x.f.etd)) : "ETA " + esc(tz(x.f.eta))) + "</small>"; }).join("");
      pts.push([p.lat, p.lon]);
      L.marker([p.lat, p.lon], { keyboard: false, interactive: false, icon: L.divIcon({ className: "", iconSize: [12, 12], iconAnchor: [6, 6],
        html: '<span class="fap-dot' + (hub ? " hub" : "") + '"></span><span class="fap ' + (APCHIP[code] || (hub ? "above" : "below")) + '"><b>' + code + "</b>" + (hub ? '<small>' + esc(p.city) + "</small>" : sub) + "</span>" }) }).addTo(fmap);
    });
    fLayer = L.layerGroup().addTo(fmap);
    drawFlights(r);
    fmap.fitBounds(pts, { paddingTopLeft: [30, 54], paddingBottomRight: [30, 46] });
  }
  function drawFlights(r) {
    if (!fmap || !fLayer) return;
    fLayer.clearLayers();
    var t = now().getTime(), slots = {}, list = flyList(FLYDIR[r]), uses = {};
    list.forEach(function (f) { uses[f.from] = (uses[f.from] || 0) + 1; uses[f.to] = (uses[f.to] || 0) + 1; });
    list.forEach(function (f) {
      var a = AP[f.from], b = AP[f.to], s = flyNow(f, t), c = flyColor(f), lp = s.live;
      var pos = gcPoint(a, b, s.frac), ahead = gcPoint(a, b, Math.min(1, s.frac + 0.01)), behind = gcPoint(a, b, Math.max(0, s.frac - 0.01));
      var brg = s.frac >= 0.99 ? bearing(behind, pos) : bearing(pos, ahead);
      if (lp) { pos = [lp.lat, lp.lon]; if (lp.trk != null) brg = lp.trk; }
      L.polyline(gcLine(a, b, 0, 1), { color: c, weight: 2, opacity: lp ? 0.3 : 0.55, dashArray: "4 7", interactive: false }).addTo(fLayer);
      if (lp && !lp.gnd) {
        var P = { lat: lp.lat, lon: lp.lon }, tr = trails[csOf(f)] || [];
        L.polyline(gcLine(P, b, 0, 1), { color: c, weight: 2.5, opacity: 0.8, dashArray: "4 7", interactive: false }).addTo(fLayer);
        L.polyline(tr.length > 1 ? gcLine(a, { lat: tr[0][0], lon: tr[0][1] }, 0, 1).concat(tr) : gcLine(a, P, 0, 1), { color: c, weight: 3.5, opacity: 0.95, interactive: false }).addTo(fLayer);
      } else if (s.frac > 0) L.polyline(gcLine(a, b, 0, s.frac), { color: c, weight: 3.5, opacity: 0.95, interactive: false }).addTo(fLayer);
      // A plane still parked at a one-flight airport needs no label: the airport chip already shows its ETD.
      var quiet = !lp && (s.k === "sched" || s.k === "soon") && uses[f.from] === 1;
      var key = pos[0].toFixed(2) + "," + pos[1].toFixed(2), slot = quiet ? 0 : (slots[key] = (slots[key] || 0) + 1);
      var when = lp ? (lp.gnd ? (s.k === "landed" ? "Landed" : "Taxiing") : "LIVE · " + liveLine(lp)) : s.k === "air" ? "ETA " + tz(f.eta) : (s.k === "sched" || s.k === "soon") ? "ETD " + tz(f.etd) : "Arrived";
      L.marker(pos, { keyboard: false, title: f.flight + ", " + f.who, zIndexOffset: s.k === "air" ? 1000 : 0, icon: L.divIcon({ className: "", iconSize: [26, 26], iconAnchor: [13, 13],
        html: '<div class="fplane' + (s.k === "air" ? " air" : "") + (lp ? " live" : "") + '" style="--fc:' + c + '"><span class="fp-ico" style="transform:rotate(' + brg.toFixed(0) + 'deg)">' + ICON.plane + '</span>' + (quiet ? "" : '<span class="flabel" style="top:' + ((slot - 1) * 34 - 10) + 'px"><b>' + esc(f.flight) + "</b> " + esc(f.who) + "<br>" + esc(when) + "</span>") + "</div>" }) }).addTo(fLayer);
    });
  }
  function stopFly() { if (flyTimer) { clearInterval(flyTimer); flyTimer = null; } if (liveTimer) { clearInterval(liveTimer); liveTimer = null; } if (fmap) { fmap.remove(); fmap = null; fLayer = null; } }
  function startFly(r) {
    if (flyTab === "route") initFly(r);
    flyTimer = setInterval(flyRefresh, 15000);
    if (liveOn()) { livePoll(); liveTimer = setInterval(livePoll, 30000); }
  }
  function flyBannerHtml() {
    var t = now().getTime(), act = K.FLIGHTS.filter(function (f) { return f.cs && t >= ms(f.dep) - 3 * 3600000 && t < ms(f.arr) + 45 * 60000; });
    if (!act.length) return "";
    var air = act.filter(function (f) { return flyNow(f, t).k === "air"; }).length;
    return '<button class="pk-banner fb" data-go="' + (act[0].dir === "arr" ? "fly-in" : "fly-out") + '"><span class="kicker">Live flight map</span><b>' +
      (air ? air + (air > 1 ? " flights" : " flight") + " in the air" : "Flight day") + "</b><span>" +
      act.map(function (f) { return esc(f.flight) + (f.dir === "arr" ? " lands " + esc(f.eta) : " departs " + esc(f.etd)); }).join(" · ") + " →</span></button>";
  }

  /* ---------- routing ---------- */
  var viewEl = document.getElementById("view"), stripEl = document.getElementById("daystrip"), daysEl = document.getElementById("days");
  var VIEWS = ["week", "map", "fly-in", "fly-out", "thanks", "tv", "prep", "pickle", "pickle-tv", "photos", "photos-tv", "karaoke", "karaoke-tv"];
  function todayDay() { return DAYS.filter(function (d) { return d.date === today(); })[0]; }
  var lastDay = todayDay() ? todayDay().id : "wed";
  daysEl.innerHTML = DAYS.map(function (d) {
    return '<button class="daybtn' + (d.date === today() ? " is-today" : "") + '" role="tab" data-go="' + d.id + '" aria-selected="false"><span class="dow">' + d.dow + '</span><span class="num">' + d.num + '</span><span class="dot"></span></button>';
  }).join("");
  function route() {
    var h = location.hash.replace("#", "");
    if (VIEWS.indexOf(h) >= 0 || DAYS.some(function (d) { return d.id === h; })) return h;
    var td = todayDay(); return td ? td.id : "week";
  }
  function render(keepScroll) {
    var y = window.scrollY, r = route(), d = DAYS.filter(function (x) { return x.id === r; })[0], section;
    if (lmap) { lmap.remove(); lmap = null; }
    stopFly();
    document.body.classList.toggle("tvmode", r === "tv" || r === "pickle-tv" || r === "photos-tv" || r === "karaoke-tv");
    if (d) { lastDay = d.id; section = "days"; viewEl.innerHTML = dayView(d); }
    else if (r === "map") { section = "map"; viewEl.innerHTML = mapView(); }
    else if (FLYDIR[r]) { section = "map"; viewEl.innerHTML = flyView(r); }
    else if (r === "prep") { section = "prep"; viewEl.innerHTML = prepView(); }
    else if (r === "thanks") { section = "thanks"; viewEl.innerHTML = thanksView(); }
    else if (r === "tv") { section = "thanks"; viewEl.innerHTML = tvView(); }
    else if (r === "karaoke") { section = "days"; viewEl.innerHTML = karaokeView(); }
    else if (r === "karaoke-tv") { section = "days"; viewEl.innerHTML = karaokeTvView(); }
    else if (r === "photos") { section = "photos"; viewEl.innerHTML = photosView(); }
    else if (r === "photos-tv") { section = "photos"; viewEl.innerHTML = photosTvView(); }
    else if (r === "pickle") { section = "days"; viewEl.innerHTML = pickleView(); }
    else if (r === "pickle-tv") { section = "days"; viewEl.innerHTML = pickleTvView(); }
    else { section = "week"; viewEl.innerHTML = weekView(); }
    stripEl.hidden = !d;
    Array.prototype.forEach.call(daysEl.children, function (b) { b.setAttribute("aria-selected", d && b.getAttribute("data-go") === d.id ? "true" : "false"); });
    Array.prototype.forEach.call(document.querySelectorAll(".navbtn"), function (b) { if (b.getAttribute("data-nav") === section) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    if (r === "map") initMap();
    if (FLYDIR[r]) startFly(r);
    if (d && d.board) animateBoards();
    if (r === "tv") startTv(); else stopTv();
    if (r === "photos-tv") startPtv(); else stopPtv();
    if (r === "karaoke-tv") kTvQr();
    if (r === "pickle" || r === "pickle-tv") maybeConfetti();
    renderCrew();
    if (keepScroll) window.scrollTo(0, y);
  }
  var softTimer = null;
  function softRender() {
    clearTimeout(softTimer);
    softTimer = setTimeout(function () {
      var r = route();
      if (r === "map" || r === "tv" || r === "pickle-tv" || r === "photos-tv") return;
      if (FLYDIR[r]) { var fc = document.getElementById("fcards"); if (fc) fc.innerHTML = fcardsHtml(FLYDIR[r]); return; }
      if (r === "thanks") { var l = document.getElementById("wall-list"); if (l) l.innerHTML = wallListHtml(); return; }
      render(true);
    }, 120);
  }
  function go(id) { if (location.hash !== "#" + id) location.hash = id; else render(); window.scrollTo(0, 0); }

  function renderCrew() {
    var c = document.getElementById("crew");
    c.innerHTML = '<h2>Who\'s here</h2>' + K.PEOPLE.map(function (g) {
      return '<div class="crew-group"><div class="kicker">' + esc(g[0]) + '</div><div class="names">' + g[1].map(function (n) { return '<span class="name' + (n === ME ? " me" : "") + '">' + esc(n) + "</span>"; }).join("") + "</div></div>";
    }).join("");
  }

  /* ---------- sheets ---------- */
  var scrim = document.getElementById("scrim"), whoScrim = document.getElementById("who-scrim"), lastFocus = null, afterPick = null;
  function openSheet(key) {
    var p = PL[key]; if (!p) return;
    lastFocus = document.activeElement;
    document.getElementById("sheet-title").textContent = p.name;
    document.getElementById("sheet-addr").textContent = p.addr;
    document.getElementById("sheet-drive").textContent = p.drive + " from home";
    document.getElementById("sheet-copied").textContent = "";
    document.getElementById("sheet-links").innerHTML =
      '<a class="maplink primary" href="' + appleUrl(p) + '" target="_blank" rel="noopener">Apple Maps</a>' +
      '<a class="maplink" href="' + googleUrl(p) + '" target="_blank" rel="noopener">Google Maps</a>' +
      '<button class="maplink" data-copy="' + key + '">Copy address</button>';
    scrim.hidden = false;
    document.getElementById("sheet-close").focus();
  }
  function closeSheet() { scrim.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  function pickMe(cb) {
    afterPick = cb || null;
    document.getElementById("who-list").innerHTML = K.PEOPLE.map(function (g) {
      return '<div class="crew-group"><div class="kicker">' + esc(g[0]) + '</div><div class="names">' + g[1].map(function (n) { return '<button class="name' + (n === ME ? " me" : "") + '" data-iam="' + esc(n) + '">' + esc(n) + "</button>"; }).join("") + "</div></div>";
    }).join("");
    whoScrim.hidden = false;
    var first = whoScrim.querySelector("[data-iam]"); if (first) first.focus();
  }
  function closeWho() { whoScrim.hidden = true; afterPick = null; }

  /* ---------- events ---------- */
  document.getElementById("sheet-close").addEventListener("click", closeSheet);
  scrim.addEventListener("click", function (e) { if (e.target === scrim) closeSheet(); });
  whoScrim.addEventListener("click", function (e) { if (e.target === whoScrim) closeWho(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { if (!scrim.hidden) closeSheet(); if (!whoScrim.hidden) closeWho(); closePhoto(); }
    if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("pin")) { e.preventDefault(); openSheet(e.target.getAttribute("data-place")); }
  });
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-flytab],[data-pkp],[data-pkmove],[data-kchip],[data-ksing],[data-kmore],[data-kdone],[data-kskip],[data-kdel],[data-addphoto],[data-photo],[data-lbclose],[data-lbdel],[data-pk],[data-place],[data-go],[data-nav],[data-copy],[data-join],[data-leave],[data-pickme],[data-iam],[data-closewho],[data-unpost],[data-mapfit]");
    if (!t) return;
    if (t.hasAttribute("data-flytab")) { flyTab = t.getAttribute("data-flytab"); render(true); return; }
    if (t.hasAttribute("data-pkp")) { pkTap(t.getAttribute("data-pkp")); return; }
    if (t.hasAttribute("data-pkmove")) { pkMove(t.getAttribute("data-pkmove")); return; }
    if (t.hasAttribute("data-kchip")) {
      var kc = t.getAttribute("data-kchip").split(":"), key = kc[0], val = kc[1];
      if (key === "lv") kp.lv = val; else { var arr = kp[key], ix = arr.indexOf(val); if (ix >= 0) arr.splice(ix, 1); else arr.push(val); }
      kSave();
      Array.prototype.forEach.call(document.querySelectorAll('[data-kchip^="' + key + ':"]'), function (b) {
        var v2 = b.getAttribute("data-kchip").split(":")[1], on = key === "lv" ? kp.lv === v2 : kp[key].indexOf(v2) >= 0;
        b.classList.toggle("on", on); b.setAttribute("aria-pressed", on);
      });
      kRefreshResults(); return;
    }
    if (t.hasAttribute("data-kmore")) { kSeed = Math.random(); kRefreshResults(); return; }
    if (t.hasAttribute("data-ksing")) { kAdd(t.getAttribute("data-ksing"), t.getAttribute("data-kartist")); return; }
    if (t.hasAttribute("data-kdone")) { var u1 = {}; u1["q/" + t.getAttribute("data-kdone") + "/done"] = true; Cloud.gameUpdate(KQ, u1).catch(function () { toast("Couldn't save that."); }); return; }
    if (t.hasAttribute("data-kskip")) { var u2 = {}; u2["q/" + t.getAttribute("data-kskip") + "/ts"] = Date.now(); Cloud.gameUpdate(KQ, u2).catch(function () { toast("Couldn't save that."); }); return; }
    if (t.hasAttribute("data-kdel")) { var u3 = {}; u3["q/" + t.getAttribute("data-kdel")] = null; Cloud.gameUpdate(KQ, u3).catch(function () { toast("Couldn't remove that."); }); return; }
    if (t.hasAttribute("data-addphoto")) { if (!ME) { pickMe(function () { document.getElementById("photo-input").click(); }); return; } document.getElementById("photo-input").click(); return; }
    if (t.hasAttribute("data-photo")) { openPhoto(t.getAttribute("data-photo")); return; }
    if (t.hasAttribute("data-lbclose")) { closePhoto(); return; }
    if (t.hasAttribute("data-lbdel")) { var pid = lbId; closePhoto(); Cloud.removePhoto(pid).then(function () { toast("Photo deleted."); }, function () { toast("Couldn't delete that."); }); return; }
    if (t.hasAttribute("data-pk")) { if (!t.disabled) pkAction(t); return; }
    if (t.hasAttribute("data-place")) { openSheet(t.getAttribute("data-place")); return; }
    if (t.hasAttribute("data-go")) { go(t.getAttribute("data-go")); return; }
    if (t.hasAttribute("data-nav")) { var n = t.getAttribute("data-nav"); go(n === "days" ? lastDay : n); return; }
    if (t.hasAttribute("data-join")) { doJoin(t.getAttribute("data-join")); return; }
    if (t.hasAttribute("data-leave")) { doLeave(t.getAttribute("data-leave")); return; }
    if (t.hasAttribute("data-pickme")) { pickMe(); return; }
    if (t.hasAttribute("data-closewho")) { closeWho(); return; }
    if (t.hasAttribute("data-mapfit")) { fitMap(t.getAttribute("data-mapfit")); return; }
    if (t.hasAttribute("data-iam")) {
      var cb = afterPick; setMe(t.getAttribute("data-iam")); whoScrim.hidden = true; afterPick = null;
      render(true); toast("Hi, " + ME + "!"); if (cb) cb(); return;
    }
    if (t.hasAttribute("data-unpost")) { Cloud.remove(t.getAttribute("data-unpost")).catch(function () { toast("Couldn't delete that."); }); return; }
    if (t.hasAttribute("data-copy")) {
      var addr = PL[t.getAttribute("data-copy")].addr, msg = document.getElementById("sheet-copied");
      try { navigator.clipboard.writeText(addr).then(function () { msg.textContent = "Address copied."; }, function () { msg.textContent = "Couldn't copy. Press and hold the address to copy it."; }); }
      catch (err) { msg.textContent = "Couldn't copy. Press and hold the address to copy it."; }
    }
  });
  document.addEventListener("change", function (e) {
    var sel = e.target.closest && e.target.closest("[data-pkref]"); if (!sel || !sel.value) return;
    var up = {}; up["sched/" + sel.getAttribute("data-pkref") + "/ref"] = sel.value;
    Cloud.gameUpdate(PK, up).then(function () { toast(sel.value + " is keeping score."); }, function () { toast("Couldn't save that. Check your connection."); });
  });
  document.addEventListener("input", function (e) {
    if (e.target.id === "kq") { kp.q = e.target.value; kSave(); kRefreshResults(); }
  });
  document.addEventListener("submit", function (e) {
    if (e.target.id === "kform") {
      e.preventDefault();
      var ti = document.getElementById("ktitle").value.trim(), ar = document.getElementById("kartist").value.trim();
      if (!ti) return;
      kAdd(ti.slice(0, 80), ar.slice(0, 60)); document.getElementById("ktitle").value = ""; document.getElementById("kartist").value = ""; return;
    }
    if (e.target.id !== "wall-form") return;
    e.preventDefault();
    var ta = document.getElementById("wall-text"), text = ta.value.trim();
    if (!text) { ta.focus(); return; }
    var send = function () {
      Cloud.post(ME, text.slice(0, 280)).then(function () { var t2 = document.getElementById("wall-text"); if (t2) t2.value = ""; toast("Posted. Thank you, " + ME + "!"); }, function () { toast("Couldn't post. Check your connection."); });
    };
    if (!ME) pickMe(send); else send();
  });
  window.addEventListener("hashchange", function () { render(); });
  document.getElementById("photo-input").addEventListener("change", function (e) { var f = e.target.files; if (f && f.length) uploadFiles(f); e.target.value = ""; });
  document.getElementById("photo-scrim").addEventListener("click", function (e) { if (e.target.id === "photo-scrim") closePhoto(); });

  Cloud.on(function (kind) {
    var r = route();
    if (kind === "wall") {
      if (r === "thanks") { var l = document.getElementById("wall-list"); if (l) l.innerHTML = wallListHtml(); }
      if (r === "tv") { var fresh = Cloud.state.wall.some(function (n) { return !tvSeen[n.id]; }); if (fresh) { tvShow(); if (tvTimer) { clearInterval(tvTimer); tvTimer = setInterval(tvShow, 8000); } } }
      return;
    }
    if (r === "thanks") { var ta = document.getElementById("wall-text"); if (kind === "mode" && !(ta && ta.value)) render(true); return; }
    if (kind === "games" && (r === "pickle" || r === "pickle-tv" || r === "karaoke-tv")) { render(true); return; }
    if (kind === "games" && r === "karaoke") {
      var ae = document.activeElement, typing = ae && (ae.id === "kq" || ae.id === "ktitle" || ae.id === "kartist");
      if (typing) { kRefreshResults(); return; }
      render(true); return;
    }
    if (kind === "photos") {
      if (r === "photos-tv") { if (Cloud.state.photos.some(function (p) { return !ptvSeen[p.id]; })) { ptvShow(); if (ptvTimer) { clearInterval(ptvTimer); ptvTimer = setInterval(ptvShow, 7000); } } return; }
      if (r === "photos" || r === "week") softRender();
      return;
    }
    softRender();
  });

  /* ---------- ticking ---------- */
  setInterval(function () {
    var t = now().getTime();
    Array.prototype.forEach.call(document.querySelectorAll("[data-until]"), function (el) {
      var d = +el.getAttribute("data-until") - t;
      if (el.getAttribute("data-fmt") === "in") el.textContent = inText(d); else el.innerHTML = cdHtml(d);
    });
  }, 1000);
  setInterval(function () {
    var n = document.getElementById("nowcard"); if (n) n.innerHTML = nowInner();
    var k = document.getElementById("kclock"); if (k) k.innerHTML = kitchenClockInner();
  }, 30000);

  /* ---------- boot ---------- */
  var diff = dayNum("2026-11-26") - dayNum(today()), cd = document.getElementById("countdown");
  cd.textContent = diff > 1 ? diff + " days to Thanksgiving" : diff === 1 ? "Thanksgiving is tomorrow" : diff === 0 ? "Happy Thanksgiving" : diff >= -3 ? "Thanksgiving weekend" : "Thanks for coming";
  var pv = [];
  if (OVERRIDE) pv.push("clock set to " + dowFmt.format(OVERRIDE) + " " + clock(OVERRIDE));
  if (Q.get("mock") === "1") pv.push("sign-ups saved on this phone only");
  if (pv.length) { var b = document.getElementById("preview"); b.textContent = "Preview: " + pv.join(" · "); b.hidden = false; }
  if (Q.get("debug") === "1") {
    var dbg = document.getElementById("preview");
    var show = function () { dbg.hidden = false; dbg.textContent = "Sign-ups: " + Cloud.state.mode + (Cloud.state.backend ? " (" + Cloud.state.backend + ")" : "") + (Cloud.state.error ? " · " + Cloud.state.error : ""); };
    Cloud.on(show); show();
  }
  updateMeChip();
  Cloud.start();
  render();
  loadWeather();
};
