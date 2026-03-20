# Changelog

All notable changes to the PolyDoc format and tools.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
PolyDoc format versioning follows [Semantic Versioning](https://semver.org/).

---

## [1.1.0] — 2026-03-20

### Added

#### Envelope format (`doc_type: "envelope"`)
- `spec/POLYDOC_ENVELOPE.md` — kompletní specifikace kryptografické obálky
  - Libovolný obsah jako části: text, JSON, YAML, PDF, ZIP, tar.gz, vnořený PolyDoc, …
  - Anonymní příjemci přes SHA256 key hinty — server nikdy nezná identity
  - Podpis pokrývá manifest (hash každé části), ne obsah — potvrzení bez otevření
  - Hybrid encryption: AES-256-GCM obsah + RSA-OAEP klíče per-recipient
  - Lazy load + selektivní šifrování per-part
- `examples/envelope-demo.html` — živý příklad: průvodní dopis + faktura + platební podmínky

#### Collaborative Slots (§10)
- `slot: true` v manifest.parts — část čekající na vyplnění
- `fill_prompt` — přirozený jazyk jako instrukce pro AI agenta
- `fill.mode: manual | on-demand | scheduled` — kdy a jak se naplní
- `workspace://` schéma — propojení slotu s lokálním souborem
- `slot_state: empty → filled` + `hash_at_fill`, `filled_at`, `filled_by`

#### Server API — Envelope endpoints
- `POST /envelope` — vytvoř obálku (embedded části + prázdné sloty)
- `GET /envelope/:doc_id` — stav obálky: manifest, `slots_empty`, `envelope_complete`
- `POST /envelope/:doc_id/fill` — naplň slot daty (komprimuje, hashuje, přegeneruje HTML)
- `POST /envelope/:doc_id/fill-ai` — **LLM agent naplní slot**
  - Sestaví kontext z vyplněných částí + `fill_prompt`
  - Zavolá OpenAI-compatible API (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_KEY_HEADER`, `LLM_MODEL`)
  - `auto_fill: false` → vrátí draft k review; `auto_fill: true` → naplní přímo
  - Testováno s: Ollama (lokální), `qwen2.5-coder:32b` (vLLM)

#### VS Code Extension (scaffold)
- `vscode-extension/` — TypeScript scaffold, nepublikováno
  - Sidebar panel: skenuje workspace, zobrazí obálky a jejich sloty
  - Fill slot jedním klikem — vybere soubor z workspace, pošle na server nebo patchne HTML přímo
  - Pack Envelope wizard — vyber soubory, pojmenuj, embed nebo slot
  - Preview panel — renderuje PolyDoc/Envelope přímo v editoru
  - Scheduled fill — cron parser, minutový ticker, auto-fetch z URL

### Changed
- README: Envelope přidán jako čtvrtý use case s plným popisem
- Roadmapa aktualizována — Envelope přesunuto do hotových

---

## [1.0.1] — 2026-03-20

### Added
- JSON Schema (`schema/poly-v1.0.schema.json`) — IDE autocomplete, strojová validace
- Node.js render engine (`server/`) — `POST /render`, `POST /validate`, `GET /schema/:type`, Channel discovery
- Docker image — `ghcr.io/mastervector-svg/polydoc:latest`, GitHub Actions CI/CD na každý tag
- Bilingual demo (`examples/invoice-demo.html`) — EN/CS přepínač jazyků v toolbaru
- Human/Agent view — tlačítko 👤/🤖 ukazuje co vidí člověk vs co čte LLM ze stejného souboru
- Multilang mail rendering — server vybere jazyk z `options.lang` při `POST /render`
- `LocalizedString` — textová pole podporují `{"en":"...","cs":"..."}` objekty
- `i18n` blok v dokumentu pro UI labely (supplier, client, table headers...)
- Selektivní DEFLATE komprese — per-sekce vlastnost, `header.compression.threshold`
- Lazy load — `lazy_mode: inline | on-demand`, `header.lazy.threshold`
- AES-256-GCM fragment encryption spec (`header.encryption`, klíč v URL fragmentu)

### Fixed
- Mail šablona plně tokenizována — hardcoded české labely → `{{LABEL_*}}` tokeny
- Proklik v `faktura-mail.html` → živá full verze na GitHub Pages
- Responsivita — toolbar, stránka i tabulky na mobilních rozlišeních
- Footer dokumentu zobrazuje spec verzi s odkazem na `header.spec` URL
- `doc_id`/`doc_type` validace správně z `header.*` (ne z rootu)

### Changed
- Roadmapa aktualizována — JSON Schema, render engine, Docker přesunuty do hotových

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
- Auto-detect jazyka prohlížeče v full verzi (`navigator.language`)
- On-demand překlad přes překladač API (DeepL / LibreTranslate)
- SubtleCrypto ES256 ověření podpisu (browser)
- DOMPurify integrace pro `rich_text` sekce
- Více témat: `modern-dark`, `classic`, `minimal`
- Shared interpreter na CDN (`poly-interpreter.js`)

### [2.0.0]
- MCP server — PolyDoc jako MCP tool pro AI agenty
- Integrace: Lovable, Cursor, n8n
- WYSIWYG editor
- Offline-first (Service Worker)
