# PolyDoc — Envelope formát

> **Motto:** Kryptografická zásilka. Hlavička čitelná vždy. Obsah otevřeš jen ty.

---

## §1 Co je Envelope

Envelope (`doc_type: "envelope"`) je speciální typ PolyDoc dokumentu, který slouží jako **kryptografická obálka** pro libovolný obsah — dokumenty, soubory, data, jiné PolyDoc soubory.

### Obálka vs. dokument

| Vlastnost | Dokument (`invoice`, `contract`, …) | Obálka (`envelope`) |
|-----------|--------------------------------------|----------------------|
| Vizuální sekce (`content.sections`) | Ano — renderuje se jako dokument | Ne — obálka nemá vizuální sekce |
| Části (`parts[]`) | Ne | Ano — libovolný počet, libovolné typy |
| Příjemci | Není relevantní | `manifest.recipients[]` s anonymními hinty |
| Podpis | Pokrývá celý dokument | Pokrývá manifest (hash každé části) |
| Mail část | Volitelná | `mail_part` — vždy statické HTML shrnutí |

**Klíčová vlastnost:** hlavička a manifest jsou **vždy čitelné bez klíče**. Obsah jednotlivých částí je volitelně šifrovaný, komprimovaný nebo lazy-načítaný.

Obálka umožňuje příjemci:
- Potvrdit, že zásilku obdržel (ověřením podpisu manifestu) — **bez znalosti obsahu**
- Vidět, co obálka obsahuje (popis částí, typy, velikosti) — bez otevření
- Otevřít pouze ty části, ke kterým má klíč

---

## §2 Struktura JSON

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
      "note": "Podpis pokrývá manifest (hash každé části), ne obsah — lze potvrdit bez otevření"
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
    "data": "staticke HTML pro mail verzi — bez JS, jen info + CTA odkaz"
  }
}
```

### Povinná pole

| Pole | Povinné | Popis |
|------|---------|-------|
| `header.format` | Ano | `"poly/1.0"` |
| `header.doc_id` | Ano | Unikátní ID obálky (doporučený prefix `ENV-`) |
| `header.doc_type` | Ano | Musí být `"envelope"` |
| `header.created` | Ano | ISO 8601 timestamp |
| `manifest.parts[]` | Ano | Alespoň jedna část |
| `manifest.parts[].id` | Ano | Unikátní ID části v rámci obálky |
| `manifest.parts[].type` | Ano | MIME typ obsahu |

### Volitelná pole

| Pole | Popis |
|------|-------|
| `header.signature` | Kryptografický podpis manifestu |
| `manifest.label` | Lidsky čitelný název zásilky |
| `manifest.sender` | Hint veřejného klíče odesílatele |
| `manifest.recipients[]` | Anonymní příjemci s hinty klíčů |
| `parts[]` | Inline obsah — může chybět pokud jsou části lazy |
| `mail_part` | Statická HTML verze pro email |

---

## §3 Potvrzení bez znalosti obsahu

Podpis v `header.signature` pokrývá **manifest** — konkrétně hash každé části v `manifest.parts[].hash`, nikoliv obsah samotný.

Díky tomu může příjemce:
1. Přečíst manifest (vždy nešifrovaný)
2. Ověřit podpis manifestu (ES256 přes WebCrypto API)
3. **Potvrdit příjem zásilky** odesílateli — bez toho, aby otevřel jedinou část

Toto je klíčová vlastnost pro auditní scénáře: potvrzení doručení je kryptograficky prokazatelné bez odhalení obsahu.

### Postup ověření

```
1. Načti manifest z obálky (vždy plaintext JSON)
2. Serializuj manifest.parts[] jako kanonické JSON (sorted keys)
3. Ověř ES256 podpis v header.signature.value
   použij veřejný klíč odesílatele (z manifest.sender nebo out-of-band)
