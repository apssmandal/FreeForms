import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { firebaseConfig, APP_BASE_URL } from './firebase-config.js';
import { toast, apiCall, copyToClipboard, exportCSV, exportJSON, openModal, closeModal, getParam } from './utils.js';

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

const formId  = getParam('id');
const initTab = getParam('tab') || 'submissions';

if (!formId) window.location.href = '/dashboard.html';

let currentUser  = null;
let currentForm  = null;
let allSubs      = [];
let filteredSubs = [];

// ── Auth ──
onAuthStateChanged(auth, user => {
  if (!user) { window.location.href = '/auth.html'; return; }
  currentUser = user;
  initUserUI(user);
  loadForm();
});

function initUserUI(user) {
  const name = user.displayName || user.email.split('@')[0];
  document.getElementById('user-name').textContent  = name;
  document.getElementById('user-email').textContent = user.email;
  document.getElementById('user-avatar').textContent = name.charAt(0).toUpperCase();
}

document.getElementById('btn-logout')?.addEventListener('click', async () => {
  await signOut(auth); window.location.href = '/auth.html';
});

// ── Tabs ──
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${tab}`)?.classList.add('active');
    if (currentUser) {
      if (tab === 'submissions' && !allSubs.length) loadSubmissions();
      if (tab === 'integration') renderIntegration();
    }
  });
  if (btn.dataset.tab === initTab) btn.click();
});

// ── Load form ──
async function loadForm() {
  try {
    const data = await apiCall(auth, `/api/forms/${formId}`);
    currentForm = data;
    document.getElementById('form-title').textContent   = data.name;
    document.getElementById('breadcrumb-name').textContent = data.name;
    populateSettings(data);
    if (initTab === 'submissions' || !initTab) loadSubmissions();
    if (initTab === 'integration') renderIntegration();
  } catch (err) {
    toast('Failed to load form: ' + err.message, 'error');
  }
}

// ── Submissions ──
async function loadSubmissions() {
  const tbody = document.getElementById('subs-tbody');
  tbody.innerHTML = `<tr><td colspan="4"><div class="loading-center"><div class="spinner"></div></div></td></tr>`;
  try {
    const data = await apiCall(auth, `/api/forms/${formId}/submissions`);
    allSubs = data.submissions || [];
    filteredSubs = [...allSubs];
    renderTable(filteredSubs);
    document.getElementById('sub-count').textContent = allSubs.length;
  } catch (err) {
    toast('Failed to load submissions: ' + err.message, 'error');
  }
}

function renderTable(subs) {
  const tbody = document.getElementById('subs-tbody');
  document.getElementById('sub-count').textContent = subs.length;

  if (!subs.length) {
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">📭</div><h3>No submissions yet</h3><p>Point a form to this endpoint to start receiving data.</p></div></td></tr>';
    return;
  }

  const allKeys = [...new Set(subs.flatMap(s => Object.keys(s.data || {})))].slice(0, 8);
  document.getElementById('subs-thead').innerHTML = '<tr><th>Serial No</th><th>Date and Time</th><th>Data</th><th>Actions</th></tr>';

  tbody.innerHTML = subs.map((s, idx) => {
    const serial = subs.length - idx;
    return `
    <tr class="${s.read ? '' : 'unread-row'}" id="row-${s.id}">
      <td style="font-weight:600;color:var(--text)">#${serial}</td>
      <td class="td-date">${fmtDate(s.submittedAt)}</td>
      <td class="td-data">
        ${allKeys.map(k => s.data?.[k] !== undefined ? `
          <div class="data-field">
            <span class="data-key">${esc(k)}:</span>
            <span class="data-val">${esc(String(s.data[k])).slice(0, 120)}</span>
          </div>` : '').join('')}
      </td>
      <td class="td-actions">
        ${!s.read ? `<button class="btn btn-ghost btn-sm" onclick="markRead('${s.id}')">Mark Read</button>` : ''}
        <button class="btn btn-danger btn-sm" onclick="deleteSub('${s.id}')">Delete</button>
      </td>
    </tr>
  `}).join('');
}

// Search
document.getElementById('sub-search')?.addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  filteredSubs = q
    ? allSubs.filter(s => JSON.stringify(s.data).toLowerCase().includes(q))
    : [...allSubs];
  renderTable(filteredSubs);
});

// Export
document.getElementById('btn-export-csv')?.addEventListener('click',  () => exportCSV(allSubs,  `${currentForm?.name || 'submissions'}.csv`));
document.getElementById('btn-export-json')?.addEventListener('click', () => exportJSON(allSubs, `${currentForm?.name || 'submissions'}.json`));

// Mark read
window.markRead = async (subId) => {
  try {
    await apiCall(auth, `/api/submissions/${subId}/read`, { method: 'PATCH' });
    const s = allSubs.find(s => s.id === subId);
    if (s) s.read = true;
    renderTable(filteredSubs);
  } catch (err) { toast(err.message, 'error'); }
};

// Delete submission
window.deleteSub = async (subId) => {
  if (!confirm('Delete this submission?')) return;
  try {
    await apiCall(auth, `/api/submissions/${subId}`, { method: 'DELETE' });
    allSubs      = allSubs.filter(s => s.id !== subId);
    filteredSubs = filteredSubs.filter(s => s.id !== subId);
    renderTable(filteredSubs);
    toast('Submission deleted.', 'success');
  } catch (err) { toast(err.message, 'error'); }
};

// ── Integration code ──
function renderIntegration() {
  if (!currentForm) return;
  const url = `${APP_BASE_URL}/f/${formId}`;
  document.getElementById('html-snippet').textContent =
`<form action="${url}" method="POST">
  <!-- Optional: redirect after submission -->
  <input type="hidden" name="_next" value="https://yoursite.com/thanks" />
  <!-- Optional: custom email subject -->
  <input type="hidden" name="_subject" value="New contact message" />
  <!-- Spam protection: honeypot (keep it hidden) -->
  <input type="text" name="_honeypot" style="display:none" tabindex="-1" autocomplete="off" />

  <label>Your Email <input type="email" name="email" required /></label>
  <label>Message   <textarea name="message" required></textarea></label>
  <button type="submit">Send</button>
