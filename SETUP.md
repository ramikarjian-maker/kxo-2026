# Karjian × Oh Thanksgiving app

Live at https://ramikarjian-maker.github.io/kxo-2026/

The site is behind a family password. All the content (the plan, places, flights, people, kitchen plan)
and the Firebase settings are **encrypted** in `js/data.enc.js`. Without the password there is nothing
readable here. The plaintext source is never committed.

- `js/gate.js`: password screen; decrypts the content and starts the app (the device remembers it)
- `js/app.js`: the app
- `js/cloud.js`: shared sign-ups and the gratitude wall (Firebase)
- `tools/crypt.py`: encrypt / decrypt the content (`encrypt PASSWORD data.js config.js` / `decrypt PASSWORD js/data.enc.js`)
- `firestore.rules`: database rules to paste into Firebase

Passwords are case-insensitive (the app lowercases what people type), so encrypt with a lowercase password.
To change the password: decrypt with the old one, re-encrypt with the new one, push.

## Preview tricks
- `?now=2026-11-26T15:20` pretends it's that time (Pacific), to see Now + Next and the kitchen clock
- `?mock=1` turns on sign-ups and the wall saved on this phone only, for trying them out

## Turning on sign-ups + the gratitude wall (one time, ~10 min, free)
1. Go to https://console.firebase.google.com, sign in with Google, and click **Create a project**. Name it `kxo-2026`. Turn **off** Google Analytics. Create.
2. In the left menu, open **Build > Firestore Database > Create database**. Pick location **us-west1 (Oregon)** and **production mode**. Create.
3. On the Firestore **Rules** tab, replace everything with the contents of `firestore.rules` from this repo. Click **Publish**.
4. Go to **Project Overview** (the gear icon) > **Project settings**. Under **Your apps**, click the **</>** (Web) icon. Nickname it `kxo` and click **Register app**. Skip Firebase Hosting.
5. Copy the `firebaseConfig = { ... }` block it shows, and send it to Claude. Claude adds it to the encrypted content and pushes.
