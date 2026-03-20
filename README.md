# PolyDoc

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

---

## The Problem

Modern business communication is broken:

| Format | Problem |
|--------|---------|
| **PDF** | Static, machine-unreadable, expensive to generate |
| **DOCX** | Binary XML mess, requires Microsoft ecosystem |
| **Plain JSON** | Can't be opened directly, needs a viewer |
| **Email HTML** | Clients block JavaScript, no interactivity |

Every tool forces you to choose between **human-readable** and **machine-readable**. PolyDoc refuses that tradeoff.

---

## The Solution

A single `.html` file that is simultaneously:

- ✅ **A document** — open in any browser, print to PDF, looks professional
- ✅ **A database** — structured JSON inside, parseable by any tool or LLM
- ✅ **An API response** — AI agents can render and send documents via Channel API
- ✅ **An email** — static mail version passes every spam filter and firewall
- ✅ **A transfer container** — ship entire project configs, agent setups, knowledge bases

---

## Three Use Cases

### 1. Transactional Documents
Invoices, confirmations, offers, contracts.

```
IS/Backend → generates PolyDoc → sends as email body (static)
                                → stores on server (interactive)
User clicks → full version loads → can confirm, download, verify signature
```

### 2. AI Channel (DisplayPort for AI)
AI agents use the [Channel API](spec/openapi.yaml) to render and deliver documents to users. One OpenAPI spec — any LLM understands it immediately.

```
User: "Send Novák an invoice for consulting"
Claude: reads Channel API → assembles JSON → POST /render → shares html_url
```

### 3. Transfer Format
Move entire projects between tools (Lovable → Cursor → your IS). Agent configs, knowledge bases, frontend structures, connector settings — all in one signed, versioned, optionally compressed file.

```
Lovable export → polydoc-transfer.html → Cursor import
                                       → open in browser to inspect
                                       → feed to Claude as context
```

---

## Why `.html`?

- **Zero installation** — every device has a browser
- **Passes every firewall** — it's just an HTML file
- **AI-native** — LLMs read HTML source, find the JSON, done
- **Self-describing** — the spec URL is inside every document
- **Print-ready** — CSS print styles built in

The `.html` extension is a deliberate choice. We could invent `.poly` or `.pdoc`. We didn't. Because the best format is the one that works everywhere, right now, without asking IT for permission.

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
    "spec": "https://github.com/polydoc/spec",
    "doc_id": "INV-2026-001",
    "doc_type": "invoice",
    "signature": { "algorithm": "ES256", "value": "..." }
  },
  "metadata": { "title": "Invoice", "tags": ["invoice", "2026"] },
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
│   ├── DEPLOYMENT_REALTY.md     ← deployment guide: real estate portal
│   └── openapi.yaml             ← Channel API (OpenAPI 3.1)
│
├── templates/
│   ├── polydoc-full.html        ← full interactive template
│   ├── polydoc-mail.html        ← static mail template
│   └── polydoc-transfer.html    ← transfer viewer template
│
├── examples/
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

**Render your first document:**
```bash
# Clone the repo
git clone https://gitlab.com/polydoc/polydoc.git
cd polydoc

# Open the example invoice in your browser
open examples/faktura-full.html

# Or open the transfer example
open examples/realportal-transfer.html
```

**Use the template:**
1. Copy `templates/polydoc-full.html`
2. Replace the JSON in `<script type="application/poly+json" id="raw-data">`
3. Open in browser

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

**AI agent (Channel API):**
```
Give any LLM the openapi.yaml and it immediately knows how to:
- render documents for your users
- create transfer packages
- validate and sign documents
```

---

## Roadmap

### v1.0 (current)
- [x] Core format spec (header, metadata, content, visuals, logic)
- [x] Section types: header, party, table, image, rich_text, checklist
- [x] Full interpreter (inline, single-file)
- [x] Mail template (static, no JS, table layout)
- [x] Transfer format spec
- [x] Channel API (OpenAPI 3.1)
- [x] Deployment guide (real estate portal)

### v1.1
- [ ] Shared interpreter on CDN (`poly-interpreter.js`)
- [ ] SubtleCrypto signature verification
- [ ] DOMPurify integration
- [ ] More themes (dark, classic, minimal)
- [ ] CLI tool (`npx polydoc render invoice.json`)

### v2.0
- [ ] JSON Schema validator
- [ ] WYSIWYG editor
- [ ] Official tool integrations (Lovable, Cursor, n8n)
- [ ] Offline-first (Service Worker)

---

## License

MIT — format spec, templates, interpreter, tools. Everything.  
Build on it. Ship it. Don't ask.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).  
Issues, PRs, and spec discussions welcome.

The spec lives in `spec/POLYDOC_SPEC.md`. Propose changes via MR.

---

*PolyDoc v1.0 · [Spec](spec/POLYDOC_SPEC.md) · [Channel API](spec/openapi.yaml) · MIT*
