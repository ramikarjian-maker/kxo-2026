/* Family password: decrypts js/data.enc.js (PBKDF2-SHA256 -> AES-256-GCM), then boots the app.
   The derived key is remembered on this device so people only type the password once. */
(function () {
  "use strict";
  var enc = window.KXO_ENC, STORE = "kxo.k";
  var form = document.getElementById("gate-form"), input = document.getElementById("gate-pw");
  var msg = document.getElementById("gate-msg"), fields = document.getElementById("gate-fields");
  var subtle = window.crypto && window.crypto.subtle;
  function b64d(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function b64e(buf) { var a = new Uint8Array(buf), s = ""; for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
  function derive(pw) {
    return subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]).then(function (base) {
      return subtle.deriveKey({ name: "PBKDF2", salt: b64d(enc.salt), iterations: enc.iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, true, ["decrypt"]);
    });
  }
  function unlock(key) {
    return subtle.decrypt({ name: "AES-GCM", iv: b64d(enc.iv) }, key, b64d(enc.ct)).then(function (buf) { return new TextDecoder().decode(buf); });
  }
  function boot(code) {
    (new Function(code))();
    document.body.classList.remove("locked");
    var g = document.getElementById("gate"); if (g) g.parentNode.removeChild(g);
    window.KXO_BOOT();
  }
  function ask(text) { fields.style.display = "grid"; msg.textContent = text || ""; setTimeout(function () { input.focus(); }, 50); }

  if (!enc || !subtle) { fields.style.display = "none"; msg.textContent = "This browser can't open the app. Try Safari or Chrome."; return; }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var pw = input.value.trim().toLowerCase();
    if (!pw) { input.focus(); return; }
    msg.textContent = "Opening…";
    var k;
    derive(pw).then(function (key) { k = key; return unlock(key); }).then(function (code) {
      subtle.exportKey("raw", k).then(function (raw) { try { localStorage.setItem(STORE, JSON.stringify({ salt: enc.salt, k: b64e(raw) })); } catch (err) {} });
      boot(code);
    }, function () { input.value = ""; ask("That's not it. Try again."); });
  });

  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE)); } catch (e) {}
  if (saved && saved.salt === enc.salt && saved.k) {
    fields.style.display = "none"; msg.textContent = "Opening…";
    subtle.importKey("raw", b64d(saved.k), { name: "AES-GCM" }, false, ["decrypt"]).then(unlock).then(boot, function () {
      try { localStorage.removeItem(STORE); } catch (e) {}
      ask("");
    });
  } else {
    ask("");
  }
})();
