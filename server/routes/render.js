import { Router } from 'express';
import { writeFile, mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { validatePolyDoc, renderFull, renderMail } from '../engine.js';

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');

/**
 * POST /render
 *
 * PRIMARY ROLE: direct-to-user display channel.
 *
 * When a browser POSTs a PolyDoc (or a proxy forwards one), /render responds
 * with rendered HTML directly — the user sees the document immediately, no
 * intermediate step, no redirect, no second request.
 *
 * Modes (via ?mode= or Accept header sniffing):
 *
 *   display  → text/html — full interactive render, sent directly to browser  ← DEFAULT for browsers
 *   mail     → text/html — static mail-safe render (no JS), sent directly
 *   api      → application/json — { html_url, mail_html }, saves full render to disk  ← DEFAULT for API clients
 *
 * The display mode is the point: /render is NOT a "generate-and-redirect" pipeline step.
 * It IS the channel through which a human sees the document.
 * Pipelines needing stored output should use ?mode=api or write to /output directly.
 */
router.post('/', async (req, res, next) => {
  try {
    const body = req.body;

    // Mode detection: explicit ?mode param wins; otherwise sniff Accept header
    // Browsers send Accept: text/html — treat as display mode automatically
    const accept = req.headers['accept'] || '';
    const mode = req.query.mode || (accept.includes('text/html') ? 'display' : 'api');

    // Validate
    const { valid, errors } = validatePolyDoc(body);
    if (!valid) {
      if (mode === 'display' || mode === 'mail') {
        // Return human-readable error page — user is in a browser
        return res.status(400).set('Content-Type', 'text/html; charset=utf-8').send(
          `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>PolyDoc — validation error</title>` +
          `<style>body{font:14px/1.6 monospace;padding:40px;background:#0d1117;color:#e6edf3}` +
          `h2{color:#f85149;margin-bottom:16px}ul{color:#8b949e;margin-left:20px}li{margin:4px 0}</style></head>` +
          `<body><h2>⚠ PolyDoc validation failed</h2>` +
          `<ul>${errors.map(e => `<li>${e}</li>`).join('')}</ul></body></html>`
        );
      }
      return res.status(400).json({ ok: false, errors });
    }

    const { doc_id, doc_type } = body.header;
    const lang = body.options?.lang || body.metadata?.language || 'en';

    // ── display mode: direct-to-user, no disk write ──────────────────────
    if (mode === 'display') {
      const html = await renderFull(body);
      return res.set('Content-Type', 'text/html; charset=utf-8').send(html);
    }

    // ── mail mode: static render, direct-to-user, no disk write ──────────
    if (mode === 'mail') {
      const html = await renderMail(body, lang);
      return res.set('Content-Type', 'text/html; charset=utf-8').send(html);
    }

    // ── api mode: render both, save full render to disk, return JSON ──────
    const [fullHtml, mailHtml] = await Promise.all([
      renderFull(body),
      renderMail(body, lang),
    ]);
    await mkdir(OUTPUT_DIR, { recursive: true });
    const filename = `${doc_id}-full.html`;
    await writeFile(join(OUTPUT_DIR, filename), fullHtml, 'utf-8');

    return res.json({
      ok: true,
      doc_id,
      doc_type,
      html_url: `/output/${filename}`,
      mail_html: mailHtml,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
