# n8n Blueprint Security Scanner

> Zero-click security audit for n8n workflows — before you import them into production.

**File:** `examples/n8n-blueprint-security.html`
**Live demo:** https://mastervector-svg.github.io/polydoc/examples/n8n-blueprint-security.html

---

## The problem

People download n8n workflows from forums, Discord, and GitHub. They import them directly into production without reviewing what the Code nodes actually do, or where HTTP Requests actually send data. A malicious workflow can:

- Exfiltrate environment variables (`process.env.DB_PASSWORD`)
- Execute OS commands on the server (`Execute Command` node)
- Send your workflow data to a hardcoded IP address
- Use obfuscated payloads (large Base64 strings that decode to malicious code)

The Security Blueprint makes these risks **immediately visible** — the moment you load the JSON, before you click anything.

---

## How it works

When you load a workflow (via **📂 Load JSON** or drag & drop), the scanner runs automatically:

1. Every node gets a risk level assigned (`computeNodeRisk`)
2. `renderNodes()` reads the risk level and sets stroke color + badge **during the render pass** — no second DOM traversal
3. Egress arrows are drawn from every network-connected node showing where data leaves your infrastructure
4. The **🔍 Audit** button badge updates to show the highest severity found

---

## Severity Scale

| Level | Label | Visual | Meaning |
|-------|-------|--------|---------|
| 0 | Safe | Default white ring | Pure logic: If, Switch, Set, Merge, Start, NoOp |
| 1 | Info | Blue ring | Network / data egress by node type |
| 2 | Warning | Amber ring + ⚠ | Code execution, file access, suspicious patterns |
| 3 | Critical | Red ring + ☠ + pulse animation | OS command execution, dangerous code patterns |

---

## Level 1 — Info (network nodes)

These nodes send or receive data from outside your workflow. Not inherently malicious, but worth knowing about:

| Node type | Label shown |
|-----------|-------------|
| HTTP Request | `→ api.example.com` (domain extracted from URL param) or `→ HTTP` |
| Webhook | `→ Webhook out` |
| Gmail / SMTP / Mailgun / SendGrid | `→ Email` |
| Slack / Telegram / Discord / MS Teams | `→ Slack` / `→ Telegram` / etc. |
| WhatsApp / Twilio | `→ WhatsApp` / `→ Twilio` |
| Postgres / MySQL / MongoDB / Redis / Supabase | `→ Database` |
| Google Sheets / Airtable / Notion | `→ Sheets` / etc. |
| S3 / Google Drive / Dropbox / OneDrive | `→ S3` / `→ Google Drive` / etc. |
| Stripe | `→ Stripe` |
| OpenAI / Anthropic / HuggingFace / Replicate | `→ OpenAI` / `→ AI API` |
| Apify | `→ Apify` |
| FTP / SFTP | `→ FTP/SFTP` |

---

## Level 2 — Warning

These nodes can execute code or access the file system. A baseline Warning level is set by node type; parameter scanning can escalate further.

**By node type:**
- `n8n-nodes-base.code` — JavaScript Code node
- `n8n-nodes-base.function` — Function node (legacy)
- Read/Write Binary File
- FTP node

**Escalated from parameters (in Code/Function nodes):**

| Pattern | Why it matters |
|---------|---------------|
| `process.env` | Reads environment variables — common way to steal database passwords, API keys |
| `require('fs')` | File system access on the server |
| Large Base64 string (80+ chars) | Classic technique to hide malicious payloads from casual review |
| `fetch()` / `XMLHttpRequest` / `axios.` inside Code | Makes HTTP requests — verify where it's sending data |

**In any node:**
- Hardcoded public IP address → Warning + VirusTotal link

---

## Level 3 — Critical

These require immediate attention. The node pulses red.

**By node type:**
- `Execute Command` — runs arbitrary OS commands on the n8n server
- `SSH` — runs commands on a remote server

**Escalated from parameters:**

| Pattern | Why it matters |
|---------|---------------|
| `eval(` | Executes arbitrary dynamic code — the classic JavaScript footgun |
| `require('child_process')` | Spawns OS subprocesses — equivalent of Execute Command from Code |
| `new Function(` | Dynamic code execution, same risk as `eval` |
| `-----BEGIN ... PRIVATE KEY` | Plaintext private key in workflow parameters |
| `.onion` domain | Tor hidden service destination — highly suspicious in any automation |

---

## Egress Arrows

For every node with level ≥ 1, a **dashed arrow** is drawn from the output port to the right of the node:

```
[HTTP Request node] ─ ─ ─ ─ ─ ─⟶  → api.stripe.com    (blue)
[Code + process.env]─ ─ ─ ─ ─ ─⟶  → HTTP              (amber, ⚠)
[Execute Command]   ─ ─ ─ ─ ─ ─⟶  → External          (red, ☠, pulsing)
```

