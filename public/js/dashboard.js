import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut, sendEmailVerification }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { firebaseConfig, APP_BASE_URL } from './firebase-config.js';
import { toast, apiCall, copyToClipboard, openModal, closeModal } from './utils.js';

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

let currentUser = null;
let allForms    = [];

// ── Auth gate ──
onAuthStateChanged(auth, user => {
  if (!user) { window.location.href = '/auth.html'; return; }
  currentUser = user;
  initUserUI(user);
  loadForms();
});

function initUserUI(user) {
  if (!user.emailVerified) {
    const banner = document.getElementById('verify-banner');
    if (banner) {
      banner.style.display = 'flex';
      const btn = document.getElementById('btn-resend-verify');
      btn?.addEventListener('click', async () => {
        btn.disabled = true; btn.textContent = 'Sending...';
        try {
          await sendEmailVerification(user);
          toast('Verification email sent to ' + user.email, 'success');
          btn.textContent = 'Sent!';
        } catch (err) {
          toast(err.message, 'error');
          btn.disabled = false; btn.textContent = 'Resend';
        }
      });
    }
  }
  const name = user.displayName || user.email.split('@')[0];
  document.getElementById('user-name').textContent  = name;
  document.getElementById('user-email').textContent = user.email;
  document.getElementById('user-avatar').textContent = name.charAt(0).toUpperCase();
}

// ── Logout ──
document.getElementById('btn-logout')?.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = '/auth.html';
});

// ── Load forms ──
async function loadForms() {
  const grid = document.getElementById('forms-grid');
  grid.innerHTML = `<div class="loading-overlay"><div class="spinner"></div></div>`;
  try {
    const data = await apiCall(auth, '/api/forms');
    allForms = data.forms || [];
    renderForms(allForms);
    updateStats(allForms);
  } catch (err) {
    grid.innerHTML = `<p style="color:var(--danger);padding:20px">Error: ${err.message}</p>`;
    toast('Failed to load forms', 'error');
  }
}

function renderForms(forms) {
  const grid = document.getElementById('forms-grid');
  document.getElementById('stat-forms').textContent  = forms.length;
  document.getElementById('stat-subs').textContent   = forms.reduce((a, f) => a + (f.submissionsCount || 0), 0);

  if (!forms.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" height="48" viewBox="0 -960 960 960" width="48" fill="var(--muted)"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm80-80h400v-80H280v80Zm0-160h400v-80H280v80Zm0-160h400v-80H280v80ZM200-760v560-560Z"/></svg></div>
        <h3>No forms yet</h3>
        <p>Create your first form to start receiving submissions.</p>
        <button class="btn btn-primary" onclick="document.getElementById('modal-create').classList.add('open')">+ Create Form</button>
      </div>`;
    return;
  }

  grid.innerHTML = forms.map(form => `
    <div class="form-card" id="card-${form.id}">
      <div class="form-card-header">
        <span class="form-name">${esc(form.name)}</span>
        <span class="badge ${form.active ? 'badge-active' : 'badge-paused'}">${form.active ? 'Active' : 'Paused'}</span>
      </div>
      <div class="form-endpoint">
        <span class="endpoint-url" title="${APP_BASE_URL}/f/${form.id}">${APP_BASE_URL}/f/${form.id}</span>
        <button class="btn-copy" title="Copy endpoint" style="background:transparent;border:none;cursor:pointer;color:var(--muted);display:flex;align-items:center;justify-content:center" onclick="copyEndpoint('${form.id}')"><svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16" fill="currentColor"><path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/></svg></button>
      </div>
      <div class="form-meta">
        <div>
          <div class="form-meta-count">${form.submissionsCount || 0}</div>
          <div>submissions</div>
        </div>
        <div style="text-align:right;font-size:0.75rem;color:var(--muted);font-family:monospace;background:rgba(0,0,0,0.03);padding:4px 8px;border-radius:4px">
          ID: ${form.id}
        </div>
      </div>
      <div class="form-actions">
        <a href="/form.html?id=${form.id}" class="btn btn-ghost btn-sm">View</a>
        <a href="/form.html?id=${form.id}&tab=settings" class="btn btn-ghost btn-sm">Settings</a>
        <button class="btn btn-danger btn-sm" onclick="confirmDelete('${form.id}','${esc(form.name)}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function updateStats(forms) {
  const total   = forms.reduce((a, f) => a + (f.submissionsCount || 0), 0);
  const active  = forms.filter(f => f.active).length;
  document.getElementById('stat-forms').textContent  = forms.length;
  document.getElementById('stat-subs').textContent   = total;
  document.getElementById('stat-active').textContent = active;
}

// ── Create form ──
document.getElementById('btn-create')?.addEventListener('click', () => openModal('modal-create'));
document.getElementById('btn-close-create')?.addEventListener('click', () => closeModal('modal-create'));

document.getElementById('create-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const name        = document.getElementById('form-name-input').value.trim();
  const notifyEmail = document.getElementById('form-email-input').value.trim() || currentUser.email;
  const btn = document.getElementById('btn-create-submit');

  if (!name) { toast('Form name is required', 'error'); return; }
  btn.disabled = true; btn.textContent = 'Creating…';

  try {
    const form = await apiCall(auth, '/api/forms', { method: 'POST', body: { name, notifyEmail } });
    allForms.unshift(form);
    renderForms(allForms);
    updateStats(allForms);
    closeModal('modal-create');
    document.getElementById('create-form').reset();
    toast(`Form "${name}" created!`, 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Create Form';
  }
});

// ── Delete form ──
let deleteTargetId = null;
window.confirmDelete = (formId, name) => {
  deleteTargetId = formId;
  document.getElementById('delete-form-name').textContent = name;
  openModal('modal-delete');
};

document.getElementById('btn-close-delete')?.addEventListener('click', () => closeModal('modal-delete'));
document.getElementById('btn-confirm-delete')?.addEventListener('click', async () => {
  if (!deleteTargetId) return;
  const btn = document.getElementById('btn-confirm-delete');
  btn.disabled = true; btn.textContent = 'Deleting…';
  try {
    await apiCall(auth, `/api/forms/${deleteTargetId}`, { method: 'DELETE' });
    allForms = allForms.filter(f => f.id !== deleteTargetId);
    renderForms(allForms);
    updateStats(allForms);
    closeModal('modal-delete');
    toast('Form deleted.', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Delete';
    deleteTargetId = null;
  }
});

// ── Helpers ──
window.copyEndpoint = id => copyToClipboard(`${APP_BASE_URL}/f/${id}`, 'Endpoint copied!');

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
