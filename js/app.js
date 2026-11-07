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
  function trackUrl(f) { return f.flight ? "https://www.flightaware.com/live/flight/" + encodeURIComponent(f.flight.replace(/\s+/g, "").toUpperCase()) : "https://www.flightaware.com/live/airport/KSEA"; }
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
    var empty = a.kind === "driver" ? "No driver yet" : a.kind === "role" ? "Open" : "No one yet";
    var chips = names.length ? names.map(function (n) { return '<span class="pchip' + (n === ME ? " me" : "") + '">' + esc(n) + "</span>"; }).join("") : '<span class="none">' + empty + "</span>";
    var count = a.cap && a.cap > 1 ? '<span class="cap">' + names.length + " of " + a.cap + "</span>" : (names.length && !a.cap ? '<span class="cap">' + names.length + "</span>" : "");
    var btn;
    if (Cloud.state.mode === "error") btn = '<span class="soon">Can\'t reach sign-ups right now. Try again in a bit.</span>';
    else if (!live()) btn = '<span class="soon">Sign-ups open soon</span>';
    else if (mine) btn = '<button class="joinbtn on" data-leave="' + actId + '">' + (a.kind === "driver" ? "You're driving · Undo" : "You're in · Undo") + "</button>";
    else if (full) btn = '<button class="joinbtn" disabled>Full</button>';
    else btn = '<button class="joinbtn" data-join="' + actId + '">' + (a.kind === "driver" ? "I'll drive" : a.kind === "role" ? "I'll do it" : "I'm in") + "</button>";
    return '<div class="who' + (compact ? " compact" : "") + '">' + (compact ? "" : '<div class="who-top"><span class="sec-label">' + label + "</span>" + count + "</div>") +
      '<div class="pchips">' + chips + "</div>" + btn + "</div>";
  }
  function doJoin(act) {
    if (!ME) { pickMe(function () { doJoin(act); }); return; }
    var a = ACTS[act], who = Cloud.who(act);
    if (a.cap && who.length >= a.cap && who.indexOf(ME) < 0) { toast("That one's full."); return; }
    Cloud.join(act, ME).then(function () { toast(a.kind === "driver" ? "Thanks for driving, " + ME + "!" : "You're in, " + ME + "!"); }, function () { toast("Couldn't save that. Check your connection."); });
  }
  function doLeave(act) { if (!ME) return; Cloud.leave(act, ME).catch(function () { toast("Couldn't save that. Check your connection."); }); }

  /* ---------- item + day renderers ---------- */
  function placeChip(key) {
    var p = PL[key];
    if (!p) return '<span class="tag">' + esc(key) + "</span>";
    return '<button class="dirbtn" data-place="' + key + '">' + ICON.pin + 'Directions <span class="dt">' + esc(p.drive) + "</span></button>";
  }
  function statusTag(s) { return s ? '<span class="tag status ' + s[0] + '">' + esc(s[1]) + "</span>" : ""; }
  function ownsStep(it, name) { if (!it.owner || !name) return false; if (it.owner === name) return true; var r = K.OWNER_ROLE[it.owner]; return !!r && Cloud.who(r)[0] === name; }
  function ownerLabel(o) { var r = K.OWNER_ROLE[o]; if (!r) return o; var n = Cloud.who(r)[0]; return n ? o + ": " + n : o; }

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
    if (it.menu) h += '<div class="menu-title">On the table</div><ul class="menu">' + it.menu.map(function (m) { return "<li>" + esc(m[0]) + (m[1] ? '<span class="veg">VEG</span>' : "") + "</li>"; }).join("") + "</ul>";
    if (it.act) h += whoHtml(it.act);
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
    return '<div class="board" data-board="' + dir + '" role="table" aria-label="' + (dir === "arr" ? "SEA arrivals" : "SEA departures") + '"><div class="board-title">' + ICON.plane + (dir === "arr" ? "SEA Arrivals" : "SEA Departures") + "</div>" +
      '<div class="board-cols"><span>WHO</span><span>' + (dir === "arr" ? "LANDS" : "DEPARTS") + "</span></div>" +
      rows.map(function (f) {
        var drv = Cloud.who(f.drive)[0];
        return '<div class="board-row" role="row"><div class="flaprow" aria-label="' + esc(f.who + ", " + f.time) + '">' + flaps(f.who.replace(/ /g, ""), 10) + flaps(f.time, 7, true) + "</div>" +
          '<div class="board-sub"><span>' + (f.flight ? "Flight " + esc(f.flight.toUpperCase()) : "Flight # coming") + " · Driver: " + (drv ? esc(drv) : "TBD") + "</span>" +
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
  var ARRIVE = ms("2026-11-25T17:00"), TRIP_START = ms("2026-11-25T16:00"), TRIP_END = ms("2026-11-29T18:00");
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
      return '<div class="kicker">Countdown</div><div class="cd" data-until="' + ARRIVE + '">' + cdHtml(ARRIVE - t) + '</div><div class="now-sub">until the Ohs land at SEA · Wed, Nov 25, ~5:00p</div>';
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
    Object.keys(ACTS).forEach(function (id) { var a = ACTS[id]; if (a.kind === "role" && joined(id, ME)) rows.push({ s: ms(a.at), when: a.when, txt: a.title, tag: "Your job", c: "ok" }); });
    if (ME === "Susan") rows.push({ s: ms("2026-11-26T12:30"), when: "Thu 12:30p", txt: "Oven turkey + gravy", tag: "Your job", c: "ok" });
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
    var pg = pkGame(), pr = pkRounds(pg), pch = pkChamps(pg), pkBanner = "";
    if (pch) pkBanner = '<button class="pk-banner" data-go="pickle"><span class="kicker">Pickleball champions</span><b>' + names(pch) + "</b></button>";
    else if (pr.length) pkBanner = '<button class="pk-banner" data-go="pickle"><span class="kicker">Pickleball tournament</span><b>' + (pg.final ? "The final is on" : "Round " + pr[pr.length - 1].n + " in progress") + "</b><span>Scores + leaderboard →</span></button>";
    return '<div class="view-anim"><div class="now" id="nowcard">' + nowInner() + "</div>" + pkBanner + myWeekHtml() +
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
    var roles = '<div class="roles"><div class="menu-title">Thursday roles</div><div class="role"><div class="role-who">Oven turkey + gravy</div><div class="pchips"><span class="pchip">Susan</span></div></div>' +
      Object.keys(ACTS).filter(function (id) { return ACTS[id].kind === "role"; }).map(function (id) {
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


  /* ---------- pickleball tournament ---------- */
  var PK = "pickle", COURTS = ["Indoor 6", "Indoor 7"];
  function pkGame() { return Cloud.game(PK) || {}; }
  function pkRounds(g) { var r = g.rounds || {}; return Object.keys(r).map(function (k) { var x = r[k]; x.key = k; return x; }).sort(function (a, b) { return a.n - b.n; }); }
  function pkCourts(r) { var c = r.courts || {}; return Object.keys(c).sort().map(function (k) { var x = c[k]; x.key = k; return x; }); }
  function pkPlayers() { return Cloud.who("pickle"); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pkStats(g) {
    var st = {};
    function s(p) { return st[p] || (st[p] = { p: p, gp: 0, w: 0, l: 0, pf: 0, pa: 0, sat: 0, partners: {}, opps: {} }); }
    pkPlayers().forEach(s);
    pkRounds(g).forEach(function (r) {
      (r.sit || []).forEach(function (p) { s(p).sat++; });
      pkCourts(r).forEach(function (c) {
        var A = c.a || [], B = c.b || [];
        [[A, B], [B, A]].forEach(function (pair) {
          pair[0].forEach(function (p) {
            pair[0].forEach(function (q) { if (q !== p) s(p).partners[q] = (s(p).partners[q] || 0) + 1; });
            pair[1].forEach(function (q) { s(p).opps[q] = (s(p).opps[q] || 0) + 1; });
          });
        });
        if (!c.done) return;
        var sa = +c.sa || 0, sb = +c.sb || 0;
        A.forEach(function (p) { var x = s(p); x.gp++; x.pf += sa; x.pa += sb; if (sa > sb) x.w++; else x.l++; });
        B.forEach(function (p) { var x = s(p); x.gp++; x.pf += sb; x.pa += sa; if (sb > sa) x.w++; else x.l++; });
      });
    });
    return st;
  }
  function pkTable(st) {
    return Object.keys(st).map(function (k) { return st[k]; }).sort(function (a, b) {
      return (b.w - a.w) || ((b.pf - b.pa) - (a.pf - a.pa)) || (b.pf - a.pf) || (a.gp - b.gp) || a.p.localeCompare(b.p);
    });
  }
  function pkMakeRound(g, n) {
    var players = pkPlayers(), courts = Math.min(COURTS.length, Math.floor(players.length / 4));
    if (!courts) return null;
    var prior = { rounds: {} };
    pkRounds(g).forEach(function (r) { if (r.n < n) prior.rounds[r.key] = r; });
    var st = pkStats(prior), need = courts * 4;
    var order = shuffle(players.slice()).sort(function (x, y) { return (st[x].gp - st[y].gp) || (st[y].sat - st[x].sat); });
    var playing = order.slice(0, need), sit = order.slice(need);
    function rate(p) { var x = st[p]; return x.gp ? x.w / x.gp : 0.5; }
    var best = null, bestCost = Infinity;
    for (var tries = 0; tries < 400; tries++) {
      var pl = shuffle(playing.slice()), cost = 0;
      for (var c = 0; c < courts; c++) {
        var A = pl.slice(c * 4, c * 4 + 2), B = pl.slice(c * 4 + 2, c * 4 + 4);
        cost += 10 * ((st[A[0]].partners[A[1]] || 0) + (st[B[0]].partners[B[1]] || 0));
        A.forEach(function (p) { B.forEach(function (q) { cost += 2 * (st[p].opps[q] || 0); }); });
        cost += 3 * Math.abs(rate(A[0]) + rate(A[1]) - rate(B[0]) - rate(B[1]));
      }
      if (cost < bestCost) { bestCost = cost; best = pl; }
    }
    var round = { n: n, courts: {}, sit: sit };
    for (var k = 0; k < courts; k++) round.courts["c" + (k + 1)] = { a: best.slice(k * 4, k * 4 + 2), b: best.slice(k * 4 + 2, k * 4 + 4), sa: 0, sb: 0, done: false };
    return round;
  }
  function pkChamps(g) { var f = g.final; if (!f || !f.done) return null; return (+f.sa > +f.sb) ? f.a : f.b; }
  function pkOpen() { return live() && (today() >= "2026-11-27" || Cloud.state.mode === "mock" || !!OVERRIDE); }
  function getPath(o, path) { return path.split("/").reduce(function (x, k) { return x == null ? x : x[k]; }, o); }
  function names(a) { return (a || []).map(esc).join(" + "); }

  function courtHtml(c, label, path, big) {
    var sa = +c.sa || 0, sb = +c.sb || 0, done = !!c.done;
    function side(team, score, key, win) {
      return '<div class="team' + (done && win ? " win" : "") + '"><div class="tn">' + names(team) + "</div>" +
        (done ? '<div class="score fixed">' + score + "</div>"
          : '<div class="score"><button class="stp" data-pk="dec" data-path="' + path + "/" + key + '" aria-label="Minus one">−</button><span>' + score + '</span><button class="stp" data-pk="inc" data-path="' + path + "/" + key + '" aria-label="Plus one">+</button></div>') + "</div>";
    }
    var foot = done
      ? '<div class="court-foot"><span class="status tag ok">Final ' + Math.max(sa, sb) + "–" + Math.min(sa, sb) + '</span><button class="linkbtn" data-pk="edit" data-path="' + path + '">Fix score</button></div>'
      : '<div class="court-foot"><span class="muted small">To 11, win by 2</span><button class="joinbtn small" data-pk="done" data-path="' + path + '"' + (sa === sb ? " disabled" : "") + ">Game over</button></div>";
    return '<div class="court' + (big ? " big" : "") + '"><div class="court-h">' + esc(label) + "</div>" + side(c.a, sa, "sa", sa > sb) + '<div class="vs">vs</div>' + side(c.b, sb, "sb", sb > sa) + (big ? "" : foot) + "</div>";
  }
  function champHtml(team) {
    return '<div class="champ"><div class="kicker">Pickleball champions</div><div class="champ-names">' + names(team) + '</div><div class="muted small">Bragging rights until next Thanksgiving.</div></div>';
  }
  function boardTableHtml(rows, limit) {
    var list = rows.filter(function (r) { return r.gp > 0; }).slice(0, limit || 99);
    if (!list.length) return '<p class="muted small">The leaderboard fills in after the first games.</p>';
    return '<table class="lb"><thead><tr><th>#</th><th>Player</th><th>W–L</th><th>+/−</th></tr></thead><tbody>' + list.map(function (r, i) {
      var d = r.pf - r.pa;
      return '<tr' + (r.p === ME ? ' class="me"' : "") + "><td>" + (i + 1) + "</td><td>" + esc(r.p) + "</td><td>" + r.w + "–" + r.l + "</td><td>" + (d > 0 ? "+" : "") + d + "</td></tr>";
    }).join("") + "</tbody></table>";
  }
  function pickleView() {
    var g = pkGame(), rounds = pkRounds(g), cur = rounds[rounds.length - 1], players = pkPlayers(), champs = pkChamps(g);
    var table = pkTable(pkStats(g)), open = pkOpen();
    var h = '<div class="view-anim"><div class="day-head"><div class="kicker">Fri, Nov 27 · Picklewood · Indoor courts 6 + 7</div><h2 class="headline">Pickleball Tournament</h2></div>';
    if (champs) h += champHtml(champs);
    h += '<div class="pk-rules">Every round you get <b>a new partner and new opponents</b>. Games to 11, win by 2. Wins, then point difference, set the leaderboard. The top 4 play the final: <b>#1 + #4 vs #2 + #3</b>.</div>';
    h += '<div class="sec" style="margin-top:14px"><div class="who-top"><span class="sec-label">Players</span><span class="cap">' + players.length + "</span></div>" + whoHtml("pickle", true) + "</div>";
    if (!live()) return h + '<div class="soon-box">The tournament opens when sign-ups are live.</div></div>';
    var allDone = !cur || pkCourts(cur).every(function (c) { return c.done; });
    var untouched = cur && pkCourts(cur).every(function (c) { return !c.done && !(+c.sa) && !(+c.sb); });
    var controls = [];
    if (!g.final) {
      if (open && players.length >= 4 && allDone) controls.push('<button class="btn-todo" data-pk="next">' + (cur ? "Start round " + (cur.n + 1) : "Start round 1") + "</button>");
      if (open && untouched) controls.push('<button class="maplink" data-pk="reshuffle">Reshuffle this round</button>');
      if (open && allDone && rounds.length >= 2 && table.filter(function (r) { return r.gp > 0; }).length >= 4) controls.push('<button class="maplink" data-pk="final">Start the final</button>');
    }
    controls.push('<button class="maplink" data-go="pickle-tv">Show on the TV</button>');
    if (!open) h += '<div class="teaser">The courts open Friday. Rounds start once at least 4 people have signed up.</div>';
    else if (players.length < 4) h += '<div class="teaser">Need at least 4 players to start. ' + players.length + " signed up so far.</div>";
    if (g.final) {
      h += '<div class="sec-head">The final</div>' + courtHtml(g.final, COURTS[0], "final");
    } else if (cur) {
      h += '<h3 class="sec-head">Round ' + cur.n + "</h3>" + pkCourts(cur).map(function (c, i) { return courtHtml(c, COURTS[i] || "Court " + (i + 1), "rounds/" + cur.key + "/courts/" + c.key); }).join("");
      if (cur.sit && cur.sit.length) h += '<p class="muted small">Sitting out: ' + cur.sit.map(esc).join(", ") + "</p>";
    }
    h += '<div class="map-tools">' + controls.join("") + "</div>";
    h += '<h3 class="sec-head">Leaderboard</h3>' + boardTableHtml(table);
    var past = rounds.filter(function (r) { return r !== cur || g.final; });
    if (past.length) {
      h += '<details class="pk-past"><summary>Earlier rounds</summary>' + past.slice().reverse().map(function (r) {
        return '<div class="pk-pr"><b>Round ' + r.n + "</b>" + pkCourts(r).map(function (c) { return "<div>" + names(c.a) + " <b>" + (+c.sa || 0) + "–" + (+c.sb || 0) + "</b> " + names(c.b) + "</div>"; }).join("") + "</div>";
      }).join("") + "</details>";
    }
    if (rounds.length) h += '<div style="margin-top:22px"><button class="linkbtn" data-pk="reset">' + (pkResetArmed ? "Tap again to erase the whole tournament" : "Start the tournament over") + "</button></div>";
    return h + "</div>";
  }
  function pickleTvView() {
    var g = pkGame(), rounds = pkRounds(g), cur = rounds[rounds.length - 1], champs = pkChamps(g), table = pkTable(pkStats(g));
    var main;
    if (champs) main = '<div class="tv-champ">' + champHtml(champs) + "</div>";
    else if (g.final) main = '<div class="kicker">The final</div>' + courtHtml(g.final, COURTS[0], "final", true);
    else if (cur) main = '<div class="kicker">Round ' + cur.n + "</div>" + pkCourts(cur).map(function (c, i) { return courtHtml(c, COURTS[i], "", true); }).join("");
    else main = '<p class="tv-note">The tournament starts soon.</p>';
    return '<div class="tv pk-tv"><div class="tv-top"><span class="tv-brand">Pickleball Tournament</span><button class="maplink" data-go="pickle">Exit</button></div>' +
      '<div class="pk-tv-grid"><div class="pk-tv-main">' + main + '</div><div class="pk-tv-side"><div class="kicker">Leaderboard</div>' + boardTableHtml(table, 10) + "</div></div></div>";
  }
  var pkResetArmed = false, pkResetTimer = null, celebrated = {};
  function pkAction(btn) {
    var act = btn.getAttribute("data-pk"), path = btn.getAttribute("data-path"), g = pkGame(), up = {};
    if (act === "inc" || act === "dec") { var v = +getPath(g, path) || 0; up[path] = Math.max(0, Math.min(40, v + (act === "inc" ? 1 : -1))); }
    else if (act === "done") up[path + "/done"] = true;
    else if (act === "edit") up[path + "/done"] = false;
    else if (act === "next" || act === "reshuffle") {
      var rounds = pkRounds(g), n = act === "next" ? rounds.length + 1 : rounds[rounds.length - 1].n;
      var r = pkMakeRound(g, n); if (!r) { toast("Need at least 4 players."); return; }
      up["rounds/r" + n] = r;
    }
    else if (act === "final") {
      var t = pkTable(pkStats(g)).filter(function (r) { return r.gp > 0; });
      up["final"] = { a: [t[0].p, t[3].p], b: [t[1].p, t[2].p], sa: 0, sb: 0, done: false };
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

  /* ---------- routing ---------- */
  var viewEl = document.getElementById("view"), stripEl = document.getElementById("daystrip"), daysEl = document.getElementById("days");
  var VIEWS = ["week", "map", "thanks", "tv", "prep", "pickle", "pickle-tv"];
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
    document.body.classList.toggle("tvmode", r === "tv" || r === "pickle-tv");
    if (d) { lastDay = d.id; section = "days"; viewEl.innerHTML = dayView(d); }
    else if (r === "map") { section = "map"; viewEl.innerHTML = mapView(); }
    else if (r === "prep") { section = "prep"; viewEl.innerHTML = prepView(); }
    else if (r === "thanks") { section = "thanks"; viewEl.innerHTML = thanksView(); }
    else if (r === "tv") { section = "thanks"; viewEl.innerHTML = tvView(); }
    else if (r === "pickle") { section = "days"; viewEl.innerHTML = pickleView(); }
    else if (r === "pickle-tv") { section = "days"; viewEl.innerHTML = pickleTvView(); }
    else { section = "week"; viewEl.innerHTML = weekView(); }
    stripEl.hidden = !d;
    Array.prototype.forEach.call(daysEl.children, function (b) { b.setAttribute("aria-selected", d && b.getAttribute("data-go") === d.id ? "true" : "false"); });
    Array.prototype.forEach.call(document.querySelectorAll(".navbtn"), function (b) { if (b.getAttribute("data-nav") === section) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    if (r === "map") initMap();
    if (d && d.board) animateBoards();
    if (r === "tv") startTv(); else stopTv();
    if (r === "pickle" || r === "pickle-tv") maybeConfetti();
    renderCrew();
    if (keepScroll) window.scrollTo(0, y);
  }
  var softTimer = null;
  function softRender() {
    clearTimeout(softTimer);
    softTimer = setTimeout(function () {
      var r = route();
      if (r === "map" || r === "tv" || r === "pickle-tv") return;
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
    if (e.key === "Escape") { if (!scrim.hidden) closeSheet(); if (!whoScrim.hidden) closeWho(); }
    if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("pin")) { e.preventDefault(); openSheet(e.target.getAttribute("data-place")); }
  });
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-pk],[data-place],[data-go],[data-nav],[data-copy],[data-join],[data-leave],[data-pickme],[data-iam],[data-closewho],[data-unpost],[data-mapfit]");
    if (!t) return;
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
  document.addEventListener("submit", function (e) {
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

  Cloud.on(function (kind) {
    var r = route();
    if (kind === "wall") {
      if (r === "thanks") { var l = document.getElementById("wall-list"); if (l) l.innerHTML = wallListHtml(); }
      if (r === "tv") { var fresh = Cloud.state.wall.some(function (n) { return !tvSeen[n.id]; }); if (fresh) { tvShow(); if (tvTimer) { clearInterval(tvTimer); tvTimer = setInterval(tvShow, 8000); } } }
      return;
    }
    if (r === "thanks") { var ta = document.getElementById("wall-text"); if (kind === "mode" && !(ta && ta.value)) render(true); return; }
    if (kind === "games" && (r === "pickle" || r === "pickle-tv")) { render(true); return; }
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
