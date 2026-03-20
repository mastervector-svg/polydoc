# Changelog

All notable changes to the PolyDoc format and tools.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
PolyDoc format versioning follows [Semantic Versioning](https://semver.org/).

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
