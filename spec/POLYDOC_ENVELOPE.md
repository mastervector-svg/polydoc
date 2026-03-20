# PolyDoc — Envelope Format

> **Motto:** A cryptographic shipment. The header is always readable. Only you can open the contents.

---

## §1 What is an Envelope

An Envelope (`doc_type: "envelope"`) is a special type of PolyDoc document that acts as a **cryptographic wrapper** for any content — documents, files, data, other PolyDoc files.

### Envelope vs. document

| Property | Document (`invoice`, `contract`, …) | Envelope (`envelope`) |
|----------|--------------------------------------|----------------------|
| Visual sections (`content.sections`) | Yes — rendered as a document | No — envelopes have no visual sections |
| Parts (`parts[]`) | No | Yes — any number, any types |
| Recipients | Not relevant | `manifest.recipients[]` with anonymous hints |
| Signature | Covers the entire document | Covers the manifest (hash of each part) |
| Mail part | Optional | `mail_part` — always a static HTML summary |

**Key property:** the header and manifest are **always readable without a key**. The content of individual parts is optionally encrypted, compressed, or lazy-loaded.

The envelope allows the recipient to:
- Confirm that the shipment was received (by verifying the manifest signature) — **without knowing the contents**
- See what the envelope contains (part descriptions, types, sizes) — without opening it
- Open only those parts for which they have a key

---

## §2 JSON Structure

```json
{
  "header": {
    "format": "poly/1.0",
    "doc_id": "ENV-2026-001",
    "doc_type": "envelope",
    "created": "2026-03-20T10:00:00Z",
    "signature": {
      "algorithm": "ES256",
      "covers": "manifest",
      "value": "base64...",
      "note": "Signature covers the manifest (hash of each part), not the content — can be verified without opening"
    }
  },
  "manifest": {
    "label": { "en": "Contract + Invoice package", "cs": "Balík: smlouva + faktura" },
    "sender": { "hint": "sha256:aabbcc..." },
    "recipients": [
      { "key_hint": "sha256:abc123...", "parts": ["contract"] },
      { "key_hint": "sha256:def456...", "parts": ["invoice", "contract"] }
    ],
    "parts": [
      {
        "id": "invoice",
        "type": "text/markdown",
        "label": { "en": "Invoice", "cs": "Faktura" },
        "compressed": true,
        "encrypted": false,
        "size_original": 2400,
        "size_stored": 890,
        "hash": "sha256:xyz..."
      },
      {
        "id": "contract",
        "type": "application/pdf",
        "label": { "en": "Contract", "cs": "Smlouva" },
        "compressed": true,
        "encrypted": true,
        "encryption": { "algorithm": "AES-256-GCM", "key_for": "recipients" },
        "size_original": 45000,
        "size_stored": 12300,
        "hash": "sha256:abc..."
      },
      {
        "id": "preview",
        "type": "text/html",
        "label": { "en": "Preview", "cs": "Náhled" },
        "lazy": true,
        "lazy_mode": "on-demand",
        "src": "https://api.example.cz/envelope/ENV-2026-001/preview"
      }
    ]
  },
  "parts": [
    {
      "id": "invoice",
      "compressed": true,
      "data": "base64(deflate(content))"
    },
    {
      "id": "contract",
      "compressed": true,
      "encrypted": true,
      "data": "base64(deflate(AES-GCM-encrypt(content)))"
    }
  ],
  "mail_part": {
    "type": "text/html",
    "label": { "en": "You have received a secure package", "cs": "Obdrželi jste zabezpečenou zásilku" },
    "data": "static HTML for mail version — no JS, info + CTA link only"
  }
}
```

### Required fields

| Field | Required | Description |
|-------|----------|-------------|
| `header.format` | Yes | `"poly/1.0"` |
| `header.doc_id` | Yes | Unique envelope ID (recommended prefix `ENV-`) |
| `header.doc_type` | Yes | Must be `"envelope"` |
| `header.created` | Yes | ISO 8601 timestamp |
| `manifest.parts[]` | Yes | At least one part |
| `manifest.parts[].id` | Yes | Unique part ID within the envelope |
| `manifest.parts[].type` | Yes | MIME type of the content |

### Optional fields

