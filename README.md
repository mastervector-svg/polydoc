# PolyDoc

[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Format](https://img.shields.io/badge/format-poly%2F1.0-blue.svg)](spec/POLYDOC_SPEC.md)
[![No dependencies](https://img.shields.io/badge/dependencies-zero-brightgreen.svg)]()
[![Free forever](https://img.shields.io/badge/price-%240-brightgreen.svg)]()

**One file. Machine-readable data. Human-readable document. Works everywhere.**

```html
<!-- This HTML file IS the document, the data, and the API. -->
<script type="application/poly+json" id="raw-data">
{
  "header": { "format": "poly/1.0", "doc_id": "INV-2026-001", "doc_type": "invoice" },
  "content": { "sections": [ ... ] }
}
</script>
```

Open it in a browser → you see a beautiful document.
Feed it to an LLM → it reads the JSON directly.
Send it as email → static version passes every firewall.
Click the button → full interactive version loads on your server.

**MIT. Free. No SDK. No account. No bullshit.**

---

## Live Demo

[![Invoice demo — click to open interactive document](docs/preview.png)](https://mastervector-svg.github.io/polydoc/examples/invoice-demo.html)

*Click the image → interactive document opens. Toggle 🌐 for language switch. Toggle 🤖 to see what the LLM reads.*

| Document | Link |
|----------|------|
| **Invoice demo (EN/CS, Human/Agent view)** | [invoice-demo.html](https://mastervector-svg.github.io/polydoc/examples/invoice-demo.html) |
| Invoice — full interactive | [faktura-full.html](https://mastervector-svg.github.io/polydoc/examples/faktura-full.html) |
| Invoice — static mail version | [faktura-mail.html](https://mastervector-svg.github.io/polydoc/examples/faktura-mail.html) |
| Real estate portal — transfer package | [realportal-transfer.html](https://mastervector-svg.github.io/polydoc/examples/realportal-transfer.html) |
| **Envelope demo** — invoice package (cover letter + JSON + terms) | [envelope-demo.html](https://mastervector-svg.github.io/polydoc/examples/envelope-demo.html) |

---

## The Problem

You're in 2026. AI runs half your workflow. And you're still emailing PDF attachments.

| Format | Problem | Price |
|--------|---------|-------|
| **PDF** | Static, machine-unreadable, OCR to read it back | Adobe: $20/mo |
| **DOCX** | Binary XML, requires Microsoft ecosystem | M365: $13/user/mo |
| **DocuSign / PandaDoc** | Portal login, vendor lock-in, API costs | $25–$65/mo |
| **Plain JSON** | Can't be opened directly, needs a viewer | — |
| **PolyDoc** | ✅ One HTML file, works everywhere, AI-native | **$0. MIT. Forever.** |

Every tool forces you to choose between **human-readable** and **machine-readable**. PolyDoc refuses that tradeoff.

---

## The Solution

A single `.html` file that is simultaneously:

- ✅ **A document** — open in any browser, print to PDF, looks professional
- ✅ **A database** — structured JSON inside, parseable by any tool or LLM
- ✅ **An API response** — AI agents render and deliver via Channel API
- ✅ **An email** — static mail version passes every spam filter and firewall
- ✅ **A transfer container** — ship entire project configs, agent setups, knowledge bases
- ✅ **A cryptographic envelope** — wrap any files, sign the manifest, encrypt parts independently, send as one HTML file

---

## Four Use Cases

### 1. Transactional Documents
Invoices, confirmations, offers, contracts.

```
IS/Backend → generates PolyDoc → sends as email body (static)
                                → stores on server (interactive)
User clicks → full version loads → confirm, download, verify signature
```

### 2. AI Channel (DisplayPort for AI)
AI agents use the [Channel API](spec/openapi.yaml) to render and deliver documents. One OpenAPI spec — any LLM understands it immediately. No prompt engineering. The spec is the instruction.

```
User: "Send Novák an invoice for consulting"
Claude: reads Channel API → assembles JSON → POST /render → shares html_url
```

### 3. Transfer Format
Move entire projects between tools (Lovable → Cursor → your IS). Agent configs, knowledge bases, frontend structures — all in one signed, versioned, optionally compressed file.

```
Lovable export → polydoc-transfer.html → Cursor import
                                       → open in browser to inspect
                                       → feed to Claude as context
```

### 4. Envelope — Universal Cryptographic Container

This is the one people don't see coming.

A PolyDoc Envelope is a **single `.html` file** that can contain **literally anything**:

```
📄 INSTALL.md              text/markdown        ← human reads this in browser
🤖 agent-config.json       application/json     ← AI agent reads this
🐳 docker-compose.yml      text/plain           ← ops team deploys this
📦 compiler-linux.tar.gz   application/x-tar    ← downloads and installs
📑 license.pdf             application/pdf      ← legal signs this
📎 nested.html             application/polydoc  ← another PolyDoc inside
```

Open it in a browser → you see the manifest: what's inside, how big, who signed it.
Click a part → it opens inline (markdown rendered, JSON highlighted, image shown).
Binary files → download button. The envelope never changes, only what you open.

**The manifest is always readable — without a key, without an account, without anything.**
You can verify the sender's signature and confirm receipt before opening a single file.

```
Sender signs manifest (hash of each part) → sends .html by email
Recipient opens browser                   → sees manifest, verifies signature
Recipient opens only what they need       → encrypted parts need the key
AI agent reads manifest                   → decides what to fetch and process
```

Multi-recipient: Alice gets parts 1 and 3. Bob gets all parts. Neither knows the other exists. Server only sees SHA256 key hints — never identities.

This is what secure email should have been. Except it's a plain HTML file.

[→ Live demo](https://mastervector-svg.github.io/polydoc/examples/envelope-demo.html) · [→ Spec](spec/POLYDOC_ENVELOPE.md)

---

## Why `.html`?

- **Zero installation** — every device has a browser
- **Passes every firewall** — it's just an HTML file
- **AI-native** — LLMs read HTML source, find the JSON, done
- **Self-describing** — the spec URL is inside every document
- **Print-ready** — CSS print styles built in

We could invent `.poly` or `.pdoc`. We didn't. Because the best format is the one that works everywhere, right now, without asking IT for permission.

---

## Dual-Mode Architecture

Every PolyDoc exists in two versions generated from the same JSON:

```
[Your IS / Backend]
        ↓ same JSON data
        ├── mail version    → static HTML, zero JS, into email body
        │                     < 50 KB, passes every client
        │                     one CTA button → link to full version
        │
        └── full version    → complete JS interpreter
                              live status from API
                              interactive buttons
                              signature verification
                              hosted on your server or downloadable
```

**The firewall bypass strategy:**
Mail is static → passes every corporate filter.
User wants interactivity → clicks to full version.
User asks IT to whitelist your domain.
IT cannot say no because the user is asking.

---

## Format at a Glance

```json
{
  "header": {
    "format": "poly/1.0",
    "spec": "https://github.com/mastervector-svg/polydoc/blob/master/spec/POLYDOC_SPEC.md",
    "doc_id": "INV-2026-001",
    "doc_type": "invoice",
    "signature": { "algorithm": "ES256", "value": "..." },
    "compression": { "algorithm": "deflate", "threshold": 10240 }
  },
  "metadata": {
    "title": { "en": "Invoice", "cs": "Faktura" },
    "language": "en",
    "languages": ["en", "cs"]
  },
  "content": {
    "type": "document",
    "sections": [
      { "type": "party", "role": "supplier", "data": { "name": "..." } },
      { "type": "table", "columns": [...], "rows": [...], "footer": {...} }
    ]
  },
  "visuals": { "theme": "modern-clean", "colors": { "primary": "#0d6efd" } },
  "logic": {
    "conditions": [{ "field": "is_paid", "value": true, "banner": { "text": "✅ PAID" } }],
    "actions": [{ "label": "Confirm order", "api_url": "..." }]
  }
}
```

Validate against [`schema/poly-v1.0.schema.json`](schema/poly-v1.0.schema.json).

---

## Repository Structure

```
polydoc/
│
├── README.md                    ← you are here
├── CONTRIBUTING.md              ← how to contribute
├── CHANGELOG.md                 ← version history
│
├── spec/
│   ├── POLYDOC_SPEC.md          ← format specification v1.0
│   ├── POLYDOC_TRANSFER.md      ← transfer format specification
│   ├── POLYDOC_ENVELOPE.md      ← envelope format specification
│   ├── DEPLOYMENT_REALTY.md     ← deployment guide: real estate portal
│   └── openapi.yaml             ← Channel API (OpenAPI 3.1)
│
├── schema/
│   └── poly-v1.0.schema.json    ← JSON Schema validator (IDE autocomplete)
│
├── server/                      ← Node.js render engine (Express)
│   ├── index.js                 ← POST /render, POST /validate, GET /schema
│   └── engine.js                ← renderFull, renderMail, DEFLATE compression
│
├── templates/
│   ├── polydoc-full.html        ← full interactive template
│   ├── polydoc-mail.html        ← static mail template
│   └── polydoc-transfer.html    ← transfer viewer template
│
├── examples/
│   ├── invoice-demo.html        ← bilingual EN/CS demo + Human/Agent toggle
│   ├── faktura-full.html        ← invoice example (full)
│   ├── faktura-mail.html        ← invoice example (mail)
│   └── realportal-transfer.html ← real estate project transfer
│
├── docs/
│   ├── PITCH.md                 ← why PolyDoc exists
│   ├── ARCHITECTURE.md          ← deep dive into design decisions
│   ├── AI_INTEGRATION.md        ← how AI agents use PolyDoc
│   └── SECURITY.md              ← signing, encryption, auth
│
└── tools/
    └── README.md                ← planned: CLI, validators, importers
```

---

## Quickstart

**Open the demo:**
```bash
git clone https://github.com/mastervector-svg/polydoc.git
cd polydoc
open examples/invoice-demo.html   # macOS
xdg-open examples/invoice-demo.html  # Linux
```

**Use the template:**
1. Copy `templates/polydoc-full.html`
2. Replace the JSON in `<script type="application/poly+json" id="raw-data">`
3. Open in browser — done

**Run with Docker (easiest):**
```bash
docker run -p 3000:3000 ghcr.io/mastervector-svg/polydoc:latest
# POST /render with PolyDoc JSON → get html_url + mail_html
```

**Or with docker-compose:**
```bash
docker compose up
```

**Run locally (Node.js):**
```bash
cd server && npm install && npm start
```

**Backend integration (PHP):**
```php
$template = file_get_contents('templates/polydoc-full.html');
$json = json_encode($yourData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
$html = preg_replace(
    '/<script type="application\/poly\+json" id="raw-data">[\s\S]*?<\/script>/',
    "<script type=\"application/poly+json\" id=\"raw-data\">\n{$json}\n</script>",
    $template
);
```

**AI agent fills envelope slots:**
```bash
# 1. Pack envelope with slots + natural language instructions
POST /envelope
{
  "manifest": { "parts": [{
    "id": "compose", "type": "text/yaml", "slot": true,
    "fill_prompt": "docker-compose for Node.js + PostgreSQL 16 + Redis"
  }]}
}

# 2. LLM generates content, returns draft for review
POST /envelope/ENV-xxx/fill-ai
{ "slot_id": "compose", "auto_fill": false }
→ { "status": "draft", "draft": "version: '3.8'\nservices: ..." }

# 3. Apply (or auto_fill: true to skip review)
POST /envelope/ENV-xxx/fill
{ "slot_id": "compose", "data": "..." }
```

```bash
# Configure your LLM (OpenAI-compatible, any model)
LLM_BASE_URL=https://your-llm/v1
LLM_API_KEY=your-key
LLM_MODEL=qwen2.5-coder:32b
docker run -p 3000:3000 -e LLM_BASE_URL -e LLM_API_KEY -e LLM_MODEL \
  ghcr.io/mastervector-svg/polydoc:latest
```

---

## Roadmap

### v1.0
- [x] Core format spec (header, metadata, content, visuals, logic)
- [x] Multilingual support (`LocalizedString` — `{"en":"...","cs":"..."}`)
- [x] Section types: header, party, table, image, rich_text, checklist
- [x] Full interpreter (inline, single-file, zero dependencies)
- [x] Mail template (static, no JS, Outlook-compatible)
- [x] Transfer format spec
- [x] Channel API (OpenAPI 3.1)
- [x] JSON Schema (`schema/poly-v1.0.schema.json`)
- [x] Node.js render engine (POST /render, POST /validate)
- [x] DEFLATE compression + AES-256-GCM encryption spec
- [x] Lazy load spec (inline / on-demand modes)
- [x] Human/Agent view toggle (demo)

### v1.1 (current)
- [x] Envelope format (`doc_type: "envelope"`) — any file, any MIME type, one HTML
- [x] Envelope Slots — collaborative filling, `fill_prompt`, `workspace://`
- [x] `POST /envelope/:id/fill` — fill slot via API
- [x] `POST /envelope/:id/fill-ai` — **LLM agent fills slot** (OpenAI-compatible, any model)
- [x] VS Code extension scaffold — sidebar, fill, pack, preview, scheduled fill
- [ ] Shared interpreter on CDN (`poly-interpreter.js`)
- [ ] SubtleCrypto signature verification (browser)
- [ ] `npx polydoc render invoice.json` CLI
- [ ] DOMPurify integration for `rich_text`
- [ ] More themes (dark, classic, minimal)
- [ ] VS Code extension — publish to Marketplace

### v2.0
- [ ] MCP server — PolyDoc as MCP tool for AI agents (`fill_slot`, `pack_envelope`, `list_envelopes`)
- [ ] WYSIWYG editor
- [ ] Official integrations (Lovable, Cursor, n8n)
- [ ] Offline-first (Service Worker)

---

## License

**MIT. Everything. Forever.**

Format spec, templates, interpreter, render engine, JSON Schema, examples — all MIT.
Build on it. Ship it. Sell it. Don't ask.

No "community edition". No "enterprise tier". No usage limits.
If you need PDF generation, DocuSign, or PandaDoc — you're paying for something PolyDoc does for free.

---

## Support & Hire Us

PolyDoc is free. If it saves you money or time:

☕ **Buy us a coffee** — [ko-fi.com](https://ko-fi.com) *(link coming soon)*

🚀 **Hire us for a real project** — We design systems like this for a living.
Automation, AI document workflows, IS integrations, custom PolyDoc deployments.
If you can imagine it and it makes business sense, we can build it.

> *"This is what we come up with for fun. Imagine what we do when you pay us."*

📬 Open an issue or start a discussion — we read everything.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
Issues, PRs, and spec proposals welcome.

The spec lives in `spec/POLYDOC_SPEC.md`. If you use PolyDoc in production, open an issue — we want to know.

---

*PolyDoc v1.0 · [Spec](spec/POLYDOC_SPEC.md) · [Channel API](spec/openapi.yaml) · [JSON Schema](schema/poly-v1.0.schema.json) · MIT*