**For HTTP Request nodes**, the label shows the actual target domain extracted from the `url` parameter:

```json
"url": "https://api.openai.com/v1/chat/completions"
       → label: "→ api.openai.com"

"url": "https://185.12.45.100/collect"
       → label: "→ 185.12.45.100"   (amber Warning — hardcoded public IP)
```

This gives you an instant "data flow map" — you see every place data leaves your infrastructure, coloured by risk, without opening a single node.

Arrow colors match risk levels:
- Blue (Info) — standard network communication
- Amber (Warning) — needs review
- Red (Critical) — act before importing

---

## Audit Panel

Click **🔍 Audit** (or `☠ N critical` / `⚠ N warning` after a scan) to open the panel.

The panel shows:
- **Offline Scan Results** — sorted by severity, each finding with a message and VirusTotal link for IPs
- **AI Audit** — config + Run button (see below)

Clicking a node name in the panel **selects that node** and opens the editor panel, where you see the security findings above the parameters.

---

## AI Audit

The AI Audit sends only the risky nodes (Code, HTTP Request, Execute Command, SSH, Webhook, and any node with `555-` parameters) to an LLM for deeper analysis.

### Setup

| Field | Default | Notes |
|-------|---------|-------|
| LLM Endpoint | `https://api.openai.com/v1/chat/completions` | Any OpenAI-compatible API |
| Model | `gpt-4o-mini` | Cheap and fast; `gpt-4o` for thoroughness |
| API Key | *(empty)* | In-memory only — never saved to the Blueprint file |

**Ollama (local, free):**
```
Endpoint: http://localhost:11434/v1/chat/completions
Model:    qwen2.5-coder:14b
Key:      (anything — Ollama ignores it)
```

> Ollama must be started with `OLLAMA_ORIGINS="*"` to allow browser fetch calls.

### What gets sent

The scanner extracts a compact payload — only the node `id`, `name`, `type`, and `parameters`. Position data, metadata, and unrelated fields are stripped. A 40-node workflow typically produces a payload under 15 KB.

### System prompt

```
You are a security analyst reviewing n8n workflow nodes for malicious behavior.
Look for: data exfiltration, credential leakage, RCE vulnerabilities,
obfuscated code (base64 payloads), suspicious network destinations, hardcoded secrets.
Respond STRICTLY with a JSON array. Each element:
  "nodeId" (string), "level" ("safe"|"warning"|"critical"), "reason" (string, max 120 chars).
Include ONLY nodes with findings.
```

Using `response_format: { type: "json_object" }` (OpenAI) or `format: "json"` (Ollama) ensures the model outputs parseable JSON without preamble text.

### Results

AI findings are **merged** into the existing offline scan results:
- Level can only go **up** (AI can escalate, not downgrade offline findings)
- `aiReason` is shown in the Audit panel and in the node editor panel (blue text, prefixed with 🤖)
- The SVG heat map re-renders with updated risk levels

---

## Architecture notes

**Risk-first rendering** — `assignRiskLevels()` runs before `renderGraph()`. By the time `renderNodes()` draws each rect, `node._risk` is already set. Stroke color and width come directly from the risk level — no post-render DOM mutation pass.

**Egress arrows** — rendered in a final pass after all nodes and connections, so they never overlap nodes. Each arrow is a Bezier curve with a slight upward angle to suggest "departure".

**Three SVG markers** (`arr-egress-1/2/3`) — one per risk level with hardcoded stroke color. Avoids reliance on `context-stroke` which has spotty browser support.

**AI merge** — `applyAuditOverlay()` copies updated `auditResults` entries back into `node._risk` then calls `renderGraph()`. The full render is fast enough (< 10ms for 60 nodes) that a full repaint is cleaner than patching individual SVG elements.

---

## CORS notes

| Target | Status | Notes |
|--------|--------|-------|
| `api.openai.com` | ✅ Works | OpenAI CORS headers allow browser fetch |
| Local Ollama | ✅ Works | Requires `OLLAMA_ORIGINS="*"` env var |
| Anthropic direct | ⚠ May fail | No CORS headers on `api.anthropic.com` |
| Your own proxy | ✅ Works | Recommended for Anthropic / custom models |

For Anthropic: run a minimal CORS proxy on your server, point the Endpoint field at it.

---

## Limitations of static analysis

The offline scanner is heuristic — it catches common patterns but cannot:

- Detect logic that's split across multiple nodes and only harmful in combination
- Understand dynamic values (a `fetch()` URL built from `$json.targetUrl` at runtime)
- Analyse npm packages imported in Code nodes
- Verify that a `process.env` read is actually sent anywhere

**This is why the AI Audit exists** — it can read the code with context and spot things regexes miss. Use both together: offline scan gives you the instant heat map, AI audit gives you the reasoning.

---

*Part of [PolyDoc](../README.md) — MIT License*
