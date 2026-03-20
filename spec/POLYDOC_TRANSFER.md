# PolyDoc Transfer Format — Specification v1.0

> Universal transfer format for AI projects, agent configuration,
> frontend and backend structures, connector settings, and knowledge bases.
> Signed, versioned, optionally compressed. Still just an `.html` file.

---

## 1. What is PolyDoc Transfer?

An extension of the PolyDoc format with a `transfer` type — a transfer container for structured
project data. Designed for:

- Moving projects between tools (Lovable → Cursor → internal IS)
- Backup and archiving AI projects in a human-readable format
- Sharing agent configuration and their knowledge
- Versioned snapshots of an entire project or parts of it
- Distribution of templates, connectors, and workflows

**Key property:** The file is still valid HTML.
Open it in a browser → see what's inside, which versions, what is compressed.
Pass it to an agent → it reads the JSON directly from source.
Import into IS → one regex, done.

---

## 2. Transfer document header

```json
{
  "header": {
    "format": "poly/1.0",
    "spec": "https://github.com/polydoc/spec/blob/main/transfer-v1.0.md",
    "doc_id": "transfer_proj_abc_20260312_001",
    "doc_type": "transfer",

    "transfer": {
      "purpose": "backup",
      "label": "Full RealPortal project — sprint 4 snapshot",
      "source": {
        "tool": "lovable",
        "project_id": "proj_abc123",
        "project_name": "RealPortal v2",
        "url": "https://lovable.dev/projects/proj_abc123"
      },
      "target": {
        "tool": "cursor",
        "hint": "Import as new workspace"
      },
      "contents": [
        "agent_config",
        "knowledge_base",
        "frontend_structure",
        "backend_structure",
        "connector_config",
        "ui_components",
        "env_schema"
      ],
      "compression": "deflate",
      "encoding": "base64",
      "total_items": 47,
      "total_size_bytes": 284500,
      "compressed_size_bytes": 91200
    },

    "version": {
      "schema": "1.0",
      "project": "2.4.1",
      "created_at": "2026-03-12T08:00:00Z",
      "snapshot_id": "snap_20260312_0800",
      "previous_snapshot": "snap_20260305_1430",
      "changelog": "Added Supabase + Resend connectors. Updated agent for generating offers."
    },

    "signature": {
      "algorithm": "ES256",
      "value": "MEUCIQD...",
      "public_key": "-----BEGIN PUBLIC KEY-----...",
      "signed_fields": ["transfer", "version", "payload_hash"],
      "payload_hash": "sha256:e3b0c44298fc1c149afb..."
    },

    "generator": {
      "tool": "Lovable Export v1.2",
      "timestamp": "2026-03-12T08:00:00Z",
      "operator": "jan.novak@example.cz"
    }
  }
}
```

### `transfer.purpose` values

| Value | Description |
|-------|-------------|
| `backup` | Backup copy of the project |
| `migration` | Moving between tools |
| `distribution` | Template for distribution |
| `snapshot` | State checkpoint (before deploy, before refactor) |
| `handoff` | Handover to another team / agent |
| `sync` | Synchronization between IS instances |

### `transfer.contents[]` values

| Value | Description |
|-------|-------------|
| `agent_config` | AI agent settings (instructions, model, tools) |
| `knowledge_base` | Agent knowledge base (FAQ, rules, examples) |
| `frontend_structure` | Component structure, routing, design system |
| `backend_structure` | API endpoints, data models, business logic |
| `connector_config` | External connector settings (Supabase, Stripe…) |
| `ui_components` | Exported UI components (JSX/HTML) |
| `env_schema` | Environment variable schema (without values!) |
| `workflow_definitions` | Automation and workflow definitions |
| `prompt_library` | Project prompt library |
| `test_cases` | Test cases and expectations |

---

## 3. Payload structure

Each content type is a separate section in `payload[]`.

```json
{
  "payload": [

    {
      "type": "agent_config",
      "id": "agent_offer_generator",
      "label": "Agent for generating real estate offers",
      "version": "1.3.0",
      "compressed": true,
      "data": "BASE64_DEFLATE_ENCODED_STRING"
    },

    {
      "type": "knowledge_base",
      "id": "kb_realty_rules",
      "label": "Rules and FAQ for real estate communication",
      "version": "2.1.0",
      "compressed": false,
      "data": { ... }
    },

    {
      "type": "frontend_structure",
      "id": "frontend_main",
      "label": "Main frontend structure",
      "version": "4.2.1",
      "compressed": true,
      "data": "BASE64_DEFLATE_ENCODED_STRING"
    },

    {
      "type": "connector_config",
      "id": "connector_supabase",
      "label": "Supabase configuration",
      "version": "1.0.0",
      "compressed": false,
      "sensitive": false,
      "data": { ... }
    },

    {
      "type": "env_schema",
      "id": "env_production",
      "label": "Production variable schema",
      "note": "Schema only — values are not part of the export!",
      "compressed": false,
      "data": { ... }
    }

  ]
}
```

