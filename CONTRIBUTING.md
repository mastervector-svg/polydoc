# Contributing to PolyDoc

PolyDoc is an open spec and open implementation. Both are MIT licensed.

---

## What We're Looking For

**Spec improvements** — new section types, edge cases, clarifications.
Open a discussion issue first if it's a breaking change.

**New templates** — different visual themes, new document types.

**Interpreter implementations** — Python, PHP, Go, Rust. The reference is JavaScript.

**Tool integrations** — Lovable, Cursor, n8n, Make, Zapier, Notion.

**Real-world deployment guides** — like `DEPLOYMENT_REALTY.md` but for your industry.

---

## Spec Changes

The spec lives in `spec/POLYDOC_SPEC.md` and `spec/POLYDOC_TRANSFER.md`.

- **Additive changes** (new optional fields, new section types) → MR directly
- **Breaking changes** (removing fields, changing types) → discussion issue first
- **New document types** → include example JSON + rendering spec

All spec changes must include an example.

---

## Interpreter Contributions

The reference interpreter is in `templates/polydoc-full.html` (inline `<script>`).

Rules:
- No external dependencies in the interpreter itself
- DOMPurify is the one exception — document it clearly
- Pure functions for section renderers
- `PolyDoc.init()` must be the only global side effect

---

## Issues

Use GitLab issues. Label with:
- `spec` — format specification questions
- `interpreter` — reference implementation bugs
- `template` — visual/CSS issues
- `api` — Channel API / OpenAPI spec
- `docs` — documentation

---

## License

MIT. Your contributions are MIT. No CLA required.

---

*[Back to README](../README.md)*
