# PolyDoc — Format Specification v1.0

> **Motto:** One file. Machine-readable data. Human-readable document. Works in the browser and in email.

---

## 1. What is PolyDoc?

PolyDoc is an open document format built on a standard HTML file.
It carries structured JSON data (content, metadata, logic) and a JavaScript interpreter
that renders the document from this data in the browser.

**The file has a single extension: `.html`**
The format brand is **Poly** (`format: "poly/1.0"` in the JSON header).

### Why not PDF, DOCX, or plain JSON?

| Format | Problem |
|--------|---------|
| PDF | Static, machine-unreadable, expensive to generate |
| DOCX | Binary XML bloat, proprietary dependencies |
| Plain JSON | Cannot be opened directly, requires a viewer |
| **PolyDoc** | ✅ One HTML file, works everywhere, data inside, AI-readable |

### AI-friendly advantage

An LLM or RPA bot can read the JSON directly from the document source — no PDF parsing,
no OCR. A customer's accounting system can download the invoice automatically.

---

## 2. Two document modes

```
[IS / backend]
      ↓ generates from the same JSON data
      ├── polydoc-mail.html    Static HTML, zero JS, into the email body
      │                        < 50 KB, passes through any wall
      │                        CTA button → link to full version
      │
      └── polydoc-full.html    Full interpreter, live status from API
                               Interactive buttons, signature, print
                               Hosted on server or available for download
```

---

## 3. File architecture

```
document.html
│
├── <script type="application/poly+json" id="raw-data">
│     └── JSON document (data, metadata, logic, visuals)
│
├── <script>  ← Poly Interpreter (inline or from CDN in the future)
│     └── Loads JSON → validates → renders → runs logic
│
└── <style>
      └── CSS (print, responsiveness, themes)
```

### Structure rules

1. JSON **must** be in the tag `<script type="application/poly+json" id="raw-data">`
2. The browser ignores the tag (does not execute it), JS reads it as text
3. Full version: interpreter inline in the file
4. Mail version: no JS, statically rendered content
5. The file must be valid HTML5

---

## 4. JSON schema (Poly v1.0)

```json
{
  "header": {
    "format": "poly/1.0",
    "spec": "https://github.com/polydoc/spec/blob/main/v1.0.md",
    "doc_id": "INV-2026-001",
    "doc_type": "invoice",
    "created": "2026-03-12T08:00:00Z",
    "generator": "MyEngine v1.0",
    "signature": {
      "algorithm": "ES256",
      "value": "MEUCIQD...",
      "public_key": "-----BEGIN PUBLIC KEY-----..."
    }
  },

  "metadata": {
    "title": "Invoice for consulting services",
    "language": "cs",
    "author": "Jan Novák",
    "tags": ["invoice", "2026"],
    "custom_fields": {
      "vs": "123456",
      "ks": "0308",
      "due_date": "2026-04-10"
    }
  },

  "content": {
    "type": "document",
    "sections": []
  },

  "visuals": {
    "theme": "modern-clean",
    "page_size": "A4",
    "font": "Inter",
    "colors": {
      "primary": "#0d6efd",
      "accent": "#ffc107"
    }
  },

  "logic": {
    "dynamic": [
      {
        "trigger": "onLoad",
        "action": "fetchStatus",
        "api_url": "https://api.example.cz/doc/INV-2026-001/status",
        "target_field": "is_paid"
      }
    ],
    "conditions": [
      {
        "field": "is_paid",
        "value": true,
        "banner": { "text": "✅ PAID", "style": "success" }
      },
      {
        "field": "is_paid",
        "value": false,
        "banner": { "text": "⏳ Awaiting payment", "style": "warning" }
      }
    ],
    "actions": [
      {
        "label": "✅ Confirm order",
        "api_url": "https://api.example.cz/doc/INV-2026-001/confirm",
        "method": "POST",
        "success_message": "Thank you for confirming!"
      }
    ]
  }
}
```

---

## 5. Section types (`content.sections[].type`)

| Type | Description | Required fields |
|------|-------------|-----------------|
| `header` | Document header | `elements[]` |
| `party` | Document participant | `role`, `data` |
| `table` | Table with optional footer | `columns[]`, `rows[]` |
| `image` | Image | `src`, `alt` |
| `rich_text` | HTML block (must be sanitized!) | `html` |
| `checklist` | List with checkboxes | `items[]` |
| `paragraph` | Text paragraph | `text` |
| `divider` | Horizontal separator | — |
| `signature_block` | Signature field | `label` |
| `custom` | Arbitrary block | `data` |

