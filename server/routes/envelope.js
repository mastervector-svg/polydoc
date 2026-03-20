import { Router } from 'express';
import { createHash, randomUUID } from 'crypto';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { compressPayload } from '../engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');
const ENVELOPE_TEMPLATE = readFileSync(join(__dirname, '..', '..', 'templates', 'polydoc-envelope.html'), 'utf-8');

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
  const jsonStr = JSON.stringify(envelopeJson, null, 2)
    .replace(/</g, '\u003c')
    .replace(/>/g, '\u003e');
  return ENVELOPE_TEMPLATE
    .replace('{{TITLE}}', title.replace(/</g, '&lt;').replace(/>/g, '&gt;'))
    .replace('{{ENVELOPE_JSON}}', jsonStr);
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

    // Process each part — iterate manifest.parts to preserve slots
    const processedManifestParts = [];
    const processedDataParts = [];
    let totalSizeOriginal = 0;
    let totalSizeStored = 0;

    for (const metaEntry of manifest.parts) {
      const id = metaEntry.id;

      // Slot with no supplied data → preserve as empty slot in manifest
      if (metaEntry.slot) {
        processedManifestParts.push({
          id,
          type: metaEntry.type || 'text/plain',
          label: metaEntry.label || id,
          slot: true,
          slot_state: 'empty',
          ...(metaEntry.assigned_to   ? { assigned_to: metaEntry.assigned_to }     : {}),
          ...(metaEntry.workspace_hint ? { workspace_hint: metaEntry.workspace_hint } : {}),
          ...(metaEntry.fill          ? { fill: metaEntry.fill }                    : {}),
        });
        continue; // no data entry for slots
      }

      // Embedded part — find data in parts[]
      const partInput = parts.find(p => p.id === id);
      if (!partInput) continue; // no data provided, skip silently

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
        const compressed = compressPayload({ _content: content });
        storedData = compressed.data;
        storedSize = compressed.compressed_size;
        isCompressed = true;
      } else {
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
      envelope_json: envelope,
    });

  } catch (err) {
    next(err);
  }
});

// ── POST /:doc_id/fill — fill a slot in an existing envelope ─────────────────

router.post('/:doc_id/fill', async (req, res, next) => {
  try {
    const { doc_id } = req.params;
    const { slot_id, data, compressed: inputCompressed = false, signed_by, filename } = req.body;

    if (!slot_id) return res.status(400).json({ ok: false, error: 'slot_id is required' });
    if (!data)    return res.status(400).json({ ok: false, error: 'data is required (base64 or plain string)' });

    // Load existing envelope HTML
    const htmlPath = join(OUTPUT_DIR, `${doc_id}-envelope.html`);
    let html;
    try {
      html = await readFile(htmlPath, 'utf-8');
    } catch {
      return res.status(404).json({ ok: false, error: `Envelope "${doc_id}" not found. Has it been created with POST /envelope?` });
    }

    // Extract embedded JSON
    const scriptMatch = html.match(/<script[^>]+type="application\/poly\+json"[^>]*>([\s\S]*?)<\/script>/);
    if (!scriptMatch) {
      return res.status(422).json({ ok: false, error: 'Could not parse poly+json block in envelope HTML' });
    }
    const envelope = JSON.parse(scriptMatch[1]);

    // Find slot in manifest
    const manifestPart = envelope.manifest?.parts?.find(p => p.id === slot_id);
    if (!manifestPart) {
      return res.status(404).json({ ok: false, error: `Slot "${slot_id}" not found in manifest` });
    }
    if (!manifestPart.slot) {
      return res.status(409).json({ ok: false, error: `Part "${slot_id}" is not a slot — it was embedded at pack time` });
    }

    // Process incoming data
    // data may be: raw string, or base64-encoded binary
    const rawContent = data;
    const originalSize = Buffer.byteLength(rawContent, 'utf-8');

    let storedData;
    let isCompressed = false;
    let storedSize;

    const shouldCompress = !inputCompressed && originalSize > 1024;
    if (shouldCompress) {
      const compressed = compressPayload({ _content: rawContent });
      storedData = compressed.data;
      storedSize = compressed.compressed_size;
      isCompressed = true;
    } else {
      storedData = inputCompressed
        ? rawContent  // already base64-encoded by caller
        : Buffer.from(rawContent, 'utf-8').toString('base64');
      storedSize = Buffer.byteLength(storedData, 'utf-8');
    }

    const hash = sha256(storedData);
    const filledAt = new Date().toISOString();

    // Update manifest part
    manifestPart.slot_state = 'filled';
    manifestPart.filled_at = filledAt;
    manifestPart.hash_at_fill = hash;
    manifestPart.size_original = originalSize;
    manifestPart.size_stored = storedSize;
    manifestPart.compressed = isCompressed;
    if (signed_by) manifestPart.filled_by = signed_by;
    if (filename) manifestPart.filename = filename;

    // Add or replace in parts[]
    if (!envelope.parts) envelope.parts = [];
    const existingIdx = envelope.parts.findIndex(p => p.id === slot_id);
    const partEntry = { id: slot_id, compressed: isCompressed, data: storedData };
    if (existingIdx >= 0) {
      envelope.parts[existingIdx] = partEntry;
    } else {
      envelope.parts.push(partEntry);
    }

    // Recompute manifest hash
    const manifestHash = sha256(JSON.stringify(envelope.manifest.parts));

    // Regenerate HTML
    const newHtml = buildEnvelopeHtml(envelope);
    await writeFile(htmlPath, newHtml, 'utf-8');

    // Count remaining empty slots
    const emptySlots = envelope.manifest.parts.filter(
      p => p.slot && (p.slot_state ?? 'empty') !== 'filled'
    ).length;

    return res.json({
      ok: true,
      doc_id,
      slot_id,
      slot_state: 'filled',
      filled_at: filledAt,
      hash: hash,
      html_url: `/output/${doc_id}-envelope.html`,
      manifest_hash: manifestHash,
      empty_slots_remaining: emptySlots,
      envelope_complete: emptySlots === 0,
    });

  } catch (err) {
    next(err);
  }
});

