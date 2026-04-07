'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

admin.initializeApp();
const db = admin.firestore();

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sendResponse(req, res, redirectUrl) {
  const wantsJson = (req.headers['accept'] || '').includes('application/json');
  if (wantsJson) return res.json({ ok: true, message: 'Submission received.' });
  return res.redirect(302, redirectUrl || '/thanks.html');
}

async function sendNotificationEmail(form, data, meta) {
  let cfg;
  try { cfg = functions.config().smtp || {}; } catch { return; }
  if (!cfg.host || !cfg.user || !cfg.pass) return;

  const transporter = nodemailer.createTransporter({
    host: cfg.host,
    port: parseInt(cfg.port || '587', 10),
    secure: cfg.secure === 'true',
    auth: { user: cfg.user, pass: cfg.pass }
  });

  const rows = Object.entries(data).map(([k, v]) =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #2a2a40;color:#9999bb;font-size:12px;font-weight:600;text-transform:uppercase">${escapeHtml(k)}</td>` +
    `<td style="padding:8px 12px;border-bottom:1px solid #2a2a40;color:#e2e2f0">${escapeHtml(String(v))}</td></tr>`
  ).join('');

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#07070f;font-family:sans-serif">
<div style="max-width:580px;margin:40px auto;background:#11111b;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)">
  <div style="background:linear-gradient(135deg,#7c6fff,#22d3ee);padding:28px;text-align:center">
    <div style="display:inline-block;width:44px;height:44px;background:rgba(255,255,255,0.2);border-radius:10px;line-height:44px;font-size:16px;font-weight:900;color:white">FF</div>
    <h1 style="color:white;margin:12px 0 4px;font-size:18px">New Submission</h1>
    <p style="color:rgba(255,255,255,0.8);margin:0;font-size:13px">Form: <strong>${escapeHtml(form.name)}</strong></p>
  </div>
  <div style="padding:24px">
    <table style="width:100%;border-collapse:collapse;border:1px solid #2a2a40;border-radius:8px;overflow:hidden">${rows}</table>
    <p style="color:#6e6e8a;font-size:11px;text-align:center;margin-top:20px">
      Sent by <a href="https://freeforms.web.app" style="color:#7c6fff">FreeForms</a> &middot;
      <a href="https://freeforms.web.app/dashboard.html" style="color:#7c6fff">View Dashboard</a>
    </p>
  </div>
</div></body></html>`;

  await transporter.sendMail({
    from: `"FreeForms" <${cfg.from || cfg.user}>`,
    to: form.notifyEmail,
    replyTo: meta._replyto || undefined,
    cc: meta._cc || undefined,
    subject: meta._subject || form.settings?.subject || `New submission: ${form.name}`,
    html
  });
}

// ─────────────────────────────────────────────────────────────
// SUBMIT FORM  —  POST /f/{formId}
// ─────────────────────────────────────────────────────────────
exports.submitForm = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const parts = req.path.split('/').filter(Boolean);
  const formId = parts[parts.length - 1];
  if (!formId || formId === 'f') return res.status(400).json({ error: 'Form ID required' });

  try {
    const formSnap = await db.collection('forms').doc(formId).get();
    if (!formSnap.exists) return res.status(404).json({ error: 'Form not found' });
    const form = formSnap.data();
    if (!form.active) return res.status(403).json({ error: 'Form is disabled' });

    if (form.settings?.domainFilterEnabled && form.settings?.allowedDomains) {
      const origin = req.headers.origin || req.headers.referer || '';
      try {
        const originHost = new URL(origin).hostname.toLowerCase();
        const allowed = form.settings.allowedDomains.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
        if (allowed.length > 0 && !allowed.some(d => originHost === d || originHost.endsWith('.' + d))) {
          return res.status(403).json({ error: 'Origin not allowed' });
        }
      } catch (e) {
        return res.status(403).json({ error: 'Origin not allowed or invalid' });
      }
    }

    const body = req.body || {};
    const SPECIAL = ['_next', '_subject', '_replyto', '_cc', '_bcc', '_honeypot', '_template'];
    const honeypotField = form.settings?.honeypotField || '_honeypot';

    // Spam: honeypot filled → silently discard
    if (body[honeypotField]) return sendResponse(req, res, body._next || form.settings?.redirectUrl);

    const meta = {}, data = {};
    for (const [k, v] of Object.entries(body)) {
      if (SPECIAL.includes(k)) meta[k] = String(v).slice(0, 500);
      else if (!k.startsWith('_')) data[k] = typeof v === 'string' ? v.slice(0, 5000) : v;
    }

    await db.collection('submissions').add({
      formId, data, meta,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      ip: (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim(),
      userAgent: (req.headers['user-agent'] || '').slice(0, 300),
      spam: false, read: false
    });

    await db.collection('forms').doc(formId).update({
      submissionsCount: admin.firestore.FieldValue.increment(1),
      lastSubmission: admin.firestore.FieldValue.serverTimestamp()
    });

    // Fire-and-forget email
    sendNotificationEmail(form, data, meta).catch(e => console.error('email:', e.message));

    return sendResponse(req, res, meta._next || form.settings?.redirectUrl);
  } catch (err) {
    console.error('submitForm:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// REST API  —  /api/**  (requires Firebase Auth Bearer token)
// ─────────────────────────────────────────────────────────────
const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = await admin.auth().verifyIdToken(header.slice(7));
    next();
  } catch { return res.status(401).json({ error: 'Invalid token' }); }
}

/* ── FORMS ── */

// List all forms for current user
app.get('/api/forms', authenticate, async (req, res) => {
  try {
    const snap = await db.collection('forms')
      .where('userId', '==', req.user.uid)
      .orderBy('createdAt', 'desc').get();
    res.json({ forms: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create a form
app.post('/api/forms', authenticate, async (req, res) => {
  try {
    const { name, notifyEmail } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const ref = await db.collection('forms').add({
      name: name.trim(),
      notifyEmail: notifyEmail || req.user.email || '',
      userId: req.user.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      submissionsCount: 0,
      active: true,
      settings: {
        redirectUrl: '',
        honeypotField: '_honeypot',
        subject: `New submission: ${name.trim()}`
      }
    });
    const doc = await ref.get();
    res.json({ id: ref.id, ...doc.data() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get single form
app.get('/api/forms/:formId', authenticate, async (req, res) => {
  try {
    const doc = await db.collection('forms').doc(req.params.formId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    if (doc.data().userId !== req.user.uid) return res.status(403).json({ error: 'Forbidden' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Update form settings
app.patch('/api/forms/:formId', authenticate, async (req, res) => {
  try {
    const doc = await db.collection('forms').doc(req.params.formId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    if (doc.data().userId !== req.user.uid) return res.status(403).json({ error: 'Forbidden' });
    const allowed = ['name', 'notifyEmail', 'active', 'settings'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    await db.collection('forms').doc(req.params.formId).update(update);
    const updated = await db.collection('forms').doc(req.params.formId).get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete form + all its submissions
app.delete('/api/forms/:formId', authenticate, async (req, res) => {
  try {
    const doc = await db.collection('forms').doc(req.params.formId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    if (doc.data().userId !== req.user.uid) return res.status(403).json({ error: 'Forbidden' });
    const subs = await db.collection('submissions').where('formId', '==', req.params.formId).get();
    const batch = db.batch();
    subs.docs.forEach(d => batch.delete(d.ref));
    batch.delete(db.collection('forms').doc(req.params.formId));
    await batch.commit();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── SUBMISSIONS ── */

// List submissions for a form
app.get('/api/forms/:formId/submissions', authenticate, async (req, res) => {
  try {
    const formDoc = await db.collection('forms').doc(req.params.formId).get();
    if (!formDoc.exists) return res.status(404).json({ error: 'Not found' });
    if (formDoc.data().userId !== req.user.uid) return res.status(403).json({ error: 'Forbidden' });
    const snap = await db.collection('submissions')
      .where('formId', '==', req.params.formId)
      .orderBy('submittedAt', 'desc').get();
    res.json({ submissions: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete a submission
app.delete('/api/submissions/:subId', authenticate, async (req, res) => {
  try {
    const subDoc = await db.collection('submissions').doc(req.params.subId).get();
    if (!subDoc.exists) return res.status(404).json({ error: 'Not found' });
    const formDoc = await db.collection('forms').doc(subDoc.data().formId).get();
    if (!formDoc.exists || formDoc.data().userId !== req.user.uid) return res.status(403).json({ error: 'Forbidden' });
    await db.collection('submissions').doc(req.params.subId).delete();
    await db.collection('forms').doc(subDoc.data().formId).update({
      submissionsCount: admin.firestore.FieldValue.increment(-1)
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Mark submission as read
app.patch('/api/submissions/:subId/read', authenticate, async (req, res) => {
  try {
    const subDoc = await db.collection('submissions').doc(req.params.subId).get();
    if (!subDoc.exists) return res.status(404).json({ error: 'Not found' });
    const formDoc = await db.collection('forms').doc(subDoc.data().formId).get();
    if (!formDoc.exists || formDoc.data().userId !== req.user.uid) return res.status(403).json({ error: 'Forbidden' });
    await db.collection('submissions').doc(req.params.subId).update({ read: true });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── USER ACCOUNT ── */

// Delete entire user account
app.delete('/api/account', authenticate, async (req, res) => {
  try {
    const uid = req.user.uid;
    const formsSnap = await db.collection('forms').where('userId', '==', uid).get();
    
    // Process form deletion in batches
    for (let formDoc of formsSnap.docs) {
      const subsSnap = await db.collection('submissions').where('formId', '==', formDoc.id).get();
      // Firestore batches have a 500 operation limit, but typically form submissions are deleted via scheduled tasks for scale. 
      // For this open-source level, we chunk it to 500 just in case.
      let batch = db.batch();
      let count = 0;
      for (let subDoc of subsSnap.docs) {
        batch.delete(subDoc.ref);
        count++;
        if (count === 490) {
          await batch.commit();
          batch = db.batch();
          count = 0;
        }
      }
      batch.delete(formDoc.ref);
      await batch.commit();
    }
    
    await admin.auth().deleteUser(uid);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

exports.api = functions.https.onRequest(app);