| Field | Description |
|-------|-------------|
| `header.signature` | Cryptographic signature of the manifest |
| `manifest.label` | Human-readable name of the shipment |
| `manifest.sender` | Sender's public key hint |
| `manifest.recipients[]` | Anonymous recipients with key hints |
| `parts[]` | Inline content — may be absent if parts are lazy |
| `mail_part` | Static HTML version for email |

---

## §3 Confirmation Without Knowledge of Contents

The signature in `header.signature` covers the **manifest** — specifically the hash of each part in `manifest.parts[].hash`, not the content itself.

This allows the recipient to:
1. Read the manifest (always unencrypted)
2. Verify the manifest signature (ES256 via WebCrypto API)
3. **Confirm receipt of the shipment** to the sender — without opening a single part

This is a key property for audit scenarios: delivery confirmation is cryptographically provable without revealing the contents.

### Verification procedure

```
1. Load the manifest from the envelope (always plaintext JSON)
2. Serialize manifest.parts[] as canonical JSON (sorted keys)
3. Verify the ES256 signature in header.signature.value
   use the sender's public key (from manifest.sender or out-of-band)
4. If the signature is valid → the shipment has not been modified since signing
5. Reply to the sender with hash(manifest) as confirmation — without the contents
```

---

## §4 Anonymous Recipients

```json
"recipients": [
  { "key_hint": "sha256:abc123...", "parts": ["contract"] },
  { "key_hint": "sha256:def456...", "parts": ["invoice", "contract"] }
]
```

`key_hint` = `SHA256(recipient_public_key)` — a fingerprint of the recipient's public key.

**The server never knows the identity of the recipient.** It only knows key fingerprints. Only the actual recipient can:
- Compute the fingerprint of their own public key
- Compare it with `key_hint` in the manifest
- Find out which parts are intended for them

The sender encrypts each part for specific recipients using their public keys (asymmetric encryption of the symmetric AES key — hybrid encryption pattern).

### Why a fingerprint, not the full key?

The full public key would be an identifier — for example, an email address in a certificate would reveal the identity. A SHA256 fingerprint is non-attributable without knowledge of the key itself.

---

## §5 Partial Opening

The envelope supports **three access layers** that can be freely combined:

### mail_part — always readable

`mail_part` is static HTML without JS. It is rendered automatically as a banner above the manifest. It contains only basic information: "You have received a shipment with N attachments" + a CTA link to the interactive version.

```json
"mail_part": {
  "type": "text/html",
  "label": { "cs": "Obdrželi jste zabezpečenou zásilku" },
  "data": "<p>You have received a shipment with 3 attachments...</p><a href='...'>Open</a>"
}
```

### Manifest — always readable (without a key)

The interpreter always displays the manifest: a list of parts with descriptions, types, sizes, and icons. The recipient can see **what** the envelope contains, even without a key.

### Parts — optionally encrypted or lazy

Each part in `parts[]` can have a different access mode:

| Part state | Interpreter behaviour |
|-----------|----------------------|
| `encrypted: false, lazy: false` | Shows an "Open" button — immediate access |
| `encrypted: true` | Shows a field for entering a key or deriving one from a URL fragment |
| `lazy: true` | Shows a "Load" button — fetches `src` on click |
| `encrypted: true, lazy: true` | Lazy fetch + decryption after entering the key |

---

## §6 Multi-recipient

A single envelope can have multiple recipients, each with access to a different subset of parts:

```json
"recipients": [
  {
    "key_hint": "sha256:alice...",
    "parts": ["invoice"],
    "encrypted_keys": {
      "invoice": "base64(RSA-OAEP-encrypt(aes_key_invoice, alice_pubkey))"
    }
  },
  {
    "key_hint": "sha256:bob...",
    "parts": ["invoice", "contract"],
    "encrypted_keys": {
      "invoice":  "base64(RSA-OAEP-encrypt(aes_key_invoice, bob_pubkey))",
      "contract": "base64(RSA-OAEP-encrypt(aes_key_contract, bob_pubkey))"
    }
  }
]
```

**Pattern:** Hybrid encryption — the AES-256-GCM key for each part is encrypted with the RSA-OAEP public key of each authorised recipient separately. The content itself is encrypted only once (AES).

Recipient Alice:
1. Finds her `key_hint` in `recipients[]`
2. Decrypts `encrypted_keys.invoice` with her private key → obtains the AES key
3. Decrypts the `invoice` part using this AES key

