#!/usr/bin/env python3
"""Encrypt / decrypt the app's private content.

  encrypt:  python3 tools/crypt.py encrypt PASSWORD src/data.js src/config.js > js/data.enc.new && mv js/data.enc.new js/data.enc.js
            (reuses the salt in js/data.enc.js when it exists, so phones that already
             unlocked stay unlocked after an update; the IV is always fresh)
  decrypt:  python3 tools/crypt.py decrypt PASSWORD js/data.enc.js > content.js

Format matches the browser side (js/gate.js): PBKDF2-SHA256 -> AES-256-GCM.
The plaintext content is never committed to this repo.
"""
import base64, json, os, re, sys
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

ITER = 250000

def key(pw, salt, it=ITER):
    return PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=it).derive(pw.encode("utf-8"))

def b64(b): return base64.b64encode(b).decode("ascii")

def current_salt():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "js", "data.enc.js")
    try:
        blob = json.loads(re.search(r"window\.KXO_ENC\s*=\s*(\{.*\});", open(path, encoding="utf-8").read(), re.S).group(1))
        return base64.b64decode(blob["salt"]) if blob.get("iter") == ITER else None
    except Exception:
        return None

def encrypt(pw, paths):
    plain = "\n;\n".join(open(p, encoding="utf-8").read() for p in paths).encode("utf-8")
    salt, iv = current_salt() or os.urandom(16), os.urandom(12)
    ct = AESGCM(key(pw, salt)).encrypt(iv, plain, None)
    blob = {"v": 1, "iter": ITER, "salt": b64(salt), "iv": b64(iv), "ct": b64(ct)}
    return "/* Encrypted. Open the app and enter the family password. */\nwindow.KXO_ENC = " + json.dumps(blob) + ";\n"

def decrypt(pw, path):
    src = open(path, encoding="utf-8").read()
    blob = json.loads(re.search(r"window\.KXO_ENC\s*=\s*(\{.*\});", src, re.S).group(1))
    k = key(pw, base64.b64decode(blob["salt"]), blob["iter"])
    return AESGCM(k).decrypt(base64.b64decode(blob["iv"]), base64.b64decode(blob["ct"]), None).decode("utf-8")

if __name__ == "__main__":
    mode, pw = sys.argv[1], sys.argv[2]
    if mode == "encrypt": sys.stdout.write(encrypt(pw, sys.argv[3:]))
    elif mode == "decrypt": sys.stdout.write(decrypt(pw, sys.argv[3]))
    else: sys.exit("mode must be encrypt or decrypt")
