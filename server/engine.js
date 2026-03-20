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
function injectIntoTemplate(templateHtml, jsonData) {
  // Replace the raw-data script block
  const injectedScript = `<script type="application/poly+json" id="raw-data">\n${JSON.stringify(jsonData, null, 2)}\n</script>`;
  let html = templateHtml.replace(RAW_DATA_REGEX, injectedScript);

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
  return injectIntoTemplate(templateHtml, jsonData);
}