Recipient Bob obtains AES keys for both parts and can open both.

---

## §7 Supported Content Types (`parts[].type`)

| MIME type | Description | Interpreter behaviour |
|-----------|-------------|----------------------|
| `text/markdown` | Markdown text | Rendered as HTML (simple regex) |
| `text/html` | HTML content | Sandboxed `<iframe>` |
| `text/plain` | Plain text | `<pre>` block |
| `application/json` | JSON data | Syntax-highlighted code block |
| `application/pdf` | PDF document | Offers download or inline viewer |
| `application/zip` | ZIP archive | Offers download |
| `application/polydoc` | Nested PolyDoc | Rendered recursively in iframe |
| `image/png` | PNG image | `<img>` tag |
| `image/jpeg` | JPEG image | `<img>` tag |
| `image/svg+xml` | SVG image | `<img>` tag (sanitised) |
| Any MIME | Any content | Offers download as file |

The envelope is not limited to the types listed above — it accepts **any MIME type**. Unknown types are offered for download by the interpreter.

---

## §8 Interpreter Behaviour

### Displaying the manifest

When opening an envelope, the interpreter always displays:

```
[Shipment name from manifest.label]
[mail_part banner — if present]

Shipment parts:
  📄 Invoice        text/markdown  2.4 KB  [Open]
  🔒 Contract       application/pdf  44 KB  [Enter key]  [compressed]
  ⏳ Preview        text/html  —  [Load]
```

### Icons by MIME type

| Type | Icon |
|------|------|
| `text/markdown` | 📄 |
| `application/json` | 📋 |
| `image/*` | 🖼️ |
| `application/zip` | 📦 |
| `application/polydoc` | 📎 |
| Encrypted part | 🔒 |
| Lazy part (not yet loaded) | ⏳ |
| Other | 📁 |

### Opening a part

```
Click "Open":
  compressed: true  → decompress base64(deflate(data)) → display
  compressed: false → display data directly

Click "Load" (lazy):
  lazy_mode: on-demand  → fetch(src) → display, do not store
  lazy_mode: inline     → fetch(src) → display, save into parts[]

Click "Enter key" (encrypted):
  → show input field
  → user enters key (or derived from URL fragment)
  → WebCrypto AES-GCM decrypt → display
```

### Modal for content

Each opened part is displayed in a modal window:

| Content type | Rendering method |
|-------------|-----------------|
| `text/markdown` | Simple regex rendering (headings, bold, lists, code) |
| `text/html` | `<iframe sandbox="allow-scripts">` |
| `application/json` | Syntax-highlighted `<pre>` |
| `image/*` | `<img>` tag, full width |
| Other | "Download as file" button |

---

## §9 Usage Examples

### Notarial package
Contract + invoice + attachments in a single shipment. The client confirms receipt by verifying the manifest signature (without opening the contents). The notary opens the envelope with their key.

```
manifest.parts: [contract (PDF, encrypted), invoice (Markdown), attachments (ZIP)]
recipients: [client, notary, archive]
```

### AI agent → user
The agent returns analysis results in multiple formats (JSON data, Markdown report, visualisation as HTML). The user opens their preferred format.

```
manifest.parts: [analysis.json, report.md, chart.html]
encrypted: false (but compressed)
```

### Secure data room
Due diligence package for an M&A transaction. Each participant (buyer, auditor, lawyer) has access only to their own parts.

```
manifest.parts: [financial-model.xlsx, legal-docs.zip, tech-audit.pdf]
recipients: [buyer, auditor, legal]
each recipient: different subset of parts[]
```

### Transfer between systems
As a transfer format (see `POLYDOC_TRANSFER.md`), but with a cryptographic signature and optional encryption. Suitable for: handing off a project between teams, secure archiving, transmission over an untrusted channel.

```
manifest.parts: [config.json (polydoc/transfer), knowledge-base.md, assets.zip]
signature: ES256 (covers manifest)
```

---

## §10 Slots — Collaborative Filling

A **slot** is a part of the envelope that the sender has defined but intentionally left unfilled. It designates who should fill it, in what way, and when.

### Slot definition in manifest.parts