// ── GET /:doc_id — return envelope JSON ──────────────────────────────────────

router.get('/:doc_id', async (req, res, next) => {
  try {
    const { doc_id } = req.params;
    const htmlPath = join(OUTPUT_DIR, `${doc_id}-envelope.html`);

    let html;
    try {
      html = await readFile(htmlPath, 'utf-8');
    } catch {
      return res.status(404).json({ ok: false, error: `Envelope "${doc_id}" not found` });
    }

    const scriptMatch = html.match(/<script[^>]+type="application\/poly\+json"[^>]*>([\s\S]*?)<\/script>/);
    if (!scriptMatch) {
      return res.status(422).json({ ok: false, error: 'Could not parse poly+json block' });
    }

    const envelope = JSON.parse(scriptMatch[1]);

    // Return manifest-only view (no part data) by default for security
    const { parts: _parts, ...envelopeWithoutParts } = envelope;
    const slots = envelope.manifest?.parts?.filter(p => p.slot) ?? [];
    const emptySlots = slots.filter(p => (p.slot_state ?? 'empty') !== 'filled').length;

    return res.json({
      ok: true,
      doc_id,
      html_url: `/output/${doc_id}-envelope.html`,
      manifest: envelopeWithoutParts.manifest,
      header: envelopeWithoutParts.header,
      slots_total: slots.length,
      slots_empty: emptySlots,
      envelope_complete: emptySlots === 0,
    });

  } catch (err) {
    next(err);
  }
});

// ── helpers shared by fill routes ────────────────────────────────────────────