---

## 4. Schema for individual types

### `agent_config`

```json
{
  "type": "agent_config",
  "id": "agent_offer_generator",
  "label": "Agent for generating real estate offers",
  "version": "1.3.0",
  "compressed": false,
  "data": {
    "model": "claude-sonnet-4-5",
    "provider": "anthropic",
    "system_prompt": "You are an expert in real estate communication...",
    "temperature": 0.7,
    "max_tokens": 2000,
    "tools": [
      {
        "name": "get_property_details",
        "description": "Loads property details from IS",
        "endpoint": "{{IS_BASE_URL}}/api/properties/{id}",
        "auth": "bearer_token"
      },
      {
        "name": "send_polydoc_mail",
        "description": "Sends a PolyDoc mail to the client",
        "endpoint": "{{IS_BASE_URL}}/api/messages/send",
        "auth": "bearer_token"
      }
    ],
    "memory": {
      "type": "supabase_vector",
      "table": "agent_memory",
      "embedding_model": "text-embedding-3-small"
    },
    "triggers": [
      {
        "event": "new_matching_property",
        "action": "generate_and_send_offer"
      }
    ]
  }
}
```

### `knowledge_base`

```json
{
  "type": "knowledge_base",
  "id": "kb_realty_rules",
  "label": "Rules for real estate communication",
  "version": "2.1.0",
  "compressed": false,
  "data": {
    "format": "structured",
    "language": "cs",
    "sections": [
      {
        "id": "tone_rules",
        "title": "Communication tone",
        "type": "rules",
        "items": [
          "Always address by name, never 'dear customer'",
          "Always state prices with VAT in CZK",
          "Personalize offers — mention why this particular property"
        ]
      },
      {
        "id": "faq",
        "title": "Frequently asked questions",
        "type": "qa_pairs",
        "items": [
          {
            "q": "How long does a reservation last?",
            "a": "The reservation is valid for 14 days from the signing of the reservation agreement."
          }
        ]
      },
      {
        "id": "examples",
        "title": "Examples of good offers",
        "type": "examples",
        "items": [
          {
            "label": "Good offer opening",
            "text": "Based on your requirements from our meeting, I have selected for you..."
          }
        ]
      }
    ],
    "embeddings_included": false,
    "embedding_model": "text-embedding-3-small",
    "vector_store": "supabase"
  }
}
```

### `frontend_structure`

```json
{
  "type": "frontend_structure",
  "id": "frontend_main",
  "label": "Main frontend",
  "version": "4.2.1",
  "framework": "react",
  "compressed": true,
  "data": "BASE64_DEFLATE...",
  "data_schema": {
    "routing": [
      { "path": "/", "component": "Dashboard" },
      { "path": "/properties", "component": "PropertyList" },
      { "path": "/doc/:id", "component": "PolyDocViewer" }
    ],
    "design_tokens": {
      "colors": { "primary": "#0d6efd", "accent": "#ffc107" },
      "fonts": { "body": "DM Sans", "mono": "DM Mono" },
      "spacing_unit": 4
    },
    "component_tree": [
      {
        "name": "App",
        "children": ["Router", "AuthProvider", "ThemeProvider"]
      }
    ],
    "state_management": "zustand",
    "api_client": "tanstack-query"
  }
}
```

### `backend_structure`

```json
{
  "type": "backend_structure",
  "id": "backend_main",
  "label": "Backend API structure",
  "version": "3.1.0",
  "framework": "node-express",
  "compressed": true,
  "data": "BASE64_DEFLATE...",
  "data_schema": {
    "base_url": "{{IS_BASE_URL}}/api/v1",
    "auth": "jwt_bearer",
    "endpoints": [
      {
        "method": "GET",
        "path": "/properties",
        "description": "List of properties",
        "params": ["page", "limit", "filter"],
        "response": "PropertyList"
      },
      {
        "method": "POST",
        "path": "/messages/send",
        "description": "Send a PolyDoc message",
        "body": "SendMessageRequest",
        "response": "MessageResult"
      }
    ],
    "data_models": [
      {
        "name": "Property",
        "fields": {
          "id": "uuid",
          "title": "string",
          "price": "number",
          "status": "enum:active,reserved,sold"
        }
      }
    ],
    "database": "postgresql",
    "orm": "prisma"
  }
}
```