```json
{
  "id": "infrastructure",
  "type": "text/yaml",
  "label": { "en": "Your infrastructure config", "cs": "Vaše infrastruktura" },
  "slot": true,
  "assigned_to": { "key_hint": "sha256:recipient_pubkey_hash..." },
  "workspace_hint": "docker-compose.yml",
  "fill": {
    "mode": "manual",
    "src": null
  }
}
```

Slot with on-demand or scheduled renewal:

```json
{
  "id": "test-results",
  "type": "application/json",
  "label": { "en": "Latest test results" },
  "slot": true,
  "assigned_to": { "key_hint": "sha256:ci_pipeline_key..." },
  "fill": {
    "mode": "scheduled",
    "schedule": "0 6 * * 1",
    "src": "https://ci.example.cz/api/test-results/latest.json"
  }
}
```

### Slot fields

| Field | Required | Description |
|-------|----------|-------------|
| `slot` | Yes | `true` — marks the part as a slot awaiting filling |
| `assigned_to.key_hint` | No | SHA256 fingerprint of the key of the recipient responsible for filling |
| `workspace_hint` | No | Recommended filename for linking to the workspace |
| `fill.mode` | Yes | `manual` / `on-demand` / `scheduled` |
| `fill.src` | No | URL for automatic content loading |
| `fill.schedule` | No | Cron expression for scheduled renewal |

### Slot state

Each slot in `manifest.parts` can have a state:

| State | Description |
|-------|-------------|
| `empty` | Slot defined, not yet filled (default) |
| `filled` | Part filled, available in `parts[]` |
| `linked` | Linked to a workspace or URL, awaiting pull |
| `stale` | `hash_at_fill` does not match the current content of `fill.src` |

```json
{
  "id": "infrastructure",
  "slot": true,
  "slot_state": "filled",
  "filled_by": { "key_hint": "sha256:recipient..." },
  "filled_at": "2026-03-20T14:30:00Z",
  "hash_at_fill": "sha256:abc123..."
}
```

### Workspace link (`workspace://`)

The recipient can link a slot to a local file in their workspace:

```json
"fill": {
  "mode": "on-demand",
  "src": "workspace://docker-compose.yml"
}
```

The `workspace://` scheme is resolved by the tool (VS Code extension, CLI) to the actual path in the open project. During a fill operation:
1. Reads the current file contents
2. Computes the hash
3. Inserts into `parts[]` as a regular part
4. Updates `slot_state` to `filled` + `filled_at` timestamp

### Fill API — server endpoint

```
POST /envelope/{doc_id}/fill
Authorization: Bearer <api_key>

{
  "slot_id": "infrastructure",
  "data": "base64(content)",
  "compressed": false,
  "signed_by": { "key_hint": "sha256:..." }
}

→ {
    "ok": true,
    "doc_id": "ENV-2026-001",
    "slot_id": "infrastructure",
    "hash": "sha256:...",
    "html_url": "/output/ENV-2026-001-envelope.html"
  }
```

The server adds the part to `parts[]`, updates `manifest.parts[].slot_state`, and generates a new version of the HTML.

### Lifecycle of a collaborative envelope

```
Sender (architect):
  → creates the envelope with slots
  → fills their own parts (embedded)
  → assigns slots to recipients (key_hint)
  → sends by email or uploads to a shared URL

Recipient (ops team):
  → opens in browser or VS Code
  → sees: "YOUR PARTS TO FILL"
  → links workspace:// or enters data manually
  → clicks [Fill] → part is inserted into the envelope
  → optionally signs their contribution

CI pipeline:
  → POST /envelope/{id}/fill after every build
  → test-results slot is updated automatically

Shared URL:
  → anyone opens it → sees current state of all parts
  → scheduled slots are renewed according to cron schedule
  → each person sees only the parts for which they have a key
```

### Usage examples

**Deployment package:**
```
Architect:  INSTALL.md (embedded) + agent-config.json (embedded)
Ops team:   docker-compose.yml (slot → workspace://) + .env.prod (slot → encrypted)
CI:         test-results.json (slot → scheduled, every build)
```

**Due diligence (M&A):**
```
Seller:   financial-model.xlsx (embedded, encrypted) + info-memo.pdf (embedded)
Buyer:    nda-signed.pdf (slot → manual fill) + term-sheet.docx (slot → manual fill)
Lawyer:   review-notes.md (slot → on-demand, workspace://)
```