### Section: `header`
```json
{
  "type": "header",
  "elements": [
    { "type": "heading", "level": 1, "text": "Invoice" },
    { "type": "paragraph", "text": "Issued: 12 March 2026" }
  ]
}
```

### Section: `party`
```json
{
  "type": "party",
  "role": "supplier",
  "data": {
    "name": "Jan Novák s.r.o.",
    "id": "CZ87654321",
    "address": "Příkop 4, 602 00 Brno",
    "bank": "CZ6508000000192000145399",
    "email": "info@example.cz"
  }
}
```
Role: `supplier` | `client` | `guarantor` | `agent`

### Section: `table`
```json
{
  "type": "table",
  "id": "items",
  "columns": ["Description", "Quantity", "Unit price", "Total"],
  "rows": [
    ["Consulting", 5, 2000, 10000]
  ],
  "footer": {
    "total": 10000,
    "currency": "CZK",
    "vat_rate": 21
  }
}
```

### Section: `image`
```json
{
  "type": "image",
  "src": "data:image/png;base64,...",
  "alt": "Company logo",
  "width": "200px",
  "caption": "Caption"
}
```
`src` can be base64 (< 50 KB recommended) or an HTTPS URL.

### Section: `checklist`
```json
{
  "type": "checklist",
  "items": [
    { "text": "Signed", "checked": true },
    { "text": "Paid", "checked": false }
  ]
}
```

---

## 6. Security

### XSS prevention
- `rich_text.html` **must** be sanitized (DOMPurify client-side or server-side)
- Never inject raw HTML from unvalidated input
- `image.src` — never allow `javascript:` or `data:text/html` schemes

### Document integrity
- `header.signature` contains an ES256 signature of the entire JSON object (excluding the `signature` field)
- Verification via WebCrypto API (SubtleCrypto) in the browser
- Recommended for: invoices, contracts, official documents

### Images
- Base64 inline — suitable for logos < 50 KB
- URL references — for larger images, must be HTTPS

---

## 7. Visual themes (`visuals.theme`)

| Value | Description |
|-------|-------------|
| `modern-clean` | White background, blue accent, clean typography |
| `modern-dark` | Dark background, neon accents |
| `classic` | Serif fonts, conservative layout |
| `minimal` | Maximum white space, minimal colours |

Colours can be overridden via `visuals.colors.primary` and `visuals.colors.accent`.

---

## 8. Logic section

### `logic.dynamic` — live fetch
```json
{
  "trigger": "onLoad",
  "action": "fetchStatus",
  "api_url": "https://api.example.cz/doc/{doc_id}/status",
  "target_field": "is_paid"
}
```
The interpreter replaces `{doc_id}` with the value from `header.doc_id`.

### `logic.conditions` — conditional banners
```json
{
  "field": "is_paid",
  "value": true,
  "banner": { "text": "✅ PAID", "style": "success" }
}
```
Banner styles: `success` | `warning` | `danger` | `info`

### `logic.actions` — action buttons
```json
{
  "label": "✅ Confirm order",
  "api_url": "https://api.example.cz/doc/{doc_id}/confirm",
  "method": "POST",
  "success_message": "Thank you!"
}
```

---

## 9. Interpreter — public API

```javascript
PolyDoc.init()            // initialise (automatically on DOMContentLoaded)
PolyDoc.render()          // re-render the document
PolyDoc.verify()          // verify digital signature
PolyDoc.exportJSON()      // download clean JSON
PolyDoc.getDoc()          // return parsed JSON object (for integration)
```

---

## 10. Mail version — rules

The mail version is a statically rendered copy without JS.

**Must:**
- Be a valid HTML email (table layout for Outlook compatibility)
- Include a CTA button with a link to the full version
- Have inline CSS (no `<style>` blocks — Gmail strips them)
- Display key information without JS (number, amount, due date, parties)
- Include `<script type="application/poly+json">` with data (for AI parsers)

**Must not:**
- Contain any `<script>` with code
- Use external CSS files
- Rely on web fonts (fall back to system fonts)

---

## 11. Compression — selective DEFLATE at section level

