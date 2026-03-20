# Changelog

All notable changes to the PolyDoc format and tools.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
PolyDoc format versioning follows [Semantic Versioning](https://semver.org/).

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

### [1.1.0]
- Shared interpreter on CDN (`poly-interpreter.js`)
- SubtleCrypto signature verification (client-side)
- DOMPurify integration documented
- Additional themes: `modern-dark`, `classic`, `minimal`
- CLI tool (`npx polydoc render`)

### [2.0.0]
- JSON Schema validator
- MCP server implementation
- Official integrations: Lovable, Cursor, n8n
- WYSIWYG editor
- Offline-first (Service Worker)
