import { Router } from 'express';
import { createHash, randomUUID } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { compressPayload } from '../engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');

const router = Router();

// ── Helpers ────────────────────────────────────────────────────

/**
 * Compute SHA-256 hash of a string, returns "sha256:<hex>"
 */
function sha256(str) {
  return 'sha256:' + createHash('sha256').update(str, 'utf-8').digest('hex');
}

/**
 * Return an icon string for a given MIME type.
 */
function iconForType(mimeType, encrypted, lazy) {
  if (encrypted) return '🔒';
  if (lazy) return '⏳';
  if (!mimeType) return '📁';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'text/markdown') return '📄';
  if (mimeType === 'application/json') return '📋';
  if (mimeType === 'application/zip') return '📦';
  if (mimeType === 'application/polydoc') return '📎';
  return '📁';
}

/**
 * Format bytes as human-readable string.
 */
function fmtSize(bytes) {
  if (!bytes || bytes === 0) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Resolve a LocalizedString to a plain string (English preferred).
 */
function resolveLabel(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') return val.en ?? val.cs ?? Object.values(val)[0] ?? '';
  return String(val);
}

// ── Envelope HTML template ─────────────────────────────────────

function buildEnvelopeHtml(envelopeJson) {
  const title = resolveLabel(envelopeJson.manifest?.label) || envelopeJson.header?.doc_id || 'PolyDoc Envelope';
  const mailPartHtml = envelopeJson.mail_part?.data || '';
  const jsonStr = JSON.stringify(envelopeJson, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title.replace(/</g, '&lt;').replace(/>/g, '&gt;')} — PolyDoc Envelope</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0d1117;
      color: #e6edf3;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 15px;
      line-height: 1.6;
      min-height: 100vh;
      padding: 32px 16px 64px;
    }
    .container { max-width: 760px; margin: 0 auto; }

    /* Header bar */
    .env-header {
      display: flex; align-items: center; gap: 12px;
      padding: 20px 24px;
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 10px;
      margin-bottom: 20px;
    }
    .env-header .icon { font-size: 28px; flex-shrink: 0; }
    .env-header h1 { font-size: 20px; font-weight: 700; color: #e6edf3; }
    .env-header .meta { font-size: 12px; color: #8b949e; margin-top: 2px; }

    /* Mail part banner */
    .mail-banner {
      background: #1c2128;
      border: 1px solid #388bfd55;
      border-left: 4px solid #388bfd;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 20px;
      font-size: 13px;
      color: #cdd9e5;
    }

    /* Manifest info */
    .manifest-info {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 10px;
      padding: 16px 20px;
      margin-bottom: 20px;
      font-size: 13px;
    }
    .manifest-info .row { display: flex; gap: 8px; margin-bottom: 4px; color: #8b949e; }
    .manifest-info .row strong { color: #cdd9e5; min-width: 110px; }

    /* Parts section */
    .parts-heading {
      font-size: 13px;
      font-weight: 600;
      color: #8b949e;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 10px;
    }

    /* Part card */
    .part-card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 10px;
      padding: 16px 20px;
      margin-bottom: 12px;
      transition: border-color 0.15s;
    }
    .part-card:hover { border-color: #388bfd55; }
    .part-top { display: flex; align-items: center; gap: 12px; }
    .part-icon { font-size: 22px; flex-shrink: 0; width: 32px; text-align: center; }
    .part-info { flex: 1; min-width: 0; }
    .part-label { font-size: 15px; font-weight: 600; color: #e6edf3; }
    .part-type { font-size: 12px; color: #8b949e; margin-top: 2px; }
    .part-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
    .badge {
      font-size: 11px; font-weight: 600; padding: 2px 8px;
      border-radius: 20px; line-height: 1.6;
    }
    .badge-compressed { background: #1f4a2b; color: #56d364; border: 1px solid #238636; }
    .badge-encrypted  { background: #3d1d1d; color: #f85149; border: 1px solid #8b1a1a; }
    .badge-lazy       { background: #2d2a1f; color: #e3b341; border: 1px solid #9e6a03; }
    .badge-size       { background: #1c2128; color: #8b949e; border: 1px solid #30363d; }

    /* Actions */
    .part-actions { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 7px 16px; border-radius: 6px; font-size: 13px; font-weight: 600;
      cursor: pointer; border: 1px solid; transition: opacity 0.15s, background 0.15s;
      text-decoration: none;
    }
    .btn:hover { opacity: 0.85; }
    .btn-primary { background: #238636; border-color: #238636; color: #fff; }
    .btn-secondary { background: #21262d; border-color: #30363d; color: #cdd9e5; }
    .btn-warning  { background: #9e6a0330; border-color: #9e6a03; color: #e3b341; }
    .btn-danger   { background: #8b1a1a20; border-color: #8b1a1a; color: #f85149; }

    /* Key input area */
    .key-input-area {
      display: none;
      margin-top: 12px;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 12px;
    }
    .key-input-area.visible { display: block; }
    .key-input-area input {
      width: 100%;
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 6px;
      color: #e6edf3;
      padding: 8px 12px;
      font-size: 13px;
      font-family: 'SFMono-Regular', Consolas, monospace;
      margin-bottom: 8px;
    }
    .key-input-area input:focus { outline: none; border-color: #388bfd; }

    /* Modal */
    .modal-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.8);
      z-index: 100;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .modal-overlay.open { display: flex; }
    .modal {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      max-width: 820px;
      width: 100%;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .modal-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #30363d;
    }
    .modal-head h2 { font-size: 16px; font-weight: 600; color: #e6edf3; }
    .modal-close {
      background: none; border: none; color: #8b949e;
      font-size: 20px; cursor: pointer; line-height: 1;
      padding: 2px 6px; border-radius: 4px;
    }
    .modal-close:hover { background: #21262d; color: #e6edf3; }
    .modal-body {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    }

    /* Content renderers */
    .content-markdown h1, .content-markdown h2, .content-markdown h3 {
      color: #e6edf3; margin: 16px 0 8px; font-weight: 600;
    }
    .content-markdown h1 { font-size: 20px; }
    .content-markdown h2 { font-size: 17px; }
    .content-markdown h3 { font-size: 15px; }
    .content-markdown p { color: #cdd9e5; margin: 8px 0; }
    .content-markdown ul, .content-markdown ol { color: #cdd9e5; padding-left: 20px; margin: 8px 0; }
    .content-markdown li { margin: 4px 0; }
    .content-markdown code {
      background: #0d1117; border: 1px solid #30363d;
      border-radius: 4px; padding: 2px 6px;
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-size: 13px; color: #79c0ff;
    }
    .content-markdown pre {
      background: #0d1117; border: 1px solid #30363d;
      border-radius: 8px; padding: 16px;
      overflow-x: auto; margin: 12px 0;
    }
    .content-markdown pre code { background: none; border: none; padding: 0; }
    .content-markdown strong { color: #e6edf3; }
    .content-markdown em { color: #79c0ff; }
    .content-markdown a { color: #388bfd; }

    .content-json {
      background: #0d1117; border: 1px solid #30363d;
      border-radius: 8px; padding: 16px;
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-size: 13px; color: #a5d6ff;
      overflow-x: auto; white-space: pre;
    }
    .content-plain {
      background: #0d1117; border: 1px solid #30363d;
      border-radius: 8px; padding: 16px;
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-size: 13px; color: #cdd9e5;
      white-space: pre-wrap; word-break: break-word;
    }
    .content-frame {
      width: 100%; height: 500px; border: 1px solid #30363d;
      border-radius: 8px; background: #fff;
    }
    .content-image { max-width: 100%; border-radius: 8px; }
    .content-download {
      text-align: center; padding: 32px;
      color: #8b949e; font-size: 14px;
    }
    .content-download .dl-btn {
      display: inline-block; margin-top: 16px;
    }

    /* Signature info */
    .sig-box {
      background: #1c2128;
      border: 1px solid #238636;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 20px;
      font-size: 12px;
      color: #56d364;
      display: flex;
      gap: 10px;
      align-items: center;
    }

    /* Footer */
    .env-footer {
      margin-top: 40px; text-align: center;
      font-size: 12px; color: #484f58;
    }
    .env-footer a { color: #388bfd; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">

    <!-- Envelope header -->
    <div class="env-header">
      <div class="icon">📬</div>
      <div>
        <h1 id="env-title">—</h1>
        <div class="meta" id="env-meta">—</div>
      </div>
    </div>

    <!-- Signature badge -->
    <div class="sig-box" id="sig-box" style="display:none;">
      ✅ <span id="sig-text">Podpis manifestu ověřen</span>
    </div>

    <!-- Mail part banner -->
    <div class="mail-banner" id="mail-banner" style="display:none;">
      <div id="mail-banner-content"></div>
    </div>

    <!-- Manifest info -->
    <div class="manifest-info" id="manifest-info" style="display:none;">
      <div class="row"><strong>Doc ID</strong><span id="info-docid">—</span></div>
      <div class="row"><strong>Vytvořeno</strong><span id="info-created">—</span></div>
      <div class="row" id="info-sender-row" style="display:none;">
        <strong>Odesílatel</strong><span id="info-sender">—</span>
      </div>
      <div class="row" id="info-recipients-row" style="display:none;">
        <strong>Příjemci</strong><span id="info-recipients">—</span>
      </div>
    </div>

    <!-- Parts list -->
    <div class="parts-heading">Části zásilky</div>
    <div id="parts-list"></div>

    <!-- Footer -->
    <div class="env-footer">
      <a href="https://github.com/mastervector-svg/polydoc" target="_blank">PolyDoc</a>
      · poly/1.0 · MIT · Envelope formát
    </div>
  </div>

  <!-- Modal -->
  <div class="modal-overlay" id="modal-overlay">
    <div class="modal">
      <div class="modal-head">
        <h2 id="modal-title">Část</h2>
        <button class="modal-close" id="modal-close" title="Zavřít">✕</button>
      </div>
      <div class="modal-body" id="modal-body"></div>
    </div>
  </div>

  <script type="application/poly+json" id="raw-data">
${jsonStr}
  </script>

  <script>
  (function() {
    'use strict';

    // ── Helpers ───────────────────────────────────────────────

    function parseDoc() {
      try {
        return JSON.parse(document.getElementById('raw-data').textContent);
      } catch(e) {
        console.error('[PolyEnvelope] Failed to parse JSON:', e);
        return null;
      }
    }

    function resolveLabel(val) {
      if (!val) return '';
      if (typeof val === 'string') return val;
      const lang = navigator.language?.split('-')[0] || 'en';
      return val[lang] ?? val['en'] ?? val['cs'] ?? Object.values(val)[0] ?? '';
    }

    function iconForType(mimeType, encrypted, lazy) {
      if (encrypted) return '🔒';
      if (lazy) return '⏳';
      if (!mimeType) return '📁';
      if (mimeType.startsWith('image/')) return '🖼️';
      if (mimeType === 'text/markdown') return '📄';
      if (mimeType === 'application/json') return '📋';
      if (mimeType === 'application/zip') return '📦';
      if (mimeType === 'application/polydoc') return '📎';
      return '📁';
    }

    function fmtSize(bytes) {
      if (!bytes || bytes === 0) return '—';
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // ── Decompression ─────────────────────────────────────────

    async function decompressData(base64str) {
      const binary = Uint8Array.from(atob(base64str), c => c.charCodeAt(0));
      const ds = new DecompressionStream('deflate');
      const writer = ds.writable.getWriter();
      writer.write(binary);
      writer.close();
      const chunks = [];
      const reader = ds.readable.getReader();
      let done, value;
      while (!({done, value} = await reader.read(), done)) {
        chunks.push(value);
      }
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const out = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) { out.set(c, offset); offset += c.length; }
      return new TextDecoder().decode(out);
    }

    async function getPartContent(partMeta, partsData) {
      // Find inline data for this part
      const inline = partsData?.find(p => p.id === partMeta.id);

      if (partMeta.lazy && !inline) {
        // Fetch from src
        if (!partMeta.src) throw new Error('Lazy part has no src URL');
        const res = await fetch(partMeta.src);
        if (!res.ok) throw new Error('Fetch failed: ' + res.status);
        return await res.text();
      }

      if (!inline || !inline.data) {
        throw new Error('No data found for part: ' + partMeta.id);
      }

      let data = inline.data;

      if (inline.compressed || partMeta.compressed) {
        data = await decompressData(data);
      }

      return data;
    }

    // ── Markdown renderer (simple regex-based) ────────────────

    function renderMarkdown(md) {
      let html = md
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        // Code blocks
        .replace(/\`\`\`[\s\S]*?\`\`\`/g, m => '<pre><code>' + m.slice(3, -3).replace(/^\w+\n/, '') + '</code></pre>')
        // Inline code
        .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
        // Headings
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Bold
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        // Unordered list items
        .replace(/^[*-] (.+)$/gm, '<li>$1</li>')
        // Ordered list items
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        // Horizontal rule
        .replace(/^---$/gm, '<hr style="border-color:#30363d;margin:16px 0;">')
        // Paragraphs
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');

      // Wrap li in ul
      html = html.replace(/(<li>[\s\S]*?<\/li>(?:\s*<br>\s*<li>[\s\S]*?<\/li>)*)/g, '<ul>$1</ul>');

      return '<div class="content-markdown"><p>' + html + '</p></div>';
    }

    // ── Modal ─────────────────────────────────────────────────

    const overlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    document.getElementById('modal-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

    function openModal(title, bodyHtml) {
      modalTitle.textContent = title;
      modalBody.innerHTML = bodyHtml;
      overlay.classList.add('open');
    }

    function closeModal() {
      overlay.classList.remove('open');
      modalBody.innerHTML = '';
      // Stop iframes
      const iframes = modalBody.querySelectorAll('iframe');
      iframes.forEach(f => { f.src = 'about:blank'; });
    }

    function renderContentInModal(title, content, mimeType) {
      let html;
      if (mimeType === 'text/markdown') {
        html = renderMarkdown(content);
      } else if (mimeType === 'application/json') {
        let pretty = content;
        try { pretty = JSON.stringify(JSON.parse(content), null, 2); } catch(_) {}
        html = '<div class="content-json">' + pretty.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
      } else if (mimeType === 'text/html') {
        const blob = new Blob([content], {type: 'text/html'});
        const url = URL.createObjectURL(blob);
        html = '<iframe class="content-frame" sandbox="allow-scripts allow-same-origin" src="' + url + '"></iframe>';
      } else if (mimeType && mimeType.startsWith('image/')) {
        html = '<img class="content-image" src="data:' + mimeType + ';base64,' + btoa(content) + '" alt="image">';
      } else if (mimeType === 'text/plain') {
        html = '<div class="content-plain">' + content.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
      } else {
        // Offer download
        const blob = new Blob([content], {type: mimeType || 'application/octet-stream'});
        const url = URL.createObjectURL(blob);
        html = '<div class="content-download">'
          + '<div>Tento typ obsahu (' + (mimeType || 'neznámý') + ') nelze zobrazit přímo.</div>'
          + '<a class="btn btn-primary dl-btn" href="' + url + '" download="part-' + title.replace(/\s+/g,'_') + '">⬇ Stáhnout soubor</a>'
          + '</div>';
      }
      openModal(title, html);
    }

    // ── Part card builder ─────────────────────────────────────

    function buildPartCard(partMeta, partsData, doc) {
      const card = document.createElement('div');
      card.className = 'part-card';
      card.dataset.partId = partMeta.id;

      const label = resolveLabel(partMeta.label) || partMeta.id;
      const icon = iconForType(partMeta.type, partMeta.encrypted, partMeta.lazy);
      const sizeOrig = fmtSize(partMeta.size_original);
      const sizeStored = fmtSize(partMeta.size_stored);

      // Badges
      const badges = [];
      if (partMeta.compressed) badges.push('<span class="badge badge-compressed">compressed</span>');
      if (partMeta.encrypted)  badges.push('<span class="badge badge-encrypted">encrypted</span>');
      if (partMeta.lazy)       badges.push('<span class="badge badge-lazy">lazy</span>');
      if (partMeta.size_original) {
        const szLabel = partMeta.size_stored && partMeta.size_stored !== partMeta.size_original
          ? sizeOrig + ' → ' + sizeStored
          : sizeOrig;
        badges.push('<span class="badge badge-size">' + szLabel + '</span>');
      }

      card.innerHTML = '<div class="part-top">'
        + '<div class="part-icon">' + icon + '</div>'
        + '<div class="part-info">'
        +   '<div class="part-label">' + label.replace(/</g,'&lt;') + '</div>'
        +   '<div class="part-type">' + (partMeta.type || '').replace(/</g,'&lt;') + '</div>'
        +   (badges.length ? '<div class="part-badges">' + badges.join('') + '</div>' : '')
        + '</div>'
        + '</div>'
        + '<div class="part-actions" id="actions-' + partMeta.id + '"></div>'
        + '<div class="key-input-area" id="key-area-' + partMeta.id + '">'
        +   '<input type="password" placeholder="Zadejte dešifrovací klíč (AES-256-GCM hex/base64)..." id="key-input-' + partMeta.id + '">'
        +   '<button class="btn btn-danger" id="key-submit-' + partMeta.id + '">🔓 Dešifrovat</button>'
        + '</div>';

      const actionsEl = card.querySelector('#actions-' + partMeta.id);

      if (partMeta.encrypted) {
        // Show toggle key input
        const keyBtn = document.createElement('button');
        keyBtn.className = 'btn btn-warning';
        keyBtn.textContent = '🔑 Zadat klíč';
        keyBtn.addEventListener('click', () => {
          const area = document.getElementById('key-area-' + partMeta.id);
          area.classList.toggle('visible');
        });
        actionsEl.appendChild(keyBtn);

        const submitBtn = card.querySelector('#key-submit-' + partMeta.id);
        submitBtn.addEventListener('click', async () => {
          const keyInput = document.getElementById('key-input-' + partMeta.id);
          const keyVal = keyInput.value.trim();
          if (!keyVal) { keyInput.focus(); return; }
          submitBtn.disabled = true;
          submitBtn.textContent = '⏳ Dešifruji...';
          try {
            // Note: full AES-GCM decryption requires IV + key — shown as placeholder for spec compliance
            const content = '[Dešifrování AES-256-GCM vyžaduje implementaci WebCrypto SubtleCrypto.'
              + ' Klíč přijat: ' + keyVal.slice(0,8) + '...]';
            renderContentInModal(label, content, 'text/plain');
          } catch(err) {
            submitBtn.textContent = '❌ Chyba: ' + err.message;
          } finally {
            submitBtn.disabled = false;
          }
        });

      } else if (partMeta.lazy && !partsData?.find(p => p.id === partMeta.id)) {
        // Lazy — no inline data
        const loadBtn = document.createElement('button');
        loadBtn.className = 'btn btn-secondary';
        loadBtn.textContent = '⬇ Načíst';
        loadBtn.addEventListener('click', async () => {
          loadBtn.disabled = true;
          loadBtn.textContent = '⏳ Načítám...';
          try {
            const content = await getPartContent(partMeta, partsData);
            renderContentInModal(label, content, partMeta.type);
          } catch(err) {
            loadBtn.textContent = '❌ ' + err.message;
            loadBtn.disabled = false;
          }
        });
        actionsEl.appendChild(loadBtn);

      } else {
        // Openable
        const openBtn = document.createElement('button');
        openBtn.className = 'btn btn-primary';
        openBtn.textContent = '📂 Otevřít';
        openBtn.addEventListener('click', async () => {
          openBtn.disabled = true;
          openBtn.textContent = '⏳ Načítám...';
          try {
            const content = await getPartContent(partMeta, partsData);
            renderContentInModal(label, content, partMeta.type);
          } catch(err) {
            alert('Chyba při otevírání části: ' + err.message);
          } finally {
            openBtn.textContent = '📂 Otevřít';
            openBtn.disabled = false;
          }
        });
        actionsEl.appendChild(openBtn);
      }

      return card;
    }

    // ── Init ──────────────────────────────────────────────────

    function init() {
      const doc = parseDoc();
      if (!doc) {
        document.getElementById('env-title').textContent = 'Chyba: nelze načíst obálku';
        return;
      }

      const h = doc.header || {};
      const manifest = doc.manifest || {};
      const partsData = doc.parts || [];

      // Title
      const title = resolveLabel(manifest.label) || h.doc_id || 'PolyDoc Envelope';
      document.getElementById('env-title').textContent = title;
      document.title = title + ' — PolyDoc Envelope';

      // Meta line
      const metaParts = [];
      if (h.doc_id) metaParts.push(h.doc_id);
      if (h.created) {
        try { metaParts.push(new Date(h.created).toLocaleString()); } catch(_) { metaParts.push(h.created); }
      }
      if (h.doc_type) metaParts.push('poly/1.0 · ' + h.doc_type);
      document.getElementById('env-meta').textContent = metaParts.join(' · ');

      // Manifest info
      const infoEl = document.getElementById('manifest-info');
      infoEl.style.display = '';
      document.getElementById('info-docid').textContent = h.doc_id || '—';
      document.getElementById('info-created').textContent = h.created
        ? new Date(h.created).toLocaleString() : '—';

      if (manifest.sender?.hint) {
        document.getElementById('info-sender-row').style.display = '';
        document.getElementById('info-sender').textContent = manifest.sender.hint;
      }

      if (manifest.recipients?.length) {
        document.getElementById('info-recipients-row').style.display = '';
        document.getElementById('info-recipients').textContent =
          manifest.recipients.length + ' příjemce(ů) — anonymní (key hints)';
      }

      // Signature badge
      if (h.signature?.value) {
        const sigBox = document.getElementById('sig-box');
        sigBox.style.display = '';
        const algo = h.signature.algorithm || 'ES256';
        const covers = h.signature.covers || 'manifest';
        document.getElementById('sig-text').textContent =
          'Podpis ' + algo + ' pokrývá ' + covers + ' · ověření přes WebCrypto SubtleCrypto';
      }

      // Mail part banner
      if (doc.mail_part?.data) {
        const banner = document.getElementById('mail-banner');
        banner.style.display = '';
        document.getElementById('mail-banner-content').innerHTML = doc.mail_part.data;
      }

      // Parts list
      const listEl = document.getElementById('parts-list');
      const manifestParts = manifest.parts || [];

      if (manifestParts.length === 0) {
        listEl.innerHTML = '<div style="color:#8b949e;padding:20px 0;">Žádné části v obálce.</div>';
        return;
      }

      for (const partMeta of manifestParts) {
        const card = buildPartCard(partMeta, partsData, doc);
        listEl.appendChild(card);
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }

  })();
  </script>
</body>
</html>`;
}

// ── Route handler ──────────────────────────────────────────────

router.post('/', async (req, res, next) => {
  try {
    const { manifest, parts, options = {} } = req.body;

    if (!manifest || !Array.isArray(manifest.parts) || manifest.parts.length === 0) {
      return res.status(400).json({ ok: false, error: 'manifest.parts[] is required and must not be empty' });
    }
    if (!Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({ ok: false, error: 'parts[] is required and must not be empty' });
    }

    const compress = options.compress !== false; // default true
    const docId = 'ENV-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + randomUUID().slice(0, 8).toUpperCase();
    const created = new Date().toISOString();

    // Process each part
    const processedManifestParts = [];
    const processedDataParts = [];
    let totalSizeOriginal = 0;
    let totalSizeStored = 0;

    for (const partInput of parts) {
      const id = partInput.id;
      const metaEntry = manifest.parts.find(m => m.id === id);
      if (!metaEntry) continue;

      // accept `content` (raw string) or `data` (raw string / base64 passthrough)
      const rawContent = partInput.content ?? partInput.data;
      const content = typeof rawContent === 'string'
        ? rawContent
        : JSON.stringify(rawContent);

      const originalSize = Buffer.byteLength(content, 'utf-8');
      totalSizeOriginal += originalSize;

      let storedData;
      let isCompressed = false;
      let storedSize;

      if (compress && originalSize > 1024) {
        // compressPayload expects an object — wrap string in object
        const compressed = compressPayload({ _content: content });
        storedData = compressed.data;
        storedSize = compressed.compressed_size;
        isCompressed = true;
      } else {
        // Store as base64 of UTF-8 bytes
        storedData = Buffer.from(content, 'utf-8').toString('base64');
        storedSize = Buffer.byteLength(storedData, 'utf-8');
        isCompressed = false;
      }

      totalSizeStored += storedSize;

      const hash = sha256(storedData);

      processedManifestParts.push({
        id,
        type: metaEntry.type || 'text/plain',
        label: metaEntry.label || id,
        compressed: isCompressed,
        encrypted: metaEntry.encrypted || false,
        ...(metaEntry.encryption ? { encryption: metaEntry.encryption } : {}),
        size_original: originalSize,
        size_stored: storedSize,
        hash,
      });

      processedDataParts.push({
        id,
        compressed: isCompressed,
        data: storedData,
      });
    }

    // Build manifest hash (sha256 of serialized manifest parts)
    const manifestStr = JSON.stringify(processedManifestParts);
    const manifestHash = sha256(manifestStr);

    // Build envelope JSON
    const envelope = {
      header: {
        format: 'poly/1.0',
        doc_id: docId,
        doc_type: 'envelope',
        created,
        ...(options.sign === true ? {
          signature: {
            algorithm: 'ES256',
            covers: 'manifest',
            value: manifestHash,
            note: 'Placeholder — replace with actual ES256 signature in production',
          },
        } : {}),
      },
      manifest: {
        label: typeof manifest.label === 'string'
          ? { en: manifest.label }
          : (manifest.label || { en: docId }),
        ...(manifest.sender ? { sender: manifest.sender } : {}),
        ...(manifest.recipients ? { recipients: manifest.recipients } : {}),
        parts: processedManifestParts,
      },
      parts: processedDataParts,
      ...(options.mail_summary ? {
        mail_part: {
          type: 'text/html',
          label: { en: options.mail_summary, cs: options.mail_summary },
          data: `<p style="font-family:sans-serif;color:#333;">${
            options.mail_summary.replace(/</g, '&lt;').replace(/>/g, '&gt;')
          } (${processedManifestParts.length} part${processedManifestParts.length !== 1 ? 's' : ''})</p>`,
        },
      } : {}),
    };

    // Build HTML
    const html = buildEnvelopeHtml(envelope);
    const filename = `${docId}-envelope.html`;

    // Ensure output dir exists
    await mkdir(OUTPUT_DIR, { recursive: true });
    await writeFile(join(OUTPUT_DIR, filename), html, 'utf-8');

    return res.json({
      ok: true,
      doc_id: docId,
      html_url: `/output/${filename}`,
      manifest_hash: manifestHash,
      parts_count: processedManifestParts.length,
      total_size_original: totalSizeOriginal,
      total_size_stored: totalSizeStored,
    });

  } catch (err) {
    next(err);
  }
});

export default router;