async function loadEnvelope(doc_id) {
  const htmlPath = join(OUTPUT_DIR, `${doc_id}-envelope.html`);
  let html;
  try {
    html = await readFile(htmlPath, 'utf-8');
  } catch {
    return null;
  }
  const m = html.match(/<script[^>]+type="application\/poly\+json"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  return { html, envelope: JSON.parse(m[1]), htmlPath };
}

function decodePartData(part) {
  if (!part?.data) return null;
  try {
    return Buffer.from(part.data, 'base64').toString('utf-8');
  } catch {
    return part.data;
  }
}

// ── POST /:doc_id/fill-ai — LLM agent fills a slot ───────────────────────────

router.post('/:doc_id/fill-ai', async (req, res, next) => {
  try {
    const { doc_id } = req.params;
    const {
      slot_id,
      model,          // override model, default from env
      auto_fill = false,  // if true, skip review and fill immediately
      extra_context,  // optional extra instructions from caller
    } = req.body;

    if (!slot_id) return res.status(400).json({ ok: false, error: 'slot_id is required' });

    // LLM config from env (OpenAI-compatible)
    const llmBase      = process.env.LLM_BASE_URL    || 'http://localhost:11434/v1';
    const llmKey       = process.env.LLM_API_KEY     || 'local';
    const llmKeyHeader = process.env.LLM_KEY_HEADER  || 'Authorization'; // 'X-API-Key' for some proxies
    const llmModel     = model || process.env.LLM_MODEL || 'qwen2.5-coder:14b';

    // Load envelope
    const loaded = await loadEnvelope(doc_id);
    if (!loaded) {
      return res.status(404).json({ ok: false, error: `Envelope "${doc_id}" not found` });
    }
    const { envelope, htmlPath, html } = loaded;

    // Find slot
    const manifestPart = envelope.manifest?.parts?.find(p => p.id === slot_id);
    if (!manifestPart) {
      return res.status(404).json({ ok: false, error: `Slot "${slot_id}" not found` });
    }
    if (!manifestPart.slot) {
      return res.status(409).json({ ok: false, error: `Part "${slot_id}" is not a slot` });
    }

    // Build context from already-filled parts
    const filledContext = (envelope.parts ?? [])
      .map(p => {
        const meta = envelope.manifest?.parts?.find(m => m.id === p.id);
        const content = decodePartData(p);
        if (!content) return null;
        const label = typeof meta?.label === 'object' ? (meta.label.en ?? meta.label.cs) : meta?.label ?? p.id;
        return `### ${label} (${meta?.type ?? 'unknown'})\n\`\`\`\n${content.slice(0, 2000)}${content.length > 2000 ? '\n... [truncated]' : ''}\n\`\`\``;
      })
      .filter(Boolean)
      .join('\n\n');

    const envelopeLabel = typeof envelope.manifest?.label === 'object'
      ? (envelope.manifest.label.en ?? envelope.manifest.label.cs)
      : envelope.manifest?.label ?? doc_id;

    const fillPrompt = manifestPart.fill_prompt || manifestPart.fill?.prompt || '';
    const slotLabel  = typeof manifestPart.label === 'object'
      ? (manifestPart.label.en ?? manifestPart.label.cs)
      : manifestPart.label ?? slot_id;

    // Build LLM prompt
    const systemPrompt = `You are an expert assistant helping fill parts of a PolyDoc envelope.
A PolyDoc envelope is a cryptographic container for project files.
You must generate ONLY the raw file content — no explanation, no markdown wrapper, no code fences.
Output exactly the content of the file, ready to use.`;

    const userPrompt = [
      `Envelope: "${envelopeLabel}"`,
      filledContext ? `\n## Already filled parts (for context):\n${filledContext}` : '',
      `\n## Your task`,
      `Generate the content of: **${slotLabel}** (MIME type: \`${manifestPart.type}\`)`,
      fillPrompt ? `\nInstructions: ${fillPrompt}` : '',
      extra_context ? `\nAdditional context: ${extra_context}` : '',
      `\nOutput ONLY the raw file content. No explanations.`,
    ].filter(Boolean).join('\n');

    // Call LLM (OpenAI-compatible)
    let generated;
    try {
      const llmRes = await fetch(`${llmBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [llmKeyHeader]: llmKeyHeader === 'Authorization' ? `Bearer ${llmKey}` : llmKey,
        },
        body: JSON.stringify({
          model: llmModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: 4096,
        }),
      });
      if (!llmRes.ok) {
        const errBody = await llmRes.text();
        throw new Error(`LLM API ${llmRes.status}: ${errBody.slice(0, 200)}`);
      }
      const llmJson = await llmRes.json();
      generated = llmJson.choices?.[0]?.message?.content?.trim();
      if (!generated) throw new Error('LLM returned empty response');
    } catch (err) {
      return res.status(502).json({
        ok: false,
        error: `LLM call failed: ${err.message}`,
        llm_base: llmBase,
        llm_model: llmModel,
      });
    }

    // auto_fill=false → return draft for human review, don't fill yet
    if (!auto_fill) {
      return res.json({
        ok: true,
        doc_id,
        slot_id,
        status: 'draft',
        model: llmModel,
        draft: generated,
        review_required: manifestPart.fill?.review_required !== false,
        hint: `Review the draft, then call POST /envelope/${doc_id}/fill with { slot_id, data: <content> } to apply.`,
      });
    }

    // auto_fill=true → apply immediately (same logic as POST /:doc_id/fill)
    const originalSize = Buffer.byteLength(generated, 'utf-8');
    let storedData, isCompressed, storedSize;

    if (originalSize > 1024) {
      const compressed = compressPayload({ _content: generated });
      storedData = compressed.data;
      storedSize = compressed.compressed_size;
      isCompressed = true;
    } else {
      storedData = Buffer.from(generated, 'utf-8').toString('base64');
      storedSize = Buffer.byteLength(storedData, 'utf-8');
      isCompressed = false;
    }

    const hash = sha256(storedData);
    const filledAt = new Date().toISOString();

    manifestPart.slot_state   = 'filled';
    manifestPart.filled_at    = filledAt;
    manifestPart.hash_at_fill = hash;
    manifestPart.size_original = originalSize;
    manifestPart.size_stored  = storedSize;
    manifestPart.compressed   = isCompressed;
    manifestPart.filled_by    = { agent: llmModel };

    if (!envelope.parts) envelope.parts = [];
    const idx = envelope.parts.findIndex(p => p.id === slot_id);
    const entry = { id: slot_id, compressed: isCompressed, data: storedData };
    if (idx >= 0) envelope.parts[idx] = entry; else envelope.parts.push(entry);

    const manifestHash = sha256(JSON.stringify(envelope.manifest.parts));
    const newHtml = buildEnvelopeHtml(envelope);
    await writeFile(htmlPath, newHtml, 'utf-8');

    const emptySlots = envelope.manifest.parts.filter(
      p => p.slot && (p.slot_state ?? 'empty') !== 'filled'
    ).length;

    return res.json({
      ok: true,
      doc_id,
      slot_id,
      status: 'filled',
      model: llmModel,
      filled_at: filledAt,
      hash,
      manifest_hash: manifestHash,
      html_url: `/output/${doc_id}-envelope.html`,
      empty_slots_remaining: emptySlots,
      envelope_complete: emptySlots === 0,
      draft: generated,  // always return what was generated
    });

  } catch (err) {
    next(err);
  }
});

export default router;
