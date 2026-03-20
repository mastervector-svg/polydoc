import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { deflateSync, inflateSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

// Regex to locate the raw-data script block in HTML templates
const RAW_DATA_REGEX = /<script type="application\/poly\+json" id="raw-data">[\s\S]*?<\/script>/;

/**
 * Validate a PolyDoc JSON object.
 * Returns { valid: boolean, errors: string[] }
 */
export function validatePolyDoc(json) {
  const errors = [];

  if (!json || typeof json !== 'object') {
    return { valid: false, errors: ['Root value must be a JSON object'] };
  }

  // header.format
  const format = json?.header?.format;
  if (!format) {
    errors.push('Missing header.format');
  } else if (!/^poly\/\d+\.\d+$/.test(format)) {
    errors.push(`header.format must match poly/\\d+\\.\\d+ (got: "${format}")`);
  }

  // doc_id and doc_type live inside header
  if (!json.header?.doc_id) {
    errors.push('Missing header.doc_id');
  }
  if (!json.header?.doc_type) {
    errors.push('Missing header.doc_type');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Build the CSS variable block from visuals.colors, if present.
 */
function buildCssVars(jsonData) {
  const colors = jsonData?.visuals?.colors;
  if (!colors || typeof colors !== 'object') return null;

  const vars = Object.entries(colors)
    .map(([key, value]) => `  --color-${key}: ${value};`)
    .join('\n');

  return `:root {\n${vars}\n}`;
}

/**
 * Inject JSON data into a template HTML string.
 * Also injects theme CSS vars into an existing :root block if visuals.colors is present.
 */
function buildMailTokens(jsonData) {
  const h = jsonData.header || {};
  const m = jsonData.metadata || {};
  const v = jsonData.visuals || {};
  const colors = v.colors || {};
  const supplier = jsonData.content?.sections?.find(s => s.role === 'supplier')?.data || {};
  const client   = jsonData.content?.sections?.find(s => s.role === 'client')?.data || {};
  const tableSection = jsonData.content?.sections?.find(s => s.type === 'table');
  const footer = tableSection?.footer || {};

  return {
    '{{TITLE}}':          m.title || h.doc_type || 'Dokument',
    '{{DOC_ID}}':         h.doc_id || '',
    '{{DOC_TYPE}}':       h.doc_type || '',
    '{{CREATED}}':        h.created || '',
    '{{PREHEADER_TEXT}}': m.title || '',
    '{{PRIMARY_COLOR}}':  colors.primary || '#0d6efd',
    '{{ACCENT_COLOR}}':   colors.accent  || '#ffc107',
    '{{DOC_HEADING}}':    m.title || h.doc_type || 'Dokument',
    '{{DOC_META_LINE}}':  `Číslo: ${h.doc_id || ''}`,
    '{{SUPPLIER_NAME}}':  supplier.name    || '',
    '{{SUPPLIER_ID}}':    supplier.id      || '',
    '{{SUPPLIER_ADDRESS}}': supplier.address || '',
    '{{SUPPLIER_BANK}}':  supplier.bank    || '',
    '{{CLIENT_NAME}}':    client.name      || '',
    '{{CLIENT_ID}}':      client.id        || '',
    '{{CLIENT_ADDRESS}}': client.address   || '',
    '{{TABLE_ROWS_HTML}}': (tableSection?.rows || []).map((row, i) => {
      const bg = i % 2 === 0 ? '#ffffff' : '#f9fafb';
      const cells = row.map(cell =>
        `<td style="padding:10px 14px;font-size:13px;border-bottom:1px solid #e5e7eb;">${cell}</td>`
      ).join('');
      return `<tr style="background:${bg};">${cells}</tr>`;
    }).join(''),
    '{{TOTAL_BASE}}':     footer.total ? String(footer.total) : '',
    '{{TOTAL_VAT}}':      footer.total && footer.vat_rate
                            ? String(Math.round(footer.total * footer.vat_rate / 100)) : '',
    '{{TOTAL_WITH_VAT}}': footer.total && footer.vat_rate
                            ? String(Math.round(footer.total * (1 + footer.vat_rate / 100))) : '',
    '{{CURRENCY}}':       footer.currency || 'CZK',
    '{{VAT_RATE}}':       footer.vat_rate != null ? String(footer.vat_rate) : '21',
    '{{VS}}':             m.custom_fields?.vs || '',
    '{{KS}}':             m.custom_fields?.ks || '',
    '{{FULL_DOC_URL}}':       `#`,
    '{{AUTHOR}}':             m.author      || '',
    '{{GENERATOR}}':          h.generator   || 'PolyDoc Render Engine',
    '{{CONTENT_JSON}}':       JSON.stringify(jsonData.content || {}),
    '{{CUSTOM_FIELDS_JSON}}': JSON.stringify(m.custom_fields || {}),
    '{{VISUALS_JSON}}':       JSON.stringify(jsonData.visuals || {}),
  };
}

function applyMailTokens(html, tokens) {
  // Replace simple {{TOKEN}} placeholders
  for (const [token, value] of Object.entries(tokens)) {
    html = html.replaceAll(token, value);
  }
  // Handle conditional Mustache-style blocks {{#KEY}}...{{/KEY}}
  html = html.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) => {
    const token = `{{${key}}}`;
    const val = tokens[token];
    return val ? content.replace(token, val) : '';
  });
  return html;
}

function injectIntoTemplate(templateHtml, jsonData, isMail = false) {
  // Replace the raw-data script block
  const injectedScript = `<script type="application/poly+json" id="raw-data">\n${JSON.stringify(jsonData, null, 2)}\n</script>`;
  let html = templateHtml.replace(RAW_DATA_REGEX, injectedScript);

  // For mail version: replace {{PLACEHOLDER}} tokens
  if (isMail) {
    html = applyMailTokens(html, buildMailTokens(jsonData));
  }

  // Inject CSS vars into :root block if theme colors are defined
  const cssVars = buildCssVars(jsonData);
  if (cssVars) {
    // Try to replace an existing :root { ... } block inside a <style> tag
    const rootBlockRegex = /(:root\s*\{[^}]*\})/;
    if (rootBlockRegex.test(html)) {
      html = html.replace(rootBlockRegex, cssVars);
    } else {
      // Prepend a <style> block before </head>
      const styleBlock = `<style>\n${cssVars}\n</style>\n`;
      html = html.replace('</head>', `${styleBlock}</head>`);
    }
  }

  return html;
}

