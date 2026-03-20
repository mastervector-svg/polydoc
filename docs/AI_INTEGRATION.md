# AI Integration Guide

*How AI agents use PolyDoc Channel to deliver documents to users.*

---

## The Core Idea

Give any LLM the `openapi.yaml` and it immediately knows:
- How to render documents
- What document types exist
- How to structure the JSON
- What to do after rendering

No custom prompt. No fine-tuning. The spec is the instruction.

---

## Quickstart for AI Builders

### Step 1: Point your agent at the Channel API

```
System prompt addition:
"You have access to a PolyDoc Channel API.
Spec: https://your-domain.cz/polydoc/v1/openapi.yaml
When you need to deliver a document to the user, use this channel."
```

Or use tool calling with the OpenAPI spec directly.
Claude, GPT-4, and Gemini all support OpenAPI-based tool generation.

### Step 2: The agent discovers the channel

```
GET /.well-known/polydoc-channel
```

Response includes `ai_instructions` — the LLM reads this and knows the workflow.

### Step 3: The agent renders a document

```json
POST /render
{
  "document": {
    "header": { "format": "poly/1.0", "doc_id": "...", "doc_type": "invoice" },
    "content": { "type": "document", "sections": [ ... ] }
  },
  "options": { "store": true, "generate_mail_version": true }
}
```

### Step 4: The agent responds to the user

```
"Your invoice is ready: [Open Invoice](https://app.example.cz/doc/INV-2026-001?t=abc123)"
```

---

## Full Workflow Example

**User:** "Send Novák an invoice for 10 hours of consulting at 2500 CZK/hour."

**Agent:**

1. `GET /.well-known/polydoc-channel` → reads capabilities and instructions
2. `GET /schema/invoice` → gets the exact JSON structure needed
3. Assembles the document JSON
4. `POST /validate` → confirms structure is correct
5. `POST /render` with `sign: true` → gets `html_url` and `mail_html`
6. Sends email with `mail_html` as body
7. Responds: "Invoice sent to Novák. [View invoice](html_url)"

**Total API calls: 4. Human intervention: 0.**

---

## Document Types and When to Use Them

### `invoice`
When: User asks to create/send an invoice, billing document, payment request.
Required sections: `header`, `party` (supplier + client), `table` (items).
Optional: `rich_text` (payment terms), `checklist` (status).

### `confirmation`
When: Something happened that needs acknowledgment. Viewing booked, order placed, document received.
Required sections: `header`, `detail_grid` or `table` (what/when/who/reference).
Optional: `next_steps`, action buttons.

### `offer`
When: Presenting an option to the user. Property listing, product proposal, service quote.
Required: `header`, content describing the offer, `agent_card` (who sent it).
Optional: `image`, `checklist` (features).

### `status_update`
When: Something changed that the user should know about. Price changed, document added, payment received.
Required: `header` with clear status, explanation of change.
Optional: action buttons.

### `report`
When: Summary of data, activity, or analysis.
Required: `header`, at least one `table` or structured content.
Optional: multiple sections, `rich_text` for narrative.

### `transfer`
When: Moving project data between systems, creating a backup, handing off to another agent.
Use `POST /transfer` endpoint, not `/render`.

---

## Reading PolyDoc Files as Context

AI agents can be given PolyDoc files as context input.
The JSON block is always in `<script type="application/poly+json" id="raw-data">`.

```python
import re, json

def extract_polydoc_json(html: str) -> dict:
    match = re.search(
        r'<script type="application/poly\+json" id="raw-data">([\s\S]*?)</script>',
        html
    )
    if match:
        return json.loads(match.group(1))
    raise ValueError("No PolyDoc JSON found in file")
```

Use cases:
- Transfer files as agent context (knowledge base, config)
- Invoice verification ("does this invoice match our order?")
- Document comparison ("what changed between these two versions?")
- Data extraction without OCR

---

## Transfer Files as Agent Context

The Transfer format is particularly powerful as LLM context.
A single transfer file can contain:
- Agent system prompts and tool definitions
- Knowledge base (rules, FAQ, examples)
- API schemas the agent needs to call
- Project-specific configuration

```python
# Load a transfer file as agent context
transfer_html = open("realportal-transfer.html").read()
polydoc = extract_polydoc_json(transfer_html)

# Extract agent config
agent_configs = [
    item for item in polydoc["payload"]
    if item["type"] == "agent_config"
]

# Extract knowledge base
knowledge_bases = [
    item for item in polydoc["payload"]
    if item["type"] == "knowledge_base"
]

# Build system prompt
system_prompt = agent_configs[0]["data"]["system_prompt"]
knowledge = format_knowledge_base(knowledge_bases[0]["data"])
```

---

## The `x-ai-instructions` Field

The `openapi.yaml` contains a top-level `x-ai-instructions` field.
Modern LLMs (Claude, GPT-4, Gemini) read this when ingesting the spec.

```yaml
x-ai-instructions: |
  This is PolyDoc Channel API — standardized channel for AI-to-user document delivery.

  BASIC WORKFLOW:
  1. GET /.well-known/polydoc-channel — discover capabilities
  2. GET /schema/{doc_type} — learn the structure
  3. Assemble JSON per PolyDocument schema
  4. POST /validate — verify before sending
  5. POST /render — get html_url and mail_html
  6. Give html_url to user as a link
  7. Send mail_html as email body
  ...
```

This field requires no special processing. The LLM reads it naturally as part of the spec.

---

## Security for AI-Generated Documents

### Always validate before sending
```json
POST /validate
{ "document": { ... }, "checks": ["schema", "xss", "hash"] }
```
AI-generated content can contain unintended HTML in `rich_text` fields.
Validation catches XSS vectors before the document reaches a user.

### Sensitive documents: request encryption
```json
POST /render
{ ..., "options": { "access": { "mode": "encrypted" } } }
```
The server returns an `html_url` with a fragment key.
The key never reaches the server — only the user with the URL can decrypt.

### `env_schema` rule
AI agents MUST NOT include actual secret values in `env_schema` payload items.
Only key names, types, descriptions, and examples.
This is enforced by the spec and should be enforced by your IS.

---

## MCP Integration (Model Context Protocol)

PolyDoc Channel API can be exposed as an MCP server.
This allows Claude Desktop, Cursor, and other MCP-compatible tools
to use PolyDoc natively as a tool.

```json
{
  "mcpServers": {
    "polydoc": {
      "url": "https://your-domain.cz/polydoc/v1/mcp",
      "name": "PolyDoc Channel"
    }
  }
}
```

The MCP server wraps the Channel API endpoints as tools:
- `polydoc_render` — render a document
- `polydoc_transfer` — create a transfer package
- `polydoc_validate` — validate a document
- `polydoc_schema` — get schema for a document type

---

*[Back to README](../README.md) · [Channel API](../spec/openapi.yaml) · [Architecture](ARCHITECTURE.md)*
