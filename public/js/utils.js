// ─── Shared utility functions ───────────────────────────────

/** Show a toast notification */
export function toast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  el.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, duration);
}

/** Copy text to clipboard */
export async function copyToClipboard(text, successMsg = 'Copied!') {
  try {
    await navigator.clipboard.writeText(text);
    toast(successMsg, 'success');
    return true;
  } catch {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
    toast(successMsg, 'success');
    return true;
  }
}

/** Format a Firestore timestamp or Date */
export function formatDate(ts) {
  if (!ts) return '—';
  let d;
  if (ts._seconds) d = new Date(ts._seconds * 1000);
  else if (ts.seconds) d = new Date(ts.seconds * 1000);
  else if (ts.toDate) d = ts.toDate();
  else d = new Date(ts);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Export data as CSV */
export function exportCSV(submissions, filename = 'submissions.csv') {
  if (!submissions.length) { toast('No data to export', 'error'); return; }
  const allKeys = [...new Set(submissions.flatMap(s => Object.keys(s.data || {})))];
  const rows = [
    ['Serial No', 'Date', ...allKeys],
    ...submissions.map((s, idx) => [
      submissions.length - idx,
      JSON.stringify(formatDate(s.submittedAt)),
      ...allKeys.map(k => JSON.stringify(s.data?.[k] ?? ''))
    ])
  ];
  const csv = rows.map(r => r.join(',')).join('\n');
  download(csv, filename, 'text/csv');
  toast('CSV downloaded!', 'success');
}

/** Export data as JSON */
export function exportJSON(submissions, filename = 'submissions.json') {
  if (!submissions.length) { toast('No data to export', 'error'); return; }
  const data = submissions.map((s, idx) => ({
    serialNo: submissions.length - idx,
    id: s.id,
    submittedAt: s.submittedAt ? formatDate(s.submittedAt) : null,
    data: s.data
  }));
  download(JSON.stringify(data, null, 2), filename, 'application/json');
  toast('JSON downloaded!', 'success');
}

function download(content, filename, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/** Get Firebase Auth token from current user */
export async function getToken(auth) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  return user.getIdToken();
}

/** Make authenticated API call */
export async function apiCall(auth, path, options = {}) {
  const token = await getToken(auth);
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

/** Redirect if not authenticated */
export function requireAuth(auth, redirectTo = '/auth.html') {
  return new Promise(resolve => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      unsubscribe();
      if (!user) { window.location.href = redirectTo; }
      else resolve(user);
    });
  });
}

/** Redirect if authenticated */
export function redirectIfAuth(auth, redirectTo = '/dashboard.html') {
  return new Promise(resolve => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      unsubscribe();
      if (user) { window.location.href = redirectTo; }
      else resolve(null);
    });
  });
}

/** Open / close modal */
export function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
export function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

/** Get URL param */
export function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/** Debounce */
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}