Compression in PolyDoc is a **per-section property**, not a global document mode.
The header, metadata, summaries, and small blocks remain readable as JSON.
Large blocks (base64 images, knowledge bases, attachments, large tables) are compressed inline.

The magic is that the document remains inspectable at a glance — you can see the header,
parties, and amounts — while large data is stored compactly alongside them in the same file.

### Global setting in the header (hint for generators)

```json
{
  "header": {
    "format": "poly/1.0",
    "doc_id": "INV-2026-001",
    "compression": {
      "algorithm": "deflate",
      "threshold": 10240
    }
  }
}
```

`threshold` tells the generator: *"fields whose serialised size exceeds this number of bytes should be compressed automatically"*. The default value is **10 240 B (10 KB)**. The header and small sections are never compressed.

### What a compressed section looks like

Any section in `content.sections` or an item in a transfer payload can carry compressed data:

```json
{
  "type": "image",
  "alt": "Property photograph",
  "compressed": true,
  "data": "eJyNkstqwzAQRff...",
  "original_size": 52480,
  "compressed_size": 9120
}
```

```json
{
  "type": "knowledge_base",
  "id": "kb-main",
  "title": "Project knowledge base",
  "compressed": true,
  "data": "eJyVkMtqwzAQRff...",
  "original_size": 145000,
  "compressed_size": 28300
}
```

An uncompressed section looks normal — the `compressed` field is absent or `false`:

```json
{
  "type": "party",
  "role": "supplier",
  "data": { "name": "Jan Novák s.r.o.", "address": "Brno" }
}
```

### Rules

| Rule | Value |
|------|-------|
| Algorithm | DEFLATE (RFC 1951) |
| Encoding | Base64 |
| Default threshold | 10 240 B |
| Flag | `"compressed": true` on the section/item |
| Content | `"data": base64(deflate(JSON.stringify(original_data)))` |
| Metadata | `"original_size"`, `"compressed_size"` (optional, for debugging) |
| Never compressed | `header`, `metadata`, summaries, table `footer` |

Decompress (Node.js): `JSON.parse(inflateSync(Buffer.from(data, 'base64')).toString('utf-8'))`
Decompress (browser): `DecompressionStream('deflate')` + `TextDecoder`

---

## 12. Encryption (`header.encryption`)

PolyDoc supports fragment-key encryption for sensitive documents. The key is part of the URL fragment (`#`) — it is never sent to the server.

### Header format

```json
{
  "header": {
    "format": "poly/1.0",
    "doc_id": "CONTRACT-2026-001",
    "doc_type": "contract",
    "encryption": {
      "algorithm": "AES-256-GCM",
      "key_location": "url_fragment",
      "iv": "base64-encoded-iv"
    }
  }
}
```

### How it works

```
Server generates an AES-256-GCM key
  ↓
Encrypts document content (content, logic, metadata)
  ↓
Stores the encrypted document on the server
  ↓
Returns URL: https://example.cz/doc/CONTRACT-001.html#key=<base64-key>
  ↓
Browser reads the key from the fragment (the fragment is NEVER sent to the server)
  ↓
WebCrypto API (SubtleCrypto) decrypts the content directly in the browser
```

### Access modes

| Mode | Description |
|------|-------------|
| `public` | No restrictions — default |
| `token` | Requires a Bearer token to load the full version |
| `encrypted` | AES-256-GCM, key in URL fragment |

```json
{
  "header": {
    "access": {
      "mode": "encrypted",
      "hint": "You will receive the link with the key by email"
    }
  }
}
```

---

## 13. Lazy load — selective section loading

Lazy load is, like compression, a **per-section property**, independent of the output format.
Sections with `"lazy": true` are not rendered on the first pass — a placeholder is shown instead.
Content is loaded on demand (scroll into view or click).

### Two lazy load modes

#### `"lazy_mode": "on-demand"` (default)
Data is **always fetched from `src`** on every request. It is never embedded in the document.
Suitable for: live status, terms and conditions (always the latest version), external datasets.

```json
{
  "type": "rich_text",
  "lazy": true,
  "lazy_mode": "on-demand",
  "lazy_label": "Show terms and conditions...",
  "src": "https://api.example.cz/terms/v2"
}
```

#### `"lazy_mode": "inline"`
Data is **fetched once** and inserted directly into the DOM (and can be saved back into the document).
Suitable for: large images, knowledge bases, attachments — content that should be available offline.

