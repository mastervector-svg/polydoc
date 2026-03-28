# n8n Community Forum Post

**Category:** Show and Tell
**Title:** PolyDoc n8n Blueprint — share workflows safely with encrypted credentials (HTML, zero deps, offline-ready)

---

Hey n8n community,

Here's a problem I kept running into: I want to share a workflow with a colleague or publish it as a template, but it has API keys, webhook secrets, and passwords baked into node parameters. Copy-pasting the JSON means either scrubbing it manually (error-prone) or shipping credentials by accident.

So I built **PolyDoc n8n Blueprint** — a single self-contained HTML file that wraps a workflow into a shareable, interactive document.

**Live demo:** https://mastervector-svg.github.io/polydoc/examples/n8n-blueprint.html
**GitHub:** https://github.com/mastervector-svg/polydoc

---

**What it does**

- **Visual node map** — SVG canvas renders your workflow with color-coded nodes, bezier connections between them, and true/false branch labels on IF nodes. Pan and zoom included.
- **555- Security Protocol** — sensitive parameters get a special marker in the workflow JSON:
  - `555-PROMPT:OpenAI API key` → shows an orange input box asking the recipient to fill it in before they can import
  - `555-LOCKED-aes256:...` → AES-256-GCM encrypted blob (Web Crypto API, no server involved); recipient enters a password to decrypt
- **Copy to n8n** — validates that every `555-PROMPT` field is filled and every `555-LOCKED` blob is decrypted, then writes clean workflow JSON to the clipboard. Ctrl+V in n8n, done.
- **Mermaid diagram** in the docs sidebar for human-readable flow documentation.
- **Offline mode** — one click fetches Mermaid from CDN and saves a fully self-contained version. A "Lean" button strips it back if you want the smaller file.
- **i18n** — `poly.lang` field switches the UI between EN and CS (more languages welcome via PR).

---

**Quick example of the protocol**

```json
"apiKey": "555-PROMPT:Your OpenAI API key",
"webhookSecret": "555-LOCKED-aes256:U2FsdGVkX1..."
```

The first one gets a visible orange warning box. The second gets a password prompt. Neither leaks into the copied JSON.

---

**Stack / constraints**

MIT license, zero runtime dependencies, no build step, no backend. One HTML file you can email, host on GitHub Pages, or drop in a wiki.

Would love feedback — especially on the node map rendering (it handles basic layouts well but complex branching could be smarter) and whether the 555- protocol makes sense as a convention. If there's appetite, I could write an n8n node that generates these blueprints automatically from the workflow editor.

What credential-scrubbing workflows are you currently using when sharing templates?
