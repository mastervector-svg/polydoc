# PolyDoc Transfer Format — Specifikace v1.0

> Univerzální přenosový formát pro AI projekty, konfiguraci agentů,
> frontendové a backendové struktury, nastavení konektorů a znalostní báze.
> Podepsaný, verzovaný, volitelně komprimovaný. Stále jen `.html` soubor.

---

## 1. Co je PolyDoc Transfer?

Rozšíření PolyDoc formátu o typ `transfer` — přenosový kontejner pro strukturovaná
projektová data. Navržen pro:

- Přenos projektů mezi nástroji (Lovable → Cursor → interní IS)
- Backup a archivaci AI projektů ve čitelném formátu
- Sdílení konfigurace agentů a jejich znalostí
- Verzovaný snapshot celého projektu nebo jeho části
- Distribuci šablon, konektorů a workflows

**Klíčová vlastnost:** Soubor je stále validní HTML.
Otevřeš v prohlížeči → vidíš co uvnitř je, jaké verze, co je komprimované.
Předáš agentovi → přečte JSON přímo ze source.
Importuješ do IS → jeden regex, hotovo.

---

## 2. Hlavička transfer dokumentu

```json
{
  "header": {
    "format": "poly/1.0",
    "spec": "https://github.com/polydoc/spec/blob/main/transfer-v1.0.md",
    "doc_id": "transfer_proj_abc_20260312_001",
    "doc_type": "transfer",

    "transfer": {
      "purpose": "backup",
      "label": "Celý projekt RealPortal — sprint 4 snapshot",
      "source": {
        "tool": "lovable",
        "project_id": "proj_abc123",
        "project_name": "RealPortal v2",
        "url": "https://lovable.dev/projects/proj_abc123"
      },
      "target": {
        "tool": "cursor",
        "hint": "Importovat jako nový workspace"
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
      "changelog": "Přidány konektory Supabase + Resend. Aktualizován agent pro generování nabídek."
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

### Hodnoty `transfer.purpose`

| Hodnota | Popis |
|---------|-------|
| `backup` | Záložní kopie projektu |
| `migration` | Přesun mezi nástroji |
| `distribution` | Šablona k distribuci |
| `snapshot` | Stavový bod (před deployem, před refaktorem) |
| `handoff` | Předání jinému týmu / agentovi |
| `sync` | Synchronizace mezi instancemi IS |

### Hodnoty `transfer.contents[]`

| Hodnota | Popis |
|---------|-------|
| `agent_config` | Nastavení AI agentů (instrukce, model, nástroje) |
| `knowledge_base` | Znalostní báze agenta (FAQ, pravidla, příklady) |
| `frontend_structure` | Struktura komponent, routing, design systém |
| `backend_structure` | API endpointy, datové modely, business logika |
| `connector_config` | Nastavení externích konektorů (Supabase, Stripe…) |
| `ui_components` | Exportované UI komponenty (JSX/HTML) |
| `env_schema` | Schéma proměnných prostředí (bez hodnot!) |
| `workflow_definitions` | Definice automatizací a workflows |
| `prompt_library` | Knihovna promptů projektu |
| `test_cases` | Testovací případy a expectations |

---

## 3. Payload struktura

Každý typ obsahu je samostatná sekce v `payload[]`.

```json
{
  "payload": [

    {
      "type": "agent_config",
      "id": "agent_offer_generator",
      "label": "Agent pro generování nabídek nemovitostí",
      "version": "1.3.0",
      "compressed": true,
      "data": "BASE64_DEFLATE_ENCODED_STRING"
    },

    {
      "type": "knowledge_base",
      "id": "kb_realty_rules",
      "label": "Pravidla a FAQ pro realitní komunikaci",
      "version": "2.1.0",
      "compressed": false,
      "data": { ... }
    },

    {
      "type": "frontend_structure",
      "id": "frontend_main",
      "label": "Hlavní frontend struktura",
      "version": "4.2.1",
      "compressed": true,
      "data": "BASE64_DEFLATE_ENCODED_STRING"
    },

    {
      "type": "connector_config",
      "id": "connector_supabase",
      "label": "Supabase konfigurace",
      "version": "1.0.0",
      "compressed": false,
      "sensitive": false,
      "data": { ... }
    },

    {
      "type": "env_schema",
      "id": "env_production",
      "label": "Schéma produkčních proměnných",
      "note": "Pouze schéma — hodnoty nejsou součástí exportu!",
      "compressed": false,
      "data": { ... }
    }

  ]
}
```

---

## 4. Schéma jednotlivých typů

### `agent_config`

```json
{
  "type": "agent_config",
  "id": "agent_offer_generator",
  "label": "Agent pro generování nabídek nemovitostí",
  "version": "1.3.0",
  "compressed": false,
  "data": {
    "model": "claude-sonnet-4-5",
    "provider": "anthropic",
    "system_prompt": "Jsi expert na realitní komunikaci...",
    "temperature": 0.7,
    "max_tokens": 2000,
    "tools": [
      {
        "name": "get_property_details",
        "description": "Načte detail nemovitosti z IS",
        "endpoint": "{{IS_BASE_URL}}/api/properties/{id}",
        "auth": "bearer_token"
      },
      {
        "name": "send_polydoc_mail",
        "description": "Odešle PolyDoc mail klientovi",
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
  "label": "Pravidla pro realitní komunikaci",
  "version": "2.1.0",
  "compressed": false,
  "data": {
    "format": "structured",
    "language": "cs",
    "sections": [
      {
        "id": "tone_rules",
        "title": "Tón komunikace",
        "type": "rules",
        "items": [
          "Vždy oslovovat jménem, nikdy 'vážený zákazníku'",
          "Ceny uvádět vždy s DPH v CZK",
          "Nabídky personalizovat — zmínit proč zrovna tato nemovitost"
        ]
      },
      {
        "id": "faq",
        "title": "Časté dotazy",
        "type": "qa_pairs",
        "items": [
          {
            "q": "Jak dlouho trvá rezervace?",
            "a": "Rezervace je platná 14 dní od podpisu rezervační smlouvy."
          }
        ]
      },
      {
        "id": "examples",
        "title": "Příklady dobrých nabídek",
        "type": "examples",
        "items": [
          {
            "label": "Dobrý úvod nabídky",
            "text": "Na základě vašich požadavků z naší schůzky jsem pro vás vybral/a..."
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
  "label": "Hlavní frontend",
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
  "label": "Backend API struktura",
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
        "description": "Seznam nemovitostí",
        "params": ["page", "limit", "filter"],
        "response": "PropertyList"
      },
      {
        "method": "POST",
        "path": "/messages/send",
        "description": "Odeslání PolyDoc zprávy",
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
  "label": "Supabase — hlavní databáze",
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
  "label": "Produkční proměnné prostředí",
  "note": "POUZE SCHÉMA — žádné skutečné hodnoty!",
  "compressed": false,
  "data": {
    "variables": [
      {
        "key": "SUPABASE_URL",
        "type": "url",
        "required": true,
        "description": "URL Supabase projektu",
        "example": "https://xxx.supabase.co",
        "group": "database"
      },
      {
        "key": "ANTHROPIC_API_KEY",
        "type": "secret",
        "required": true,
        "description": "API klíč pro Claude",
        "example": "sk-ant-...",
        "group": "ai"
      },
      {
        "key": "IS_BASE_URL",
        "type": "url",
        "required": true,
        "description": "Base URL interního IS",
        "example": "https://app.realportal.cz",
        "group": "app"
      }
    ],
    "groups": ["database", "ai", "app", "email", "storage", "payments"]
  }
}
```

---

## 5. Komprese (DEFLATE)

Velká data (frontend struktury, knowledge base s příklady) lze komprimovat.

### Pravidlo: kdy komprimovat

| Velikost nekomprimovaných dat | Akce |
|-------------------------------|------|
| < 10 KB | Ponech jako čitelný JSON (`compressed: false`) |
| 10 KB – 100 KB | Doporučena komprese |
| > 100 KB | Komprese povinná |

### Implementace komprese

**Komprese (Node.js, při exportu):**
```javascript
import { deflateSync } from 'zlib';

function compressPayloadItem(data) {
  const json = JSON.stringify(data);
  const compressed = deflateSync(Buffer.from(json, 'utf8'), { level: 9 });
  return compressed.toString('base64');
}
```

**Dekomprese (Node.js, při importu):**
```javascript
import { inflateSync } from 'zlib';

function decompressPayloadItem(base64Data) {
  const compressed = Buffer.from(base64Data, 'base64');
  const decompressed = inflateSync(compressed);
  return JSON.parse(decompressed.toString('utf8'));
}
```

**Dekomprese (prohlížeč, DecompressionStream API):**
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

## 6. Verzování a diff

Každý snapshot nese referenci na předchozí verzi.
Diff lze vypočítat na základě `snapshot_id` řetězce.

```json
{
  "version": {
    "project": "2.4.1",
    "snapshot_id": "snap_20260312_0800",
    "previous_snapshot": "snap_20260305_1430",
    "changelog": "Přidány konektory Supabase + Resend.",
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

## 7. Podpis a integrita

Payload hash zajistí, že nikdo data po exportu neupravil.

```javascript
// Výpočet payload_hash (před podpisem)
import { createHash } from 'crypto';

function computePayloadHash(payload) {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return 'sha256:' + createHash('sha256').update(canonical).digest('hex');
}

// ES256 podpis hlavičky + hash
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
  return jwt; // uloží se do header.signature.value
}

// Ověření (při importu)
import { jwtVerify, importSPKI } from 'jose';

async function verifyTransferDoc(doc) {
  const publicKey = await importSPKI(doc.header.signature.public_key, 'ES256');
  const { payload } = await jwtVerify(doc.header.signature.value, publicKey);

  // Ověř hash payloadu
  const computedHash = computePayloadHash(doc.payload);
  if (computedHash !== payload.payload_hash) {
    throw new Error('Payload hash nesedí — data byla pozměněna!');
  }
  return true;
}
```

---

## 8. Viewer v prohlížeči

Protože je to stále HTML, viewer zobrazí obsah přenosového souboru.

```
┌─────────────────────────────────────────────────────────┐
│  [POLY]  RealPortal v2 — Sprint 4 snapshot              │
│  Exportováno: 12. 3. 2026  ·  Zdroj: Lovable           │
│  ✅ Podpis ověřen  ·  47 položek  ·  91 KB              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📦 Obsah tohoto souboru                                │
│                                                         │
│  🤖 Agenti (2)                                          │
│     agent_offer_generator v1.3.0                        │
│     agent_client_support  v0.9.1                        │
│                                                         │
│  🧠 Znalostní báze (1)                                  │
│     kb_realty_rules v2.1.0                              │
│                                                         │
│  🎨 Frontend (1)                                        │
│     frontend_main v4.2.1 · React · 284 KB → 91 KB      │
│                                                         │
│  ⚙️  Backend (1)                                        │
│     backend_main v3.1.0 · Node/Express                  │
│                                                         │
│  🔌 Konektory (3)                                       │
│     Supabase, Resend, Stripe                            │
│                                                         │
│  🔑 ENV schéma (1)                                      │
│     12 proměnných · skupiny: database, ai, app          │
│                                                         │
│  ─────────────────────────────────────────────────     │
│  Změny oproti snap_20260305_1430:                       │
│  + connector_supabase  + connector_resend               │
│  ~ agent_offer_generator (upraveno)                     │
│                                                         │
│  [⬇ Stáhnout JSON]  [🔏 Ověřit podpis]  [📋 Kopírovat] │
└─────────────────────────────────────────────────────────┘
```

---

## 9. Import do cílového systému

### Lovable
```javascript
// Lovable Import API (pseudo-kód)
const transfer = await PolyDocTransfer.load('projekt-snapshot.html');
await transfer.verify(); // ověř podpis
await lovable.importProject({
  agentConfigs:   transfer.getByType('agent_config'),
  knowledgeBases: transfer.getByType('knowledge_base'),
  frontend:       transfer.getByType('frontend_structure'),
  connectors:     transfer.getByType('connector_config'),
});
```

### Cursor / VS Code
```javascript
// .polydoc-import.js v kořenu projektu
import { PolyDocTransfer } from '@polydoc/transfer';

const t = await PolyDocTransfer.load('./handoff.html');
await t.verify();
await t.extractTo('./src', { types: ['frontend_structure', 'backend_structure'] });
await t.writeEnvSchema('./.env.example');
```

### Interní IS (PHP)
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

## 10. Bezpečnostní pravidla

- **`env_schema` NIKDY neobsahuje skutečné hodnoty** — pouze klíče, typy, popisy
- **`connector_config`** — ukládá konfiguraci (URL, tabulky, nastavení), ne API klíče
- Citlivé payload položky lze šifrovat stejným mechanismem jako PolyDoc dokumenty (AES-GCM, klíč mimo soubor)
- Podpis ověřuje integritu — zajistí, že soubor nebyl upraven po exportu
- Před importem vždy ověřit podpis — `transfer.verify()` jako první krok

---

## 11. Kompatibilita s nástroji

| Nástroj | Stav | Poznámka |
|---------|------|----------|
| Lovable | Plánováno | Export/Import via API |
| Cursor | Plánováno | VS Code extension |
| Claude Code | Plánováno | Nativní čtení z #raw-data |
| Vlastní IS (PHP/Node) | Hotovo | Viz implementace výše |
| n8n / Make | Plánováno | HTTP node + JSON parse |
| Zapier | Plánováno | Webhook trigger |

---

*PolyDoc Transfer Format v1.0 · MIT licence · 2026-03-12*
