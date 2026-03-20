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

*PolyDoc Envelope v1.0 · MIT licence · 2026-03-20*
