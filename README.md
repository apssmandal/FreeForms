# FreeForms

**[Live Demo](https://freeforms-app.web.app)**

A free, 100% open-source serverless form backend platform built entirely on Google Firebase. Point your frontend HTML forms to your deployed API endpoints to natively collect, store, and act on standard form submission data without wrangling complex backend servers or database integrations.

## Core Capabilities
- **Effortless Deployment**: Push directly to Firebase Cloud Functions and Authentication.
- **Silent Spam Protection**: Out-of-the-box undetectable honeypot fielding drops bots.
- **Admin Dashboard UI**: An elegant, minimal console to manage and securely download submissions (CSV / JSON).
- **Email Notifications**: Hooks straight into native SMTP transports to fire emails directly to your admins upon request receipt.
- **Developer Rest API**: Trigger requests gracefully through `fetch()` for React / Vue projects avoiding HTML redirects.

---

## 🚀 Beginner's Step-by-Step Setup Guide

If you have never used Firebase before, don't worry! This guide will walk you through exactly how to spin up your own secure backend form-processor from absolute scratch.

### Step 1: Create a Google Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project**.
3. Name your project (e.g., `my-freeforms`).
4. You can enable or disable Google Analytics (it is not required for FreeForms).
5. Click **Create Project**. Let it finish provisioning.

### Step 2: Register the Web App (Getting your Config)
1. On the Firebase Project Overview page, click the **Web icon** (`</>`) to add a web app.
2. Name the app (e.g., `freeforms-frontend`). You **must** check the box for **"Also set up Firebase Hosting"**.
3. Click **Register app**.
4. You will see a `firebaseConfig` object containing your API keys. Keep this window open (or copy the block of code), you will need it in Step 6.
5. Click **Next** through the rest of the steps until you are back at the console.

### Step 3: Enable Authentication (To login to your dashboard)
1. On the left sidebar, click **Build** -> **Authentication**.
2. Click **Get Started**.
3. Go to the **Sign-in method** tab.
4. Click **Email/Password**.
5. Enable the **Email/Password** toggle (do not enable Email link) and click **Save**.

### Step 4: Enable Firestore Database (To store your submissions)
1. On the left sidebar, click **Build** -> **Firestore Database**.
2. Click **Create database**.
3. Select **Start in Production Mode** (this is safest; our code will automatically upload security rules later to protect it).
4. Choose a geographic region close to where you or your users live.
5. Click **Enable**.

### Step 5: Upgrade to the Blaze Plan (For Email Notifications)
Google inherently restricts external network calls on the default free plan tier (Spark). Since FreeForms relies on NodeMailer sending SMTP requests outward to your inbox:
1. In the bottom-left corner of the Firebase Console, click **Upgrade**.
2. Select the **Blaze (Pay-as-you-go)** plan.
3. *Note: The free allowance on the Blaze plan is extraordinarily generous and accommodates standard indie/maker application capacity before billing actually triggers. (See [Firebase Pricing](https://firebase.google.com/pricing)).*

### Step 6: Configure Your Local Code
Now that Firebase is ready, download this repository to your computer. Make sure you have [Node.js](https://nodejs.org/en) installed.

1. **Firebaserc:** 
   Rename `.firebaserc.sample` to `.firebaserc`. Open it and replace `"YOUR_PROJECT_ID"` with the actual Project ID of the Firebase project you created in Step 1.
2. **Frontend Config:** 
   Rename `public/js/firebase-config.sample.js` to `public/js/firebase-config.js`. Open it and replace the placeholder `firebaseConfig` variables with your actual API keys from Step 2.

### Step 7: Configure Environment Variables (SMTP)
To make your Cloud Functions send emails securely without exposing your email password in the code, you need to set environments in your terminal before deploying.
Open your command line/terminal and run:
```bash
npm install -g firebase-tools
firebase login
```
Follow the browser prompts to log in. Then set your custom SMTP server details:
```bash
firebase functions:config:set smtp.host="smtp.gmail.com" smtp.port="587" smtp.user="youremail@gmail.com" smtp.pass="YOUR_APP_PASSWORD" smtp.secure="false"
```
*(Tip: If using Gmail, you cannot use your standard password. You must generate an "App Password" inside your Google Account Security settings).*

### Step 8: Deploy FreeForms!
Once your configs and SMTP are set, deploy the entire stack to Google's cloud with one command:

```bash
# Install dependencies for the Cloud Functions
cd functions
npm install
cd ..

# Deploy everything
firebase deploy
```

When it finishes, your terminal will provide a **Hosting URL** (e.g., `https://my-freeforms.web.app`). Go there, create a new account, and start making forms!

---

## 📚 Official Documentation
For complete API references, fetch() payload structures, React UI template configurations, and spam-mitigation strategies, explore the interactive protocol sheet natively hosted within the dashboard:
**[FreeForms Developer Documentation](https://freeforms-app.web.app/docs.html)**

---

## Contributions and Support
FreeForms operates on standard MIT Licensing structure. Pull requests, feedback, and issue submissions are actively monitored and encouraged!
