/**
 * K×O 2026 live flight relay (Google Apps Script web app).
 *
 * The family app asks this for the live position of a few flight callsigns.
 * Public ADS-B networks block calls from web pages (CORS), so this fetches
 * them server-side and hands back plain JSON. Read-only: it stores nothing
 * except a 25-second cache so 14 phones don't hammer the networks.
 *
 *   ?cs=ASA330,SWA118   live positions for those callsigns
 *   ?health=1           which networks answer from Google's servers
 *
 * Deploy: Deploy > New deployment > Web app
 *         Execute as: Me · Who has access: Anyone
 */
var PROVIDERS = [
  { name: "adsb.fi", cs: function (c) { return "https://opendata.adsb.fi/api/v2/callsign/" + c; }, pt: "https://opendata.adsb.fi/api/v2/lat/47.45/lon/-122.31/dist/40" },
  { name: "adsb.lol", cs: function (c) { return "https://api.adsb.lol/v2/callsign/" + c; }, pt: "https://api.adsb.lol/v2/point/47.45/-122.31/40" },
  { name: "airplanes.live", cs: function (c) { return "https://api.airplanes.live/v2/callsign/" + c; }, pt: "https://api.airplanes.live/v2/point/47.45/-122.31/40" }
];
var CACHE_SECONDS = 25;

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.health) return json_(health_());
  var list = String(p.cs || "").toUpperCase().split(",")
    .map(function (s) { return s.replace(/[^A-Z0-9]/g, ""); })
    .filter(function (s) { return s.length >= 3 && s.length <= 8; })
    .slice(0, 6);
  if (!list.length) return json_({ ok: false, error: "Pass ?cs=ASA330,SWA118" });
  var cache = CacheService.getScriptCache(), out = { ok: true, now: Date.now(), ac: {} }, need = [];
  list.forEach(function (c) { var hit = cache.get("cs:" + c); if (hit) out.ac[c] = JSON.parse(hit); else need.push(c); });
  if (need.length) {
    var got = lookup_(need);
    need.forEach(function (c) { out.ac[c] = got[c]; cache.put("cs:" + c, JSON.stringify(got[c]), CACHE_SECONDS); });
  }
  return json_(out);
}

// Ask each network in turn. A network that answers (even "not in the air")
// is trusted; we only move on to the next one when a request fails.
function lookup_(list) {
  var result = {}, pending = list.slice();
  for (var i = 0; i < PROVIDERS.length && pending.length; i++) {
    var prov = PROVIDERS[i], resps;
    try {
      resps = UrlFetchApp.fetchAll(pending.map(function (c) { return { url: prov.cs(c), muteHttpExceptions: true }; }));
    } catch (err) { continue; }
    var still = [];
    pending.forEach(function (c, j) {
      var acs = parse_(resps[j]);
      if (!acs) { still.push(c); return; }
      var a = pick_(acs, c);
      result[c] = a ? shape_(a, prov.name) : { found: false, src: prov.name, at: Date.now() };
    });
    pending = still;
  }
  pending.forEach(function (c) { result[c] = { found: false, error: "no network answered", at: Date.now() }; });
  return result;
}

function parse_(r) {
  if (!r || r.getResponseCode() !== 200) return null;
  try { var d = JSON.parse(r.getContentText()); } catch (err) { return null; }
  var acs = d.ac || d.aircraft;
  return Array.isArray(acs) ? acs : null;
}

function pick_(acs, c) {
  var best = null;
  acs.forEach(function (a) {
    if (String(a.flight || "").trim().toUpperCase() !== c || typeof a.lat !== "number" || typeof a.lon !== "number") return;
    var age = a.seen_pos != null ? a.seen_pos : (a.seen != null ? a.seen : 999);
    if (!best || age < best.age) best = { a: a, age: age };
  });
  return best ? best.a : null;
}

function shape_(a, src) {
  var gnd = a.alt_baro === "ground";
  return {
    found: true, src: src, at: Date.now(),
    lat: a.lat, lon: a.lon,
    alt: gnd ? 0 : (typeof a.alt_baro === "number" ? a.alt_baro : (typeof a.alt_geom === "number" ? a.alt_geom : null)),
    gnd: gnd,
    gs: typeof a.gs === "number" ? a.gs : null,
    trk: typeof a.track === "number" ? a.track : (typeof a.true_heading === "number" ? a.true_heading : null),
    vr: typeof a.baro_rate === "number" ? a.baro_rate : null,
    age: a.seen_pos != null ? a.seen_pos : (a.seen != null ? a.seen : null),
    type: a.t || null, reg: a.r || null
  };
}

function health_() {
  var out = { ok: true, now: Date.now(), providers: {} };
  PROVIDERS.forEach(function (prov) {
    var t0 = Date.now(), info = {};
    try {
      var r = UrlFetchApp.fetch(prov.pt, { muteHttpExceptions: true }), acs = parse_(r);
      info.code = r.getResponseCode();
      info.aircraft = acs ? acs.length : null;
      info.sample = acs ? acs.map(function (a) { return String(a.flight || "").trim(); }).filter(String).slice(0, 8) : [];
    } catch (err) { info.error = String(err).slice(0, 160); }
    info.ms = Date.now() - t0;
    out.providers[prov.name] = info;
  });
  return out;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