**Project handover:**
```
Lovable/Cursor: frontend.zip (embedded) + schema.sql (embedded)
New team:       env-vars.json (slot → fill according to their environment)
Customer:       branding.zip (slot → fill with their assets)
```

---

## §11 Fill Providers — on-demand slot filling by external service

A slot with `fill.mode: "on-demand"` can declare a **provider** — an external service that fills the slot automatically when requested. The slot content is fetched live from the provider, cached for `cache_ttl` seconds, and stored exactly like a manually filled slot.

This enables envelopes where parts are **always current**: land registry extracts, company filings, exchange rates, CAD renderings, satellite imagery — anything with an API.

### 11.1 Slot declaration

```json
{
  "id": "company-extract",
  "type": "application/pdf",
  "label": { "en": "Company extract", "de": "Handelsregisterauszug", "cs": "Výpis z obchodního rejstříku" },
  "slot": true,
  "fill": {
    "mode": "on-demand",
    "src": "https://providers.example.com/ares/v1/extract?ico=12345678&format=pdf",
    "auth": "bearer",
    "returns": "application/pdf",
    "cache_ttl": 604800,
    "review_required": false
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `fill.mode` | `"on-demand"` | Slot is filled by calling `fill.src` |
| `fill.src` | URI | URL of the provider endpoint, or a registered scheme (see §11.3) |
| `fill.auth` | `"none"` \| `"bearer"` \| `"api_key"` \| `"oauth2"` | How the server authenticates to the provider |
| `fill.returns` | MIME type | Expected response content type |
| `fill.cache_ttl` | integer (seconds) | How long the filled content is valid. `0` = always refetch |
| `fill.review_required` | boolean | If `true`, filled content waits for human approval before `slot_state → filled` |
| `fill.params` | object | Static parameters merged into the provider call |

### 11.2 Slot states for on-demand slots

```
empty → filling → filled
              ↓
           stale  (cache_ttl elapsed — content still readable, marked outdated)
              ↓
           filling → filled  (re-fetched)
```

`slot_state: "stale"` means the data exists but `filled_at + cache_ttl < now`. The interpreter shows a warning badge. The server can re-fill automatically on the next `GET /envelope/:id?fill=live`.

### 11.3 Provider URI schemes

Implementations MAY support short URI schemes as aliases for well-known provider endpoints. This is optional — a plain HTTPS URL always works.

```
katastr://parcela/{parcel_id}         → CZ: ČÚZK land registry (PDF extract)
 ares://ico/{ico}                      → CZ: ARES company registry (JSON/PDF)
cob://company/{jurisdiction}/{id}     → Companies House (UK), KVK (NL), Handelsregister (DE), etc.
lei://entity/{lei_code}               → Global LEI (Legal Entity Identifier) — GLEIF
vat://eu/{country}/{vat_number}       → EU VAT registry (VIES)
osm://map/{lat},{lon}/{zoom}          → OpenStreetMap tile / static map image
cad://project/{id}/render             → CAD/BIM application fill (returns image/png or model)
```

Schemes are resolved server-side by a **provider registry** — a simple JSON config that maps scheme → endpoint template. Operators can register custom schemes for internal systems (ERP, DMS, GIS).

Example provider registry entry:

```json
{
  "scheme": "cob",
  "description": "Companies registry — multi-jurisdiction",
  "endpoint": "https://providers.polydoc.example/company/v1/{jurisdiction}/{id}",
  "auth": "api_key",
  "returns": "application/pdf",
  "jurisdictions": ["uk", "de", "nl", "fr", "pl", "sk", "cz", "at"]
}
```

### 11.4 International examples

The same envelope structure works across jurisdictions — only the `fill.src` changes.

**Real estate transaction (CZ + DE + UK)**

| Part | Provider | `fill.src` | `cache_ttl` |
|------|----------|------------|-------------|
| Land registry extract | ČÚZK (CZ) | `katastr://parcela/1234/5` | 86 400 s |
| Grundbuchauszug | Grundbuch (DE) | `cob://company/de/HRB12345` | 86 400 s |
| Title register | HM Land Registry (UK) | `https://api.example.com/hmrc/title/EGL123456` | 86 400 s |
| Floor plan preview | CAD service | `cad://project/proj-42/render?view=floor&format=png` | 0 (always fresh) |
| Company extract | ARES (CZ) / LEI | `lei://entity/529900T8BM49AURSDO55` | 604 800 s |
| VAT status | EU VIES | `vat://eu/CZ/CZ12345678` | 3 600 s |

