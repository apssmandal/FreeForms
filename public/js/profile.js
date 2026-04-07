import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut, updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } 
from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';
import { toast, apiCall } from './utils.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let currentUser = null;

// Require authentication
onAuthStateChanged(auth, user => {
  if (!user) { window.location.href = '/auth.html'; return; }
  currentUser = user;
  initUserUI(user);
});

function initUserUI(user) {
  const name = user.displayName || user.email.split('@')[0];
  document.getElementById('user-name').textContent = name;
  document.getElementById('user-email').textContent = user.email;
  document.getElementById('user-avatar').textContent = name.charAt(0).toUpperCase();

  document.getElementById('p-name').value = user.displayName || '';
  document.getElementById('p-email').value = user.email || '';
}

document.getElementById('btn-logout')?.addEventListener('click', async () => {
  await signOut(auth); window.location.href = '/auth.html';
});

// Update Profile
document.getElementById('profile-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('btn-save-profile');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    const newName = document.getElementById('p-name').value.trim();
    await updateProfile(currentUser, { displayName: newName });
    initUserUI(auth.currentUser);
    toast('Profile updated!', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save Profile';
  }
});

// Helper for Re-authentication if needed
async function promptReauth() {
  return new Promise((resolve, reject) => {
    const isGoogle = currentUser.providerData.some(p => p.providerId === 'google.com');
    if (isGoogle) {
      toast('Google login detected, please sign out and sign back in to perform sensitive actions.', 'error');
      return reject(new Error('Requires recent login'));
    }

    const modal = document.getElementById('modal-reauth');
    modal.classList.add('open');
    const form = document.getElementById('reauth-form');
    
    document.getElementById('btn-close-reauth').onclick = () => {
      modal.classList.remove('open');
      reject(new Error('Verification cancelled'));
    };
    
    form.onsubmit = async (e) => {
      e.preventDefault();
      const pass = document.getElementById('reauth-password').value;
      const credential = EmailAuthProvider.credential(currentUser.email, pass);
      try {
        await reauthenticateWithCredential(currentUser, credential);
        modal.classList.remove('open');
        document.getElementById('reauth-password').value = '';
        resolve();
      } catch (err) {
        toast('Incorrect password.', 'error');
      }
    };
  });
}

// Update Password
document.getElementById('password-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const p1 = document.getElementById('p-new-pass').value;
  const p2 = document.getElementById('p-new-pass-confirm').value;
  if (p1 !== p2) return toast('Passwords do not match.', 'error');
  if (currentUser.providerData.some(p => p.providerId === 'google.com')) {
    return toast('You are using Google sign in. Cannot change password here.', 'error');
  }

  const btn = document.getElementById('btn-save-password');
  btn.disabled = true; btn.textContent = 'Updating...';
  
  try {
    await updatePassword(currentUser, p1);
    toast('Password updated successfully.', 'success');
    document.getElementById('password-form').reset();
  } catch (err) {
    if (err.code === 'auth/requires-recent-login') {
      try {
        await promptReauth();
        await updatePassword(currentUser, p1);
        toast('Password updated successfully.', 'success');
        document.getElementById('password-form').reset();
      } catch (reauthErr) {
        toast(reauthErr.message, 'error');
      }
    } else {
      toast(err.message, 'error');
    }
  } finally {
    btn.disabled = false; btn.textContent = 'Update Password';
  }
});

// Delete Account
document.getElementById('btn-delete-account')?.addEventListener('click', async () => {
  const confirmText = prompt('This will immediately delete all your forms and submissions permanently.\n\nType "DELETE" to confirm.');
  if (confirmText !== 'DELETE') return toast('Deletion cancelled.', 'info');
  
  const btn = document.getElementById('btn-delete-account');
  btn.disabled = true; btn.textContent = 'Deleting...';

  try {
    // 1. Tell backend to purge data
    await apiCall(auth, '/api/account', { method: 'DELETE' });
    
    // 2. Clear frontend state and redirect
    toast('Account deleted.', 'success');
    setTimeout(() => {
      window.location.href = '/index.html';
    }, 1500);
  } catch (err) {
    if (err.message.includes('auth/requires-recent-login')) {
      try {
        await promptReauth();
        await apiCall(auth, '/api/account', { method: 'DELETE' });
        toast('Account deleted.', 'success');
        setTimeout(() => window.location.href = '/index.html', 1500);
      } catch (e) {
        toast(e.message, 'error');
        btn.disabled = false; btn.textContent = 'Delete My Account';
      }
    } else {
      toast(err.message, 'error');
      btn.disabled = false; btn.textContent = 'Delete My Account';
    }
  }
});