### `connector_config`

```json
{
  "type": "connector_config",
  "id": "connector_supabase",
  "label": "Supabase — main database",
  "version": "1.0.0",
  "compressed": false,
  "sensitive": false,
  "data": {
    "service": "supabase",
    "region": "eu-central-1",
    "project_ref": "xyzxyzxyz",
    "url_template": "https://{{SUPABASE_PROJECT_REF}}.supabase.co",
    "auth_type": "anon_key + service_role",
    "env_vars_required": ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_KEY"],
    "tables": ["properties", "clients", "messages", "doc_tokens", "agent_memory"],
    "rls_enabled": true,
    "realtime_channels": ["property_status", "message_status"]
  }
}
```

### `env_schema`

```json
{
  "type": "env_schema",
  "id": "env_production",
  "label": "Production environment variables",
  "note": "SCHEMA ONLY — no actual values!",
  "compressed": false,
  "data": {
    "variables": [
      {
        "key": "SUPABASE_URL",
        "type": "url",
        "required": true,
        "description": "Supabase project URL",
        "example": "https://xxx.supabase.co",
        "group": "database"
      },
      {
        "key": "ANTHROPIC_API_KEY",
        "type": "secret",
        "required": true,
        "description": "API key for Claude",
        "example": "sk-ant-...",
        "group": "ai"
      },
      {
        "key": "IS_BASE_URL",
        "type": "url",
        "required": true,
        "description": "Base URL of the internal IS",
        "example": "https://app.realportal.cz",
        "group": "app"
      }
    ],
    "groups": ["database", "ai", "app", "email", "storage", "payments"]
  }
}
```

---

## 5. Compression (DEFLATE)

Large data (frontend structures, knowledge bases with examples) can be compressed.

### Rule: when to compress

| Uncompressed data size | Action |
|------------------------|--------|
| < 10 KB | Keep as readable JSON (`compressed: false`) |
| 10 KB – 100 KB | Compression recommended |
| > 100 KB | Compression mandatory |

### Compression implementation

**Compression (Node.js, on export):**
```javascript
import { deflateSync } from 'zlib';

function compressPayloadItem(data) {
  const json = JSON.stringify(data);
  const compressed = deflateSync(Buffer.from(json, 'utf8'), { level: 9 });
  return compressed.toString('base64');
}
```

**Decompression (Node.js, on import):**
```javascript
import { inflateSync } from 'zlib';

function decompressPayloadItem(base64Data) {
  const compressed = Buffer.from(base64Data, 'base64');
  const decompressed = inflateSync(compressed);
  return JSON.parse(decompressed.toString('utf8'));
}
```

**Decompression (browser, DecompressionStream API):**
```javascript
async function decompressInBrowser(base64Data) {
  const compressed = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
  const stream = new DecompressionStream('deflate');
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  writer.write(compressed);
  writer.close();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const decompressed = new TextDecoder().decode(
    new Uint8Array(chunks.reduce((a, b) => [...a, ...b], []))
  );
  return JSON.parse(decompressed);
}
```

---

## 6. Versioning and diff

Each snapshot carries a reference to the previous version.
The diff can be computed based on the `snapshot_id` chain.

```json
{
  "version": {
    "project": "2.4.1",
    "snapshot_id": "snap_20260312_0800",
    "previous_snapshot": "snap_20260305_1430",
    "changelog": "Added Supabase + Resend connectors.",
    "diff": {
      "added": ["connector_supabase", "connector_resend"],
      "modified": ["agent_offer_generator"],
      "removed": [],
      "breaking_changes": false
    }
  }
}
```

---

## 7. Signature and integrity

The payload hash ensures that no one modified the data after export.

