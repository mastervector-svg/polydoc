# Changelog

All notable changes to the PolyDoc format and tools.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
PolyDoc format versioning follows [Semantic Versioning](https://semver.org/).

---

## [1.2.0] — 2026-03-21

### Added

#### Fill Providers (spec/POLYDOC_ENVELOPE.md §11)
- `fill.mode: "on-demand"` with external service providers
- `fill.src` URI — plain HTTPS URL or registered scheme (`katastr://`, `cob://`, `lei://`, `vat://eu/`, `osm://`, `cad://`)
- `fill.cache_ttl` — provider cache with `slot_state: "stale"` lifecycle
- `auth_from_part` — credentials from encrypted envelope part, never exposed in HTML
- International examples: CZ/DE/UK real estate, EU cross-border due diligence, building permits
- `POST /envelope/:id/fill-provider` API endpoint (spec)

#### Workflow, Access Control & DRM (spec/POLYDOC_WORKFLOW.md — new file)
- `encryption.key_location: "remote"` — key server with `key_ttl`, `key_grace`, `max_opens`, `device_binding`, `revocable`
- `access.mode: "time_lock"` — NTP multivalidation (n-of-m sources), countdown display
- `signature.timestamp` — RFC 3161 Trusted Timestamp Authority (TSA) integration
- `quorum` block — n-of-m approvals with ES256 signatures, `on_quorum` actions (webhook, git_merge, unlock)
- `quorum.four_eyes: true` + `notary` block — eIDAS-compliant qualified electronic signature
- `git` block — auto-commit on slot_fill/approval, document as deploy gate
- `encryption.export_lock` — disable export JSON, copy protection, per-user watermark, export time window
- Embedded media: `video/*`, `audio/*`, `application/pdf` via blob URL (data never written to disk)
- `application/wasm` — sandboxed WebAssembly apps running inside the document
- `playback` block — `inline`, `allow_download`, `max_plays`, `watermark`

#### Documentation
- All spec files translated to English (POLYDOC_SPEC.md, POLYDOC_ENVELOPE.md, POLYDOC_TRANSFER.md, CHANGELOG.md)
- Use case 5: Live Commerce Document — PolyDoc as EDI replacement with live listings
- openapi.yaml translated to English (Czech version preserved as openapi.cs.yaml)
- DEPLOYMENT_REALTY.md translated to English (Czech version preserved as DEPLOYMENT_REALTY.cs.md)

### Changed
- `templates/polydoc-envelope.html` extracted from inline buildEnvelopeHtml() — template file now used
- README: Five Use Cases (added Live Commerce Document)
- Roadmap updated to reflect v1.1 completed items and new v1.2/v2.0 items

---

## [1.1.0] — 2026-03-20

### Added

#### Envelope format (`doc_type: "envelope"`)
- `spec/POLYDOC_ENVELOPE.md` — complete specification of the cryptographic envelope
  - Arbitrary content as parts: text, JSON, YAML, PDF, ZIP, tar.gz, nested PolyDoc, …
  - Anonymous recipients via SHA256 key hints — server never knows identities
  - Signature covers the manifest (hash of each part), not content — confirmation without opening
  - Hybrid encryption: AES-256-GCM content + RSA-OAEP keys per-recipient
  - Lazy load + selective per-part encryption
- `examples/envelope-demo.html` — live example: cover letter + invoice + payment terms

#### Collaborative Slots (§10)
- `slot: true` in manifest.parts — a part awaiting filling
- `fill_prompt` — natural language as instruction for an AI agent
- `fill.mode: manual | on-demand | scheduled` — when and how it gets filled
- `workspace://` scheme — linking a slot to a local file
- `slot_state: empty → filled` + `hash_at_fill`, `filled_at`, `filled_by`

#### Server API — Envelope endpoints
- `POST /envelope` — create an envelope (embedded parts + empty slots)
- `GET /envelope/:doc_id` — envelope status: manifest, `slots_empty`, `envelope_complete`
- `POST /envelope/:doc_id/fill` — fill a slot with data (compresses, hashes, regenerates HTML)
- `POST /envelope/:doc_id/fill-ai` — **LLM agent fills a slot**
  - Assembles context from filled parts + `fill_prompt`
  - Calls OpenAI-compatible API (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_KEY_HEADER`, `LLM_MODEL`)
  - `auto_fill: false` → returns draft for review; `auto_fill: true` → fills directly
  - Tested with: Ollama (local), `qwen2.5-coder:32b` (vLLM)

#### VS Code Extension (scaffold)
- `vscode-extension/` — TypeScript scaffold, unpublished
  - Sidebar panel: scans workspace, displays envelopes and their slots
  - Fill slot with one click — selects a file from the workspace, sends to server or patches HTML directly
  - Pack Envelope wizard — select files, name them, embed or slot
  - Preview panel — renders PolyDoc/Envelope directly in the editor
  - Scheduled fill — cron parser, minute ticker, auto-fetch from URL

### Changed
- README: Envelope added as the fourth use case with full description
- Roadmap updated — Envelope moved to completed

---

## [1.0.1] — 2026-03-20

### Added
- JSON Schema (`schema/poly-v1.0.schema.json`) — IDE autocomplete, machine validation
- Node.js render engine (`server/`) — `POST /render`, `POST /validate`, `GET /schema/:type`, Channel discovery
- Docker image — `ghcr.io/mastervector-svg/polydoc:latest`, GitHub Actions CI/CD on every tag
- Bilingual demo (`examples/invoice-demo.html`) — EN/CS language switcher in toolbar
- Human/Agent view — 👤/🤖 button shows what a human sees vs. what an LLM reads from the same file
- Multilang mail rendering — server selects language from `options.lang` in `POST /render`
- `LocalizedString` — text fields support `{"en":"...","cs":"..."}` objects
- `i18n` block in document for UI labels (supplier, client, table headers…)
- Selective DEFLATE compression — per-section property, `header.compression.threshold`
- Lazy load — `lazy_mode: inline | on-demand`, `header.lazy.threshold`
- AES-256-GCM fragment encryption spec (`header.encryption`, key in URL fragment)

### Fixed
- Mail template fully tokenised — hardcoded Czech labels → `{{LABEL_*}}` tokens
- Click-through in `faktura-mail.html` → live full version on GitHub Pages
- Responsiveness — toolbar, page, and tables at mobile resolutions
- Document footer shows spec version with link to `header.spec` URL
- `doc_id`/`doc_type` validation correctly reads from `header.*` (not from root)

### Changed
- Roadmap updated — JSON Schema, render engine, Docker moved to completed

---

## [1.0.0] — 2026-03-12

### Added
- Core format spec (`spec/POLYDOC_SPEC.md`)
- Section types: `header`, `party`, `table`, `image`, `rich_text`, `checklist`, `paragraph`, `divider`
- Full interpreter (inline, single-file, no dependencies)
- Mail template (static, table layout, Outlook-compatible, inline CSS)
- Transfer format spec (`spec/POLYDOC_TRANSFER.md`)
- Transfer viewer template
- Channel API specification (`spec/openapi.yaml`, OpenAPI 3.1)
- Transfer payload types: `agent_config`, `knowledge_base`, `frontend_structure`, `backend_structure`, `connector_config`, `env_schema`, `workflow_definitions`, `prompt_library`, `test_cases`
- Deployment guide for real estate portal (`spec/DEPLOYMENT_REALTY.md`)
- Three access modes: signed token, session cookie, AES-GCM fragment encryption
- ES256 signing specification
- DEFLATE compression for transfer payloads
- Example: invoice (full + mail versions)
- Example: RealPortal project transfer

---

## Planned

### [1.2.0]
- `npx polydoc render invoice.json` — CLI tool
- Auto-detect browser language in full version (`navigator.language`)
- On-demand translation via translation API (DeepL / LibreTranslate)
- SubtleCrypto ES256 signature verification (browser)
- DOMPurify integration for `rich_text` sections
- More themes: `modern-dark`, `classic`, `minimal`
- Shared interpreter on CDN (`poly-interpreter.js`)

### [2.0.0]
- MCP server — PolyDoc as MCP tool for AI agents
- Integrations: Lovable, Cursor, n8n
- WYSIWYG editor
- Offline-first (Service Worker)