// ── Compression helpers ───────────────────────────────────────

const COMPRESS_THRESHOLD = 10 * 1024; // 10 KB

/**
 * Compress a JSON object using DEFLATE + base64.
 * Used for transfer payload items > 10 KB.
 * Returns { compressed: true, data: base64string, original_size, compressed_size }
 */
export function compressPayload(json) {
  const raw = JSON.stringify(json);
  const original_size = Buffer.byteLength(raw, 'utf-8');
  const buf = deflateSync(Buffer.from(raw, 'utf-8'));
  const data = buf.toString('base64');
  return { compressed: true, data, original_size, compressed_size: buf.length };
}

/**
 * Decompress a base64 DEFLATE string back to a JSON object.
 */
export function decompressPayload(base64str) {
  const buf = inflateSync(Buffer.from(base64str, 'base64'));
  return JSON.parse(buf.toString('utf-8'));
}

/**
 * Auto-compress a payload if it exceeds the threshold.
 * Returns { compressed, data, original_size?, compressed_size? } or the original object.
 */
export function autoCompress(payload) {
  const raw = JSON.stringify(payload);
  if (Buffer.byteLength(raw, 'utf-8') > COMPRESS_THRESHOLD) {
    return compressPayload(payload);
  }
  return { compressed: false, data: payload };
}

/**
 * Render the full HTML view for a PolyDoc.
 */
export async function renderFull(jsonData) {
  const templatePath = join(TEMPLATES_DIR, 'polydoc-full.html');
  const templateHtml = await readFile(templatePath, 'utf-8');
  return injectIntoTemplate(templateHtml, jsonData);
}

/**
 * Render the mail HTML view for a PolyDoc.
 */
export async function renderMail(jsonData) {
  const templatePath = join(TEMPLATES_DIR, 'polydoc-mail.html');
  const templateHtml = await readFile(templatePath, 'utf-8');
  return injectIntoTemplate(templateHtml, jsonData, true);
}