```javascript
// Compute payload_hash (before signing)
import { createHash } from 'crypto';

function computePayloadHash(payload) {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return 'sha256:' + createHash('sha256').update(canonical).digest('hex');
}

// ES256 signature of header + hash
import { SignJWT } from 'jose';

async function signTransferDoc(header, privateKey) {
  const toSign = {
    transfer: header.transfer,
    version: header.version,
    payload_hash: header.signature.payload_hash,
  };
  const jwt = await new SignJWT(toSign)
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuedAt()
    .sign(privateKey);
  return jwt; // stored in header.signature.value
}

// Verification (on import)
import { jwtVerify, importSPKI } from 'jose';

async function verifyTransferDoc(doc) {
  const publicKey = await importSPKI(doc.header.signature.public_key, 'ES256');
  const { payload } = await jwtVerify(doc.header.signature.value, publicKey);

  // Verify payload hash
  const computedHash = computePayloadHash(doc.payload);
  if (computedHash !== payload.payload_hash) {
    throw new Error('Payload hash mismatch — data has been tampered with!');
  }
  return true;
}
```

---

## 8. Browser viewer

Because it is still HTML, the viewer displays the contents of the transfer file.

```
┌─────────────────────────────────────────────────────────┐
│  [POLY]  RealPortal v2 — Sprint 4 snapshot              │
│  Exported: 12 Mar 2026  ·  Source: Lovable              │
│  ✅ Signature verified  ·  47 items  ·  91 KB           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📦 Contents of this file                               │
│                                                         │
│  🤖 Agents (2)                                          │
│     agent_offer_generator v1.3.0                        │
│     agent_client_support  v0.9.1                        │
│                                                         │
│  🧠 Knowledge base (1)                                  │
│     kb_realty_rules v2.1.0                              │
│                                                         │
│  🎨 Frontend (1)                                        │
│     frontend_main v4.2.1 · React · 284 KB → 91 KB      │
│                                                         │
│  ⚙️  Backend (1)                                        │
│     backend_main v3.1.0 · Node/Express                  │
│                                                         │
│  🔌 Connectors (3)                                      │
│     Supabase, Resend, Stripe                            │
│                                                         │
│  🔑 ENV schema (1)                                      │
│     12 variables · groups: database, ai, app            │
│                                                         │
│  ─────────────────────────────────────────────────     │
│  Changes since snap_20260305_1430:                      │
│  + connector_supabase  + connector_resend               │
│  ~ agent_offer_generator (modified)                     │
│                                                         │
│  [⬇ Download JSON]  [🔏 Verify signature]  [📋 Copy]   │
└─────────────────────────────────────────────────────────┘
```

---

## 9. Import into the target system

### Lovable
```javascript
// Lovable Import API (pseudo-code)
const transfer = await PolyDocTransfer.load('project-snapshot.html');
await transfer.verify(); // verify signature
await lovable.importProject({
  agentConfigs:   transfer.getByType('agent_config'),
  knowledgeBases: transfer.getByType('knowledge_base'),
  frontend:       transfer.getByType('frontend_structure'),
  connectors:     transfer.getByType('connector_config'),
});
```

### Cursor / VS Code
```javascript
// .polydoc-import.js in project root
import { PolyDocTransfer } from '@polydoc/transfer';

const t = await PolyDocTransfer.load('./handoff.html');
await t.verify();
await t.extractTo('./src', { types: ['frontend_structure', 'backend_structure'] });
await t.writeEnvSchema('./.env.example');
```

### Internal IS (PHP)
```php
$transfer = PolyDocTransfer::load('backup.html');
$transfer->verify(); // throws on invalid signature

foreach ($transfer->getByType('agent_config') as $agent) {
    AgentConfig::upsert($agent['id'], $agent['data']);
}
foreach ($transfer->getByType('connector_config') as $connector) {
    ConnectorConfig::upsert($connector['id'], $connector['data']);
}
```

---

## 10. Security rules

- **`env_schema` NEVER contains actual values** — only keys, types, descriptions
- **`connector_config`** — stores configuration (URL, tables, settings), not API keys
- Sensitive payload items can be encrypted using the same mechanism as PolyDoc documents (AES-GCM, key stored outside the file)
- The signature verifies integrity — ensures the file was not modified after export
- Always verify the signature before import — `transfer.verify()` as the first step

---

## 11. Tool compatibility

| Tool | Status | Note |
|------|--------|------|
| Lovable | Planned | Export/Import via API |
| Cursor | Planned | VS Code extension |
| Claude Code | Planned | Native reading from #raw-data |
| Custom IS (PHP/Node) | Done | See implementation above |
| n8n / Make | Planned | HTTP node + JSON parse |
| Zapier | Planned | Webhook trigger |

---

*PolyDoc Transfer Format v1.0 · MIT license · 2026-03-12*
