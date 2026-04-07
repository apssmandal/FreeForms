// ──────────────────────────────────────────────────────────
// firebase-config.js
// Replace the values below with your Firebase project config.
// Get them from: Firebase Console → Project Settings → Your Apps
// ──────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef1234567",
  measurementId: "G-XXXXXXXXXX"
};

// Base URL for your deployed Cloud Functions
const APP_BASE_URL = window.location.origin;

export { firebaseConfig, APP_BASE_URL };