**Permit application (building / planning)**

```json
{
  "manifest": {
    "label": { "en": "Building permit package", "cs": "Stavební povolení", "de": "Baugenehmigung" },
    "parts": [
      {
        "id": "cadastral-map",
        "type": "image/png",
        "label": { "en": "Cadastral map", "cs": "Katastrální mapa" },
        "slot": true,
        "fill": { "mode": "on-demand", "src": "katastr://mapa/1234/5?format=png", "cache_ttl": 86400 }
      },
      {
        "id": "floor-plan",
        "type": "image/png",
        "label": { "en": "Floor plan", "cs": "Půdorys", "de": "Grundriss" },
        "slot": true,
        "fill": {
          "mode": "on-demand",
          "src": "cad://project/bp-2026-042/render?view=floor&scale=1:100&format=png",
          "cache_ttl": 0,
          "review_required": true
        }
      },
      {
        "id": "technical-report",
        "type": "text/markdown",
        "label": { "en": "Technical report", "cs": "Technická zpráva" },
        "slot": true,
        "fill_prompt": "Generate technical report from floor plan and cadastral data",
        "fill": { "mode": "on-demand", "src": "ai://slot/technical-report", "cache_ttl": 0 }
      },
      {
        "id": "authority-stamp",
        "type": "application/x-polydoc-stamp",
        "label": { "en": "Authority approval stamp", "cs": "Razítko úřadu" },
        "slot": true,
        "assigned_to": { "key_hint": "sha256:urad-stavebni..." },
        "fill": { "mode": "manual", "review_required": true }
      }
    ]
  }
}
```

The authority fills only the `authority-stamp` slot — the rest was fetched from registries and the CAD tool. The manifest signature covers all part hashes, so the stamp confirms the authority saw **exactly this version** of the drawings and extracts.

**Financial due diligence (EU cross-border)**

| Part | Provider | Notes |
|------|----------|-------|
| Company extract (target) | LEI / local registry | `lei://entity/{lei}` |
| Beneficial owners | OpenCorporates | `https://api.opencorporates.com/companies/{jurisdiction}/{id}` |
| VAT confirmation | EU VIES | `vat://eu/{cc}/{vat}` |
| Exchange rate snapshot | ECB | `https://api.frankfurter.app/latest?from=EUR&to=CZK,PLN,HUF` |
| Sanctions check | OpenSanctions | `https://api.opensanctions.org/match/default` |
| Credit rating | internal ERP | `erp://creditcheck/{customer_id}` |

None of these need a bespoke integration — each is a URL the server calls, the response is base64-encoded, stored as a filled slot, and rendered in the browser.

### 11.5 Server API — live fill endpoint

```
GET /envelope/:doc_id?fill=live
```

When `fill=live` is set, the server iterates all unfilled or stale on-demand slots, calls their `fill.src`, stores the response, and returns the updated HTML. Callers can also trigger a single slot:

```
POST /envelope/:doc_id/fill-provider
{
  "slot_id": "cadastral-map"   // optional — if omitted, fill all on-demand slots
}
```

Response:

```json
{
  "ok": true,
  "filled": ["cadastral-map", "company-extract"],
  "skipped": ["authority-stamp"],
  "stale_refreshed": ["floor-plan"],
  "html_url": "/output/ENV-xxx-envelope.html"
}
```

### 11.6 Security considerations

- Provider URLs are server-side only — never exposed to the browser
- `auth` credentials (tokens, keys) are stored in server config, not in the envelope HTML
- `fill.src` with custom schemes (`katastr://`, `cob://`) are resolved only on the server — a crafted envelope cannot redirect calls to arbitrary hosts unless the operator registers the scheme
- Response MIME type is validated against `fill.returns` before storing
- `cache_ttl: 0` content is refetched but the previous version remains in the envelope until the new fetch succeeds (fail-safe)

---

*PolyDoc Envelope v1.0 · MIT licence · 2026-03-20*
