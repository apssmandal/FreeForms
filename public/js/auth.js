import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile,
         signInWithPopup, GoogleAuthProvider, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';
import { toast } from './utils.js';

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Redirect if already signed in
onAuthStateChanged(auth, user => {
  if (user) window.location.href = '/dashboard.html';
});

// Tab switching
const params = new URLSearchParams(window.location.search);
const defaultTab = params.get('tab') || 'login';

document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${target}`)?.classList.add('active');
  });
});

// Set default tab from URL
if (defaultTab === 'register') {
  document.querySelector('[data-tab="register"]')?.click();
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.add('show'); }
}
function hideError(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
}
function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.querySelector('.btn-text').style.display = loading ? 'none' : '';
  btn.querySelector('.btn-spinner').style.display = loading ? 'inline-block' : 'none';
}

// ── Login ──
document.getElementById('login-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  hideError('login-error');
  const btn   = document.getElementById('login-btn');
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  setLoading(btn, true);
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    // onAuthStateChanged will redirect
  } catch (err) {
    setLoading(btn, false);
    showError('login-error', friendlyError(err.code));
  }
});

// ── Register ──
document.getElementById('register-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  hideError('register-error');
  const btn   = document.getElementById('register-btn');
  const email = document.getElementById('register-email').value.trim();
  const pass  = document.getElementById('register-pass').value;
  const conf  = document.getElementById('register-confirm').value;
  if (!name) { showError('register-error', 'Name is required.'); return; }
  if (pass !== conf) { showError('register-error', 'Passwords do not match.'); return; }
  if (pass.length < 8) { showError('register-error', 'Password must be at least 8 characters.'); return; }
  setLoading(btn, true);
  try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    // onAuthStateChanged will redirect
  } catch (err) {
    setLoading(btn, false);
    showError('register-error', friendlyError(err.code));
  }
});

// ── Google Sign-In ──
document.querySelectorAll('.btn-google').forEach(btn => {
  btn.addEventListener('click', async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      toast(friendlyError(err.code), 'error');
    }
  });
});

function friendlyError(code) {
  const map = {
    'auth/invalid-email':          'Invalid email address.',
    'auth/user-not-found':         'No account with this email.',
    'auth/wrong-password':         'Incorrect password.',
    'auth/email-already-in-use':   'Email already registered. Try signing in.',
    'auth/weak-password':          'Password is too weak.',
    'auth/too-many-requests':      'Too many attempts. Please try again later.',
    'auth/popup-closed-by-user':   'Sign-in popup was closed.',
    'auth/network-request-failed': 'Network error. Check your connection.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}
