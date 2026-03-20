# PolyDoc Architecture

*Design decisions, tradeoffs, and the reasoning behind them.*

---

## Core Principle: One File, Multiple Identities

A PolyDoc file has multiple valid interpretations depending on who opens it:

| Who opens it | What they see |
|-------------|---------------|
| Browser | Rendered document with toolbar |
| Email client | Static HTML (JS stripped/ignored) |
| LLM / AI agent | JSON data in `<script type="application/poly+json">` |
| Text editor | Raw HTML + readable JSON |
| Server-side parser | Regex to extract JSON block |
| Archive system | Self-describing document with metadata |

This is the polyglot property. The file doesn't change — the reader's capability changes what they get.

---

## The JSON Embedding Strategy

```html
<script type="application/poly+json" id="raw-data">
{ ... }
</script>
```

This specific pattern was chosen for three reasons:

**1. Browsers ignore it**  
`type="application/poly+json"` is not a recognized MIME type.
The browser will not execute it. It will not even try.

**2. JavaScript can read it**  
```javascript
const raw = document.getElementById('raw-data').textContent;
const doc = JSON.parse(raw);
```
One line to access all the data.

**3. LLMs see it in source**  
When you paste an HTML file into an LLM context window,
the model reads the full source including the JSON block.
No special parsing needed.

---

## Dual-Mode Generation

The same JSON data produces two outputs:

### Mail Version
Generated server-side (or build-time). Pure HTML, no JavaScript.
All content is statically rendered into HTML tables (Outlook-compatible).
All CSS is inline (Gmail strips `<style>` tags).
The JSON block is still present — for AI parsers that read email source.

### Full Version
Contains the same JSON block plus the Poly Interpreter.
The interpreter runs client-side, reads the JSON, renders the document.
Can fetch live status from API endpoints.
Can execute actions (confirm, download, cancel).

### Why two separate files instead of one adaptive file?

Option considered: one file that detects if JS is available and adapts.

Rejected because:
- Email clients actively strip JS before the file is even opened
- Progressive enhancement doesn't work when the transport medium modifies the file
- Explicit separation is clearer for IS generators and debuggers
- Mail version has different optimization goals (size, table layout, inline CSS)

---

## The Interpreter Architecture

The Poly Interpreter is intentionally simple:

```
Parse JSON → Apply visuals (CSS vars) → Render sections → Evaluate logic → Bind actions
```

**No virtual DOM. No framework. No build step.**

Each section type has a pure function: `renderSection(s) → HTML string`.
The interpreter concatenates these strings and sets `innerHTML`.

This is a deliberate choice. The interpreter should be:
- Readable by any developer in 10 minutes
- Copyable into any project without dependencies
- Replaceable — you can write your own interpreter

The spec defines the data format. The interpreter is a reference implementation.

---

## Section Type System

Sections are typed objects in `content.sections[]`.
The `type` field is the discriminator.

```json
{ "type": "table", "columns": [...], "rows": [...] }
{ "type": "party", "role": "supplier", "data": {...} }
```

**Why not a generic `elements[]` tree?**

Considered: recursive element tree (like Notion's block format).

Chosen: flat typed sections because:
- Simpler for AI to generate correctly
- Simpler validation
- Each type has clear, bounded semantics
- Reduces the surface area for malformed documents

Trade-off: less flexible for complex nested layouts.
For complex layouts, use `rich_text` with sanitized HTML.

---

## Transfer Format Design

The Transfer format reuses the PolyDoc container for a different purpose:
structured project data instead of human-readable documents.

Key decisions:

**Compression threshold: 10 KB**  
Items under 10 KB stay as readable JSON.
Items over 10 KB use DEFLATE + base64.
This means small configs (env_schema, connector_config) are always human-inspectable.
Large blobs (frontend bundles, knowledge bases) are compressed.

**`env_schema` never contains values**  
This is a hard rule. The env schema describes the shape of your environment,
not the secrets. This allows transfer files to be stored, versioned, and shared
without leaking credentials.

**Payload hash in signature**  
The ES256 signature covers `header.transfer + header.version + sha256(payload)`.
This means you can verify the payload was not modified after export
without trusting the file name, storage location, or any external system.

---

## Channel API Design

The Channel API is designed to be discovered and used by AI agents without any human explanation.

Three mechanisms enable this:

**1. `/.well-known/polydoc-channel`**  
Standard discovery endpoint (analogous to `/.well-known/openid-configuration`).
Returns `ai_instructions` — a plain text field that tells the LLM exactly what to do.
No authentication required. This is the entry point.

**2. `x-ai-instructions` in OpenAPI**  
A top-level extension field that modern LLMs read when ingesting an OpenAPI spec.
Contains the complete workflow in plain language.

**3. `operationId` naming**  
Every endpoint has a clear, action-oriented `operationId`:
`renderDocument`, `createTransfer`, `validateDocument`.
These become the function names when LLMs auto-generate tool calls from the spec.

**Why OpenAPI 3.1 specifically?**  
3.1 aligns with JSON Schema draft 2020-12.
This means the schema definitions can be used directly as validation schemas,
imported by JSON Schema validators, and understood by code generators.

---

## Security Model

### XSS
`rich_text` sections accept raw HTML. This is a deliberate design choice —
sometimes you need formatted text that doesn't fit into typed sections.
The risk is XSS.

Mitigation: the interpreter must sanitize `rich_text.html` before inserting.
The reference interpreter does not include DOMPurify (no external dependencies).
Production implementations must add sanitization.

### Token-based access
Signed tokens use `bin2hex(random_bytes(32))` — 64 hex characters, 256 bits of entropy.
Tokens are stored as `sha256(token)` — the plaintext is never stored.
A leaked database does not expose valid tokens.

### Fragment-key encryption
For sensitive documents, the AES-GCM key lives in the URL fragment (`#key=...`).
HTTP specification: fragments are never sent to the server.
The server stores encrypted ciphertext. Only the client with the URL can decrypt.
This provides end-to-end encryption without a key management system.

### Signatures
ES256 (ECDSA with P-256 curve) was chosen over RSA because:
- Shorter signatures (64 bytes vs 256+ bytes)
- Faster verification (important for client-side SubtleCrypto)
- Better security properties at equivalent key sizes
- Natively supported by Web Crypto API

---

## What PolyDoc Is Not

**Not a replacement for all email**  
Transactional and official communications only.
Casual conversation, quick replies, threaded discussions — use normal email or chat.

**Not a PDF replacement in regulated contexts**  
Some industries require PDF/A for archival. PolyDoc does not (yet) target this.

**Not a database**  
The JSON inside is a snapshot. It's not queryable without extracting it first.

**Not a web app framework**  
The interpreter renders documents, not applications.
For complex interactive applications, use a proper framework.

---

## Relationship to Existing Standards

| Standard | Relationship |
|----------|-------------|
| HTML5 | PolyDoc files are valid HTML5 |
| JSON | The data layer is plain JSON |
| OpenAPI 3.1 | Channel API is standard OpenAPI |
| JSON Schema | Section schemas are JSON Schema compatible |
| DKIM/SPF/DMARC | Mail version works with standard email auth |
| Web Crypto API | Signature verification uses standard browser API |
| DEFLATE | Standard compression, available in every environment |

PolyDoc introduces one new convention: `<script type="application/poly+json">`.
Everything else is existing standards composed together.

---

*[Back to README](../README.md) · [Spec](../spec/POLYDOC_SPEC.md) · [Channel API](../spec/openapi.yaml)*