</form>`;

  document.getElementById('js-snippet').textContent =
`async function handleSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);

  const res = await fetch("${url}", {
    method: "POST",
    headers: { "Accept": "application/json" },
    body: data
  });

  if (res.ok) {
    const json = await res.json();
    alert(json.message); // "Submission received."
    form.reset();
  } else {
    alert("Something went wrong.");
  }
}

document.querySelector("form").addEventListener("submit", handleSubmit);`;

  document.getElementById('endpoint-display').textContent = url;
}

document.getElementById('btn-copy-endpoint')?.addEventListener('click', () => {
  copyToClipboard(`${APP_BASE_URL}/f/${formId}`, 'Endpoint copied!');
});
document.getElementById('btn-copy-html')?.addEventListener('click', () => {
  copyToClipboard(document.getElementById('html-snippet').textContent, 'HTML snippet copied!');
});
document.getElementById('btn-copy-js')?.addEventListener('click', () => {
  copyToClipboard(document.getElementById('js-snippet').textContent, 'JS snippet copied!');
});

// ── Settings ──
function populateSettings(form) {
  document.getElementById('s-name').value         = form.name || '';
  document.getElementById('s-email').value        = form.notifyEmail || '';
  document.getElementById('s-redirect').value     = form.settings?.redirectUrl || '';
  document.getElementById('s-honeypot').value     = form.settings?.honeypotField || '_honeypot';
  document.getElementById('s-subject').value      = form.settings?.subject || '';
    document.getElementById('s-active').checked     = form.active !== false;
  
  const lblActive = document.getElementById('lbl-form-active');
  if (lblActive) {
    lblActive.textContent = form.active !== false ? 'Form Active' : 'Form Paused';
    lblActive.style.color = form.active !== false ? 'inherit' : 'var(--warn)';
  }
  
  const domainActive = document.getElementById('s-active')?.addEventListener('change', e => {
  const lblActive = document.getElementById('lbl-form-active');
  if (lblActive) {
    lblActive.textContent = e.target.checked ? 'Form Active' : 'Form Paused';
    lblActive.style.color = e.target.checked ? 'inherit' : 'var(--warn)';
  }
});

document.getElementById('s-domain-active');
  if (domainActive) {
    domainActive.checked = form.settings?.domainFilterEnabled || false;
    document.getElementById('s-domains').value = form.settings?.allowedDomains || '';
    document.getElementById('s-domain-group').style.display = domainActive.checked ? 'block' : 'none';
  }
}

document.getElementById('s-domain-active')?.addEventListener('change', e => {
  document.getElementById('s-domain-group').style.display = e.target.checked ? 'block' : 'none';
});

document.getElementById('settings-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('btn-save-settings');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const update = {
      name:        document.getElementById('s-name').value.trim(),
      notifyEmail: document.getElementById('s-email').value.trim(),
      active:      document.getElementById('s-active').checked,
      settings: {
        redirectUrl:   document.getElementById('s-redirect').value.trim(),
        honeypotField: document.getElementById('s-honeypot').value.trim() || '_honeypot',
        subject:       document.getElementById('s-subject').value.trim(),
        domainFilterEnabled: document.getElementById('s-domain-active').checked,
        allowedDomains: document.getElementById('s-domains').value.trim()
      }
    };
    await apiCall(auth, `/api/forms/${formId}`, { method: 'PATCH', body: update });
    currentForm = { ...currentForm, ...update };
    document.getElementById('form-title').textContent = update.name;
    document.getElementById('breadcrumb-name').textContent = update.name;
    toast('Settings saved!', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save Settings';
  }
});

// Delete form from settings
document.getElementById('btn-delete-form')?.addEventListener('click', async () => {
  if (!confirm(`Delete form "${currentForm?.name}"? This cannot be undone.`)) return;
  try {
    await apiCall(auth, `/api/forms/${formId}`, { method: 'DELETE' });
    toast('Form deleted.', 'success');
    setTimeout(() => window.location.href = '/dashboard.html', 1000);
  } catch (err) { toast(err.message, 'error'); }
});

// ── Helpers ──
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtDate(ts) {
  if (!ts) return '?';
  let d;
  if (ts._seconds) d = new Date(ts._seconds * 1000);
  else if (ts.seconds) d = new Date(ts.seconds * 1000);
  else d = new Date(ts);
  if (isNaN(d)) return '?';
  return d.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' });
}