```json
{
  "type": "image",
  "lazy": true,
  "lazy_mode": "inline",
  "src": "https://cdn.example.cz/foto-hd.jpg",
  "alt": "Property photograph — HD version",
  "width": "100%"
}
```

Switching mode = one parameter. Behaviour changes, `src` stays the same.

### Threshold for automatic lazy load

A threshold can be defined in the header — sections above this size will get `lazy: true` automatically:

```json
{
  "header": {
    "lazy": {
      "threshold": 51200,
      "default_mode": "on-demand"
    }
  }
}
```

Default threshold: **50 KB** (for sections without an explicit `lazy` field).
The generator adds `lazy: true` and `lazy_mode` according to `default_mode` automatically when creating the document.

### Combining with compression

Lazy and compression are independent of each other and can be combined:

```json
{
  "type": "knowledge_base",
  "lazy": true,
  "lazy_mode": "inline",
  "lazy_label": "Load knowledge base...",
  "src": "https://api.example.cz/kb/main",
  "compressed": true,
  "data": "eJyVkMtq...",
  "original_size": 145000,
  "compressed_size": 28300
}
```

The interpreter first decompresses `data`, then displays the content. `src` serves as a fallback if `data` is missing.

### Rules

| Property | Description | Default |
|----------|-------------|---------|
| `lazy` | Activates lazy load for the section | `false` |
| `lazy_mode` | `"on-demand"` or `"inline"` | `"on-demand"` |
| `lazy_label` | Placeholder text | `"Load..."` |
| `src` | Content source URL | — |
| `header.lazy.threshold` | Threshold for auto-lazy (bytes) | `51200` (50 KB) |
| `header.lazy.default_mode` | Default mode for auto-lazy | `"on-demand"` |

### Interpreter behaviour

```
Render section:
  lazy: false  → renders immediately from data in the document
  lazy: true   → renders a placeholder div, attaches IntersectionObserver

Trigger (scroll into view or click):
  lazy_mode: on-demand  → fetch(src) on every display, never stores
  lazy_mode: inline     → fetch(src) once, replaces placeholder, inserts data into DOM
                          optional: updateDoc() saves data back into raw-data JSON
```

**Mail version:** `lazy: true` sections are rendered as static placeholder text (`lazy_label`)
with a link to the full version. JS is not available — the full version handles loading itself.

---

## 14. Roadmap

### v1.0 (current)
- [x] JSON schema (header, metadata, content, visuals, logic)
- [x] Section types: header, party, table, image, rich_text, checklist, paragraph, divider
- [x] Full interpreter (inline, single-file)
- [x] Mail template (static, no JS)
- [x] Conditional banners
- [x] JSON export

### v1.1
- [ ] Shared interpreter on CDN (`poly-interpreter.js`)
- [ ] SubtleCrypto signature verification
- [ ] More visual themes
- [ ] DOMPurify integration for rich_text
- [ ] Envelope format (`doc_type: "envelope"`) — cryptographic wrapper for arbitrary content

### v2.0
- [ ] Spec on GitHub (`github.com/polydoc/spec`)
- [ ] JSON Schema validator
- [ ] WYSIWYG editor in IS
- [ ] Offline-first (Service Worker)

---

## 16. Envelope format (`doc_type: "envelope"`)

The Envelope format is used for transferring multiple files, cryptographic dispatches, and multi-recipient scenarios. An envelope contains no visual sections — instead it carries `parts[]` with arbitrary content. The header and manifest are always readable; content is optionally encrypted, compressed, or lazy-loaded. The signature covers the manifest (a hash of each part), not the content itself — the recipient can confirm receipt of the dispatch without opening a single part.

See [POLYDOC_ENVELOPE.md](POLYDOC_ENVELOPE.md) for the complete specification.

---

## 17. Workflow, Access Control & DRM

For advanced lifecycle features — remote key / DRM, time-locked documents, quorum voting, and Git-backed versioning — see [POLYDOC_WORKFLOW.md](POLYDOC_WORKFLOW.md).

These are additive extensions. Documents without these fields behave exactly as defined in this spec.

---

## 15. GitHub & spec reference

```json
{
  "header": {
    "format": "poly/1.0",
    "spec": "https://github.com/polydoc/spec/blob/main/v1.0.md"
  }
}
```

The spec link is part of every document — a self-documenting format.

---

*PolyDoc v1.0 · MIT licence · 2026-03-12*
