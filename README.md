# Consumption Tracker

![Homepage](/screenshots/homepage.png?raw=true "Homepage")


---
Consumption Tracker is a lightweight, installable web app for tracking daily intake of anything you want to monitor. Data is stored locally by default and can be synced across devices by signing in with a Firebase account. A month-view calendar provides a quick visual snapshot of patterns over time.

---

## Features

- Local-first data storage (no account required)
- Optional sign-in to sync across devices
- Password reset and account management
- Calendar view with goal-based color indicators
- Recent history list for quick edits
- Works offline and supports PWA installation

---

## Tech Overview

- HTML, CSS, vanilla JavaScript  
- LocalStorage for primary persistence  
- Firebase Auth + Firestore (optional sync)  
- Installable PWA with offline caching

No frameworks or build chain required.

---

## Getting Started

### 1. Clone / download

```bash
git clone https://github.com/YOUR-REPO/consumption-tracker.git
cd consumption-tracker
```

### 2. Add Firebase config

Create a file named `config.js` in the project root. It should look like:

```js
window.firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};
```

### 3. Run locally

Using Python:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Using Node:

```bash
npx serve .
```

---

## Firebase Setup

1. Enable **Email/Password** under Authentication → Sign-in methods  
2. Create a Firestore database  
3. Suggested rules:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /consumptionStates/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## License

MIT