4. Pokud podpis platí → zásilka nebyla modifikována od podpisu
5. Odpověz odesílateli hash(manifest) jako potvrzení — bez obsahu
```

---

## §4 Anonymní příjemci

```json
"recipients": [
  { "key_hint": "sha256:abc123...", "parts": ["contract"] },
  { "key_hint": "sha256:def456...", "parts": ["invoice", "contract"] }
]
```

`key_hint` = `SHA256(recipient_public_key)` — otisk veřejného klíče příjemce.

**Server nikdy nezná identitu příjemce.** Zná pouze otisky klíčů. Pouze skutečný příjemce dokáže:
- Spočítat otisk svého vlastního veřejného klíče
- Porovnat s `key_hint` v manifestu
- Zjistit, které části jsou pro něj určeny

Odesílatel zašifruje každou část pro konkrétní příjemce pomocí jejich veřejných klíčů (asymetrické šifrování obálky symetrického AES klíče — hybrid encryption pattern).

### Proč otisk, ne celý klíč?

Celý veřejný klíč by byl identifikátorem — například e-mailová adresa v certifikátu by prozradila identitu. SHA256 otisk je nepřiřaditelný bez znalosti samotného klíče.

---

## §5 Částečné otevření

Obálka podporuje **tři vrstvy přístupu**, které lze libovolně kombinovat:

### mail_part — vždy čitelné

`mail_part` je statické HTML bez JS. Renderuje se automaticky jako banner nad manifestem. Obsahuje jen základní informaci: "Obdrželi jste zásilku s N přílohami" + CTA odkaz na interaktivní verzi.

```json
"mail_part": {
  "type": "text/html",
  "label": { "cs": "Obdrželi jste zabezpečenou zásilku" },
  "data": "<p>Obdrželi jste zásilku se 3 přílohami...</p><a href='...'>Otevřít</a>"
}
```

### Manifest — vždy čitelný (bez klíče)

Interpreter vždy zobrazí manifest: seznam částí s popisem, typy, velikostmi a ikonami. Příjemce vidí, **co** obálka obsahuje, i bez klíče.

### Části — volitelně šifrované nebo lazy

Každá část v `parts[]` může mít jiný přístupový režim:

| Stav části | Chování interpreteru |
|-----------|----------------------|
| `encrypted: false, lazy: false` | Zobrazí tlačítko "Otevřít" — okamžitý přístup |
| `encrypted: true` | Zobrazí pole pro zadání klíče nebo derivaci z URL fragmentu |
| `lazy: true` | Zobrazí tlačítko "Načíst" — fetch na `src` při kliknutí |
| `encrypted: true, lazy: true` | Lazy fetch + dešifrování po zadání klíče |

---

## §6 Multi-recipient

Jedna obálka může mít více příjemců, každý s přístupem k jiné podmnožině částí:

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

**Vzor:** Hybrid encryption — AES-256-GCM klíč části je zašifrován RSA-OAEP veřejným klíčem každého oprávněného příjemce zvlášť. Obsah samotný je zašifrován jen jednou (AES).

Příjemce Alice:
1. Najde svůj `key_hint` v `recipients[]`
2. Dešifruje `encrypted_keys.invoice` svým soukromým klíčem → získá AES klíč
3. Dešifruje část `invoice` tímto AES klíčem

Příjemce Bob získá AES klíče pro obě části a může otevřít obě.

---

## §7 Podporované typy obsahu (`parts[].type`)

| MIME typ | Popis | Interpreter chování |
|----------|-------|---------------------|
| `text/markdown` | Markdown text | Renderuje jako HTML (simple regex) |
| `text/html` | HTML obsah | Sandboxovaný `<iframe>` |
| `text/plain` | Prostý text | `<pre>` blok |
| `application/json` | JSON data | Syntax-highlighted code block |
| `application/pdf` | PDF dokument | Nabídne stažení nebo inline viewer |
| `application/zip` | ZIP archiv | Nabídne stažení |
| `application/polydoc` | Vnořený PolyDoc | Renderuje rekurzivně v iframe |
| `image/png` | PNG obrázek | `<img>` tag |
| `image/jpeg` | JPEG obrázek | `<img>` tag |
| `image/svg+xml` | SVG obrázek | `<img>` tag (sanitizovaný) |
| Libovolný MIME | Jakýkoliv obsah | Nabídne stažení jako soubor |

Obálka není omezena na výše uvedené typy — akceptuje **libovolný MIME typ**. Neznámé typy interpreter nabídne ke stažení.

---

## §8 Interpreter chování

### Zobrazení manifestu

Interpreter při otevření obálky vždy zobrazí:

```
[Název zásilky z manifest.label]
[mail_part banner — pokud existuje]

