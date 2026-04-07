# FreeForms

**[Live Demo](https://freeforms-app.web.app)**

A free, 100% open-source serverless form backend platform built entirely on Google Firebase. Point your frontend HTML forms to your deployed API endpoints to natively collect, store, and act on standard form submission data without wrangling complex backend servers or database integrations.

## Core Capabilities
- **Effortless Deployment**: Single-command push directly to Firebase Cloud Functions and Authentication.
- **Silent Spam Protection**: Out-of-the-box undetectable honeypot fielding drops bots.
- **Admin Dashboard UI**: An elegant, minimal console to manage and securely download submissions (CSV / JSON).
- **Email Notifications**: Hooks straight into native SMTP transports to fire emails directly to your admins upon request receipt.
- **Developer Rest API**: Trigger requests gracefully through `fetch()` for React / Vue projects avoiding HTML redirects.

---

## 🚀 Setting up FreeForms

### 1. Requirements
Ensure you possess the latest copy of [Node.js](https://nodejs.org/en) installed.

### 2. Configuration
Create a project on the [Firebase Console](https://console.firebase.google.com/). You will need an active Authentication module (Email/Password), Cloud Firestore, Cloud Functions, and Firebase Hosting.

1. **Firebaserc:** Copy `.firebaserc.sample` to `.firebaserc` and swap in your chosen Firebase Project ID.
2. **Frontend Config:** Copy `public/js/firebase-config.sample.js` to `public/js/firebase-config.js` and paste your Project's Configuration Web API block natively inside.

### 3. CLI Push
Via your terminal, deploy your localized instance to your Firebase ecosystem:
```bash
npm install -g firebase-tools
firebase login
firebase deploy
```

### 4. Firestore Database Setup
By default, your new Firebase project needs a database to store forms and submissions.
1. In the Firebase Console, traverse to **Firestore Database** on the left panel.
2. Click **Create database**. Start in **Production mode** to keep it secure out of the box.
3. Choose a geographic location close to your users.
4. When you deploy FreeForms via `firebase deploy`, the `firestore.rules` included in this repository will automatically compile and restrict external database access natively, securing your data instantly.

### 5. Outbound Networking (Blaze Plan)
Google inherently restricts external network calls on the default free plan tier (Spark). Since FreeForms relies on NodeMailer sending SMTP requests outward to your inbox:
1. You must explicitly upgrade your Firebase project to the **Blaze (Pay-as-you-go)** plan to allow Cloud Functions to hit external SMTP mail servers.
2. The free allowance on the Blaze plan is extraordinarily generous and accommodates standard indie/maker application capacity before billing actually triggers. (See [Firebase Pricing](https://firebase.google.com/pricing)).

---

## 📚 Official Documentation
For complete API references, fetch() payload structures, React UI template configurations, and spam-mitigation strategies, explore the interactive protocol sheet here:
**[FreeForms Developer Documentation](https://freeforms-app.web.app/docs.html)**

---

## Contributions and Support
FreeForms operates on standard MIT Licensing structure. Pull requests, feedback, and issue submissions are actively monitored and encouraged!