Části zásilky:
  📄 Faktura        text/markdown  2.4 KB  [Otevřít]
  🔒 Smlouva        application/pdf  44 KB  [Zadejte klíč]  [compressed]
  ⏳ Náhled         text/html  —  [Načíst]
```

### Ikony dle MIME typu

| Typ | Ikona |
|-----|-------|
| `text/markdown` | 📄 |
| `application/json` | 📋 |
| `image/*` | 🖼️ |
| `application/zip` | 📦 |
| `application/polydoc` | 📎 |
| Šifrovaná část | 🔒 |
| Lazy část (ještě nenačtena) | ⏳ |
| Ostatní | 📁 |

### Otevření části

```
Klik "Otevřít":
  compressed: true  → dekompresi base64(deflate(data)) → zobrazit
  compressed: false → zobrazit data přímo

Klik "Načíst" (lazy):
  lazy_mode: on-demand  → fetch(src) → zobrazit, nezapamatovat
  lazy_mode: inline     → fetch(src) → zobrazit, uložit do parts[]

Klik "Zadejte klíč" (encrypted):
  → zobrazit input field
  → uživatel zadá klíč (nebo derivace z URL fragmentu)
  → WebCrypto AES-GCM decrypt → zobrazit
```

### Modal pro obsah

Každá otevřená část se zobrazí v modálním okně:

| Typ obsahu | Způsob renderování |
|-----------|-------------------|
| `text/markdown` | Jednoduchý regex rendering (nadpisy, tučné, seznamy, kód) |
| `text/html` | `<iframe sandbox="allow-scripts">` |
| `application/json` | Syntax-highlighted `<pre>` |
| `image/*` | `<img>` tag, plná šířka |
| Ostatní | Tlačítko "Stáhnout jako soubor" |

---

## §9 Příklady použití

### Notářský balík
Smlouva + faktura + přílohy v jedné zásilce. Klient potvrdí příjem ověřením podpisu manifestu (bez otevření obsahu). Notář otevře zásilku svým klíčem.

```
manifest.parts: [smlouva (PDF, encrypted), faktura (Markdown), přílohy (ZIP)]
recipients: [klient, notář, archiv]
```

### AI agent → uživatel
Agent vrátí výsledky analýzy ve více formátech (JSON data, Markdown report, vizualizace jako HTML). Uživatel otevře preferovaný formát.

```
manifest.parts: [analysis.json, report.md, chart.html]
encrypted: false (ale komprimované)
```

### Secure data room
Due diligence balík pro M&A transakci. Každý účastník (buyer, auditor, právník) má přístup jen ke svým částem.

```
manifest.parts: [financial-model.xlsx, legal-docs.zip, tech-audit.pdf]
recipients: [buyer, auditor, legal]
každý recipient: jiná podmnožina parts[]
```

### Transfer mezi systémy
Jako transfer format (viz `POLYDOC_TRANSFER.md`), ale s kryptografickým podpisem a volitelným šifrováním. Vhodné pro: předání projektu mezi týmy, bezpečný archiv, přenos přes nedůvěryhodný kanál.

```
manifest.parts: [config.json (polydoc/transfer), knowledge-base.md, assets.zip]
signature: ES256 (pokrývá manifest)
```

---

## §10 Slots — kolaborativní vyplňování

**Slot** je část obálky, kterou odesílatel definoval ale záměrně nevyplnil. Označuje kdo ji má vyplnit, jakým způsobem a kdy.

### Definice slotu v manifest.parts

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

Slot s on-demand nebo plánovaným obnovením:

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

### Pole slotu

| Pole | Povinné | Popis |
|------|---------|-------|
| `slot` | Ano | `true` — označuje část jako slot čekající na vyplnění |
| `assigned_to.key_hint` | Ne | SHA256 otisk klíče příjemce zodpovědného za vyplnění |
| `workspace_hint` | Ne | Doporučený název souboru pro propojení s workspace |
| `fill.mode` | Ano | `manual` / `on-demand` / `scheduled` |
| `fill.src` | Ne | URL pro automatické načtení obsahu |
| `fill.schedule` | Ne | Cron výraz pro plánované obnovení |

### Stav slotu

Každý slot v `manifest.parts` může mít stav:

| Stav | Popis |
|------|-------|
| `empty` | Slot definován, nevyplněn (výchozí) |
| `filled` | Část vyplněna, dostupná v `parts[]` |
| `linked` | Propojeno s workspace nebo URL, čeká na pull |
| `stale` | `hash_at_fill` neodpovídá aktuálnímu obsahu `fill.src` |

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

Příjemce může propojit slot s lokálním souborem ve svém workspace:

```json
"fill": {
  "mode": "on-demand",
  "src": "workspace://docker-compose.yml"
}
```

`workspace://` schéma resolvuje nástroj (VS Code extension, CLI) na skutečnou cestu v otevřeném projektu. Při fill operaci:
1. Přečte aktuální obsah souboru
2. Spočítá hash
3. Vloží do `parts[]` jako běžnou část
4. Aktualizuje `slot_state` na `filled` + `filled_at` timestamp

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

Server přidá část do `parts[]`, aktualizuje `manifest.parts[].slot_state` a vygeneruje novou verzi HTML.

### Životní cyklus kolaborativní obálky

```
Odesílatel (architekt):
  → vytvoří obálku se sloty
  → vyplní své části (embedded)
  → sloty přiřadí příjemcům (key_hint)
  → pošle e-mailem nebo nahraje na sdílené URL

Příjemce (ops team):
  → otevře v prohlížeči nebo VS Code
  → vidí: "VAŠE ČÁSTI K VYPLNĚNÍ"
  → propojí workspace:// nebo zadá data ručně
  → klikne [Naplnit] → část se vloží do obálky
  → volitelně podepíše svůj příspěvek

CI pipeline:
  → POST /envelope/{id}/fill po každém buildu
  → slot test-results se aktualizuje automaticky

Sdílená URL:
  → kdokoli otevře → vidí aktuální stav všech částí
  → scheduled sloty se obnovují dle cron plánu
  → každý vidí jen části ke kterým má klíč
```

### Příklady použití

**Deployment balík:**
```
Architekt:  INSTALL.md (embedded) + agent-config.json (embedded)
Ops team:   docker-compose.yml (slot → workspace://) + .env.prod (slot → encrypted)
CI:         test-results.json (slot → scheduled, každý build)
```

**Due diligence (M&A):**
```
Prodávající: financial-model.xlsx (embedded, encrypted) + info-memo.pdf (embedded)
Kupující:    nda-signed.pdf (slot → manual fill) + term-sheet.docx (slot → manual fill)
Právník:     review-notes.md (slot → on-demand, workspace://)
```

**Předání projektu:**
```
Lovable/Cursor: frontend.zip (embedded) + schema.sql (embedded)
Nový tým:       env-vars.json (slot → fill dle svého prostředí)
Zákazník:       branding.zip (slot → fill jejich assety)
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
