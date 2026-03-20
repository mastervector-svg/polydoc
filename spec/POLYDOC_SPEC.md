# PolyDoc — Specifikace formátu v1.0

> **Motto:** Jeden soubor. Strojová data. Lidsky čitelný dokument. Funguje v prohlížeči i mailu.

---

## 1. Co je PolyDoc?

PolyDoc je otevřený dokumentový formát postavený na standardním HTML souboru.
Uvnitř nese strukturovaná JSON data (obsah, metadata, logiku) a JavaScript interpreter,
který z těchto dat v prohlížeči vyrendruje dokument.

**Soubor má jedinou příponu: `.html`**
Značka/brand formátu je **Poly** (`format: "poly/1.0"` v JSON hlavičce).

### Proč ne PDF, DOCX nebo čistý JSON?

| Formát | Problém |
|--------|---------|
| PDF | Statický, strojově nečitelný, drahé generování |
| DOCX | Binární XML balast, proprietární závislosti |
| Čistý JSON | Nelze otevřít přímo, potřebuje viewer |
| **PolyDoc** | ✅ Jedno HTML, funguje všude, data uvnitř, AI-čitelný |

### AI-friendly výhoda

LLM nebo RPA bot si přečte JSON přímo ze source dokumentu — žádný parsing PDF,
žádné OCR. Zákazníkův účetní systém stáhne fakturu automaticky.

---

## 2. Dva módy dokumentu

```
[IS / backend]
      ↓ generuje ze stejných JSON dat
      ├── polydoc-mail.html    Statické HTML, nulový JS, do těla mailu
      │                        < 50 KB, projde každou zdí
      │                        CTA tlačítko → odkaz na full verzi
      │
      └── polydoc-full.html    Plný interpreter, živý stav z API
                               Interaktivní tlačítka, podpis, tisk
                               Hostováno na serveru nebo ke stažení
```

---

## 3. Architektura souboru

```
dokument.html
│
├── <script type="application/poly+json" id="raw-data">
│     └── JSON dokument (data, metadata, logika, vizuály)
│
├── <script>  ← Poly Interpreter (inline nebo z CDN v budoucnu)
│     └── Načte JSON → validuje → renderuje → spustí logiku
│
└── <style>
      └── CSS (tisk, responzivita, témata)
```

### Pravidla struktury

1. JSON **musí** být v tagu `<script type="application/poly+json" id="raw-data">`
2. Prohlížeč tag ignoruje (nespustí), JS ho přečte jako text
3. Full verze: interpreter inline v souboru
4. Mail verze: žádný JS, staticky vyrendrovaný obsah
5. Soubor musí být validní HTML5

---

## 4. JSON schéma (Poly v1.0)

```json
{
  "header": {
    "format": "poly/1.0",
    "spec": "https://github.com/polydoc/spec/blob/main/v1.0.md",
    "doc_id": "INV-2026-001",
    "doc_type": "invoice",
    "created": "2026-03-12T08:00:00Z",
    "generator": "MyEngine v1.0",
    "signature": {
      "algorithm": "ES256",
      "value": "MEUCIQD...",
      "public_key": "-----BEGIN PUBLIC KEY-----..."
    }
  },

  "metadata": {
    "title": "Faktura za konzultace",
    "language": "cs",
    "author": "Jan Novák",
    "tags": ["faktura", "2026"],
    "custom_fields": {
      "vs": "123456",
      "ks": "0308",
      "due_date": "2026-04-10"
    }
  },

  "content": {
    "type": "document",
    "sections": []
  },

  "visuals": {
    "theme": "modern-clean",
    "page_size": "A4",
    "font": "Inter",
    "colors": {
      "primary": "#0d6efd",
      "accent": "#ffc107"
    }
  },

  "logic": {
    "dynamic": [
      {
        "trigger": "onLoad",
        "action": "fetchStatus",
        "api_url": "https://api.example.cz/doc/INV-2026-001/status",
        "target_field": "is_paid"
      }
    ],
    "conditions": [
      {
        "field": "is_paid",
        "value": true,
        "banner": { "text": "✅ ZAPLACENO", "style": "success" }
      },
      {
        "field": "is_paid",
        "value": false,
        "banner": { "text": "⏳ Čeká na platbu", "style": "warning" }
      }
    ],
    "actions": [
      {
        "label": "✅ Potvrdit objednávku",
        "api_url": "https://api.example.cz/doc/INV-2026-001/confirm",
        "method": "POST",
        "success_message": "Děkujeme za potvrzení!"
      }
    ]
  }
}
```

---

## 5. Typy sekcí (`content.sections[].type`)

| Typ | Popis | Povinná pole |
|-----|-------|-------------|
| `header` | Záhlaví dokumentu | `elements[]` |
| `party` | Účastník dokumentu | `role`, `data` |
| `table` | Tabulka s volitelným footrem | `columns[]`, `rows[]` |
| `image` | Obrázek | `src`, `alt` |
| `rich_text` | HTML blok (sanitizovat!) | `html` |
| `checklist` | Seznam s checkboxy | `items[]` |
| `paragraph` | Textový odstavec | `text` |
| `divider` | Horizontální oddělovač | — |
| `signature_block` | Pole pro podpis | `label` |
| `custom` | Libovolný blok | `data` |

### Sekce: `header`
```json
{
  "type": "header",
  "elements": [
    { "type": "heading", "level": 1, "text": "Faktura" },
    { "type": "paragraph", "text": "Vystaveno: 12. 3. 2026" }
  ]
}
```

### Sekce: `party`
```json
{
  "type": "party",
  "role": "supplier",
  "data": {
    "name": "Jan Novák s.r.o.",
    "id": "CZ87654321",
    "address": "Příkop 4, 602 00 Brno",
    "bank": "CZ6508000000192000145399",
    "email": "info@example.cz"
  }
}
```
Role: `supplier` | `client` | `guarantor` | `agent`

### Sekce: `table`
```json
{
  "type": "table",
  "id": "items",
  "columns": ["Popis", "Množství", "Jedn. cena", "Celkem"],
  "rows": [
    ["Konzultace", 5, 2000, 10000]
  ],
  "footer": {
    "total": 10000,
    "currency": "CZK",
    "vat_rate": 21
  }
}
```

### Sekce: `image`
```json
{
  "type": "image",
  "src": "data:image/png;base64,...",
  "alt": "Logo firmy",
  "width": "200px",
  "caption": "Popisek"
}
```
`src` může být base64 (< 50 KB doporučeno) nebo HTTPS URL.

### Sekce: `checklist`
```json
{
  "type": "checklist",
  "items": [
    { "text": "Podepsáno", "checked": true },
    { "text": "Zaplaceno", "checked": false }
  ]
}
```

---

## 6. Bezpečnost

### XSS prevence
- `rich_text.html` **musí** být sanitizován (DOMPurify client-side nebo server-side)
- Nikdy nevkládat raw HTML z nevalidovaného vstupu
- `image.src` — nikdy nepovolovat `javascript:` nebo `data:text/html` schéma

### Integrita dokumentu
- `header.signature` obsahuje ES256 podpis celého JSON objektu (bez pole `signature`)
- Ověření přes WebCrypto API (SubtleCrypto) v prohlížeči
- Doporučeno pro: faktury, smlouvy, úřední dokumenty

### Obrázky
- Base64 inline — vhodné pro loga < 50 KB
- URL reference — pro větší obrázky, musí být HTTPS

---

## 7. Vizuální témata (`visuals.theme`)

| Hodnota | Popis |
|---------|-------|
| `modern-clean` | Bílé pozadí, modrý accent, čistá typografie |
| `modern-dark` | Tmavé pozadí, neonové akcenty |
| `classic` | Serif fonty, konzervativní layout |
| `minimal` | Maximální bílý prostor, minimální barvy |

Barvy lze přepsat přes `visuals.colors.primary` a `visuals.colors.accent`.

---

## 8. Logic sekce

### `logic.dynamic` — live fetch
```json
{
  "trigger": "onLoad",
  "action": "fetchStatus",
  "api_url": "https://api.example.cz/doc/{doc_id}/status",
  "target_field": "is_paid"
}
```
Interpreter nahradí `{doc_id}` hodnotou z `header.doc_id`.

### `logic.conditions` — podmíněné bannery
```json
{
  "field": "is_paid",
  "value": true,
  "banner": { "text": "✅ ZAPLACENO", "style": "success" }
}
```
Styly banneru: `success` | `warning` | `danger` | `info`

### `logic.actions` — akční tlačítka
```json
{
  "label": "✅ Potvrdit objednávku",
  "api_url": "https://api.example.cz/doc/{doc_id}/confirm",
  "method": "POST",
  "success_message": "Děkujeme!"
}
```

---

## 9. Interpreter — veřejné API

```javascript
PolyDoc.init()            // inicializace (automaticky na DOMContentLoaded)
PolyDoc.render()          // znovu vyrendrovat dokument
PolyDoc.verify()          // ověřit digitální podpis
PolyDoc.exportJSON()      // stáhnout čistý JSON
PolyDoc.getDoc()          // vrátí parsed JSON objekt (pro integraci)
```

---

## 10. Mail verze — pravidla

Mail verze je staticky vyrendrovaná kopie bez JS.

**Musí:**
- Být validní HTML email (tabulkový layout pro Outlook kompatibilitu)
- Obsahovat CTA tlačítko s odkazem na full verzi
- Mít inline CSS (žádné `<style>` bloky — Gmail je stripuje)
- Zobrazit klíčové informace bez JS (číslo, částka, splatnost, strany)
- Obsahovat `<script type="application/poly+json">` s daty (pro AI parsery)

**Nesmí:**
- Obsahovat žádný `<script>` s kódem
- Používat externí CSS soubory
- Spoléhat na webfonty (fallback na system fonts)

---

## 11. Komprese — selektivní DEFLATE na úrovni sekce

Komprese v PolyDocu je **per-sekce vlastnost**, ne globální mód dokumentu.
Hlavička, metadata, souhrny a malé bloky zůstávají čitelné jako JSON.
Velké bloky (obrázky v base64, knowledge base, přílohy, velké tabulky) se komprimují inline.

Kouzlo je v tom, že dokument zůstává inspektovatelný pouhým pohledem — vidíš hlavičku,
strany, částky — ale velká data jsou úsporně uložena vedle nich ve stejném souboru.

### Globální nastavení v hlavičce (hint pro generátory)

```json
{
  "header": {
    "format": "poly/1.0",
    "doc_id": "INV-2026-001",
    "compression": {
      "algorithm": "deflate",
      "threshold": 10240
    }
  }
}
```

`threshold` říká generátoru: *"pole, jejichž serializovaná velikost překročí tento počet bajtů, zkomprimuj automaticky"*. Výchozí hodnota je **10 240 B (10 KB)**. Hlavička a malé sekce se nikdy nekomprimují.

### Jak vypadá komprimovaná sekce

Jakákoliv sekce v `content.sections` nebo položka v transfer payloadu může nést komprimovaná data:

```json
{
  "type": "image",
  "alt": "Fotografie nemovitosti",
  "compressed": true,
  "data": "eJyNkstqwzAQRff...",
  "original_size": 52480,
  "compressed_size": 9120
}
```

```json
{
  "type": "knowledge_base",
  "id": "kb-main",
  "title": "Znalostní báze projektu",
  "compressed": true,
  "data": "eJyVkMtqwzAQRff...",
  "original_size": 145000,
  "compressed_size": 28300
}
```

Nekomprimovaná sekce přitom vypadá normálně — `compressed` pole chybí nebo je `false`:

```json
{
  "type": "party",
  "role": "supplier",
  "data": { "name": "Jan Novák s.r.o.", "address": "Brno" }
}
```

### Pravidla

| Pravidlo | Hodnota |
|----------|---------|
| Algoritmus | DEFLATE (RFC 1951) |
| Kódování | Base64 |
| Výchozí threshold | 10 240 B |
| Příznak | `"compressed": true` na sekci/položce |
| Obsah | `"data": base64(deflate(JSON.stringify(original_data)))` |
| Metadata | `"original_size"`, `"compressed_size"` (volitelné, pro debugování) |
| Co se nikdy nekomprimuje | `header`, `metadata`, souhrny, `footer` tabulky |

Decompress (Node.js): `JSON.parse(inflateSync(Buffer.from(data, 'base64')).toString('utf-8'))`
Decompress (browser): `DecompressionStream('deflate')` + `TextDecoder`

---

## 12. Šifrování (`header.encryption`)

PolyDoc podporuje fragment-key šifrování pro citlivé dokumenty. Klíč je součástí URL fragmentu (`#`) — ten se nikdy neposílá na server.

### Formát v hlavičce

```json
{
  "header": {
    "format": "poly/1.0",
    "doc_id": "CONTRACT-2026-001",
    "doc_type": "contract",
    "encryption": {
      "algorithm": "AES-256-GCM",
      "key_location": "url_fragment",
      "iv": "base64-encoded-iv"
    }
  }
}
```

### Jak to funguje

```
Server vygeneruje AES-256-GCM klíč
  ↓
Zašifruje obsah dokumentu (content, logic, metadata)
  ↓
Uloží zašifrovaný dokument na server
  ↓
Vrátí URL: https://example.cz/doc/CONTRACT-001.html#key=<base64-key>
  ↓
Prohlížeč přečte klíč z fragmentu (fragment se NIKDY neposílá na server)
  ↓
WebCrypto API (SubtleCrypto) dešifruje obsah přímo v prohlížeči
```

### Access modes

| Mode | Popis |
|------|-------|
| `public` | Bez omezení — výchozí |
| `token` | Vyžaduje Bearer token pro načtení full verze |
| `encrypted` | AES-256-GCM, klíč v URL fragmentu |

```json
{
  "header": {
    "access": {
      "mode": "encrypted",
      "hint": "Odkaz s klíčem obdržíte e-mailem"
    }
  }
}
```

---

## 13. Lazy load — selektivní načítání sekcí

Lazy load je stejně jako komprese **per-sekce vlastnost**, nezávislá na formátu výstupu.
Sekce s `"lazy": true` se při prvním renderu nevykreslí — místo nich se zobrazí placeholder.
Obsah se načte až na vyžádání (scroll do view nebo klik).

### Dva módy lazy load

#### `"lazy_mode": "on-demand"` (výchozí)
Data se **vždy táhnou ze `src`** při každém vyžádání. Nikdy se nevkládají do dokumentu.
Vhodné pro: živý stav, smluvní podmínky (vždy aktuální verze), externí datasety.

```json
{
  "type": "rich_text",
  "lazy": true,
  "lazy_mode": "on-demand",
  "lazy_label": "Zobrazit smluvní podmínky...",
  "src": "https://api.example.cz/terms/v2"
}
```

#### `"lazy_mode": "inline"`
Data se **dotáhnou jednou** a vloží přímo do DOM (a mohou být uložena zpět do dokumentu).
Vhodné pro: velké obrázky, knowledge base, přílohy — obsah se chce mít offline.

```json
{
  "type": "image",
  "lazy": true,
  "lazy_mode": "inline",
  "src": "https://cdn.example.cz/foto-hd.jpg",
  "alt": "Fotografie nemovitosti — HD verze",
  "width": "100%"
}
```

Přepnutí módu = jeden parametr. Chování se změní, `src` zůstane stejný.

### Threshold pro automatický lazy load

V hlavičce lze definovat práh — sekce nad touto velikostí dostane `lazy: true` automaticky:

```json
{
  "header": {
    "lazy": {
      "threshold": 51200,
      "default_mode": "on-demand"
    }
  }
}
```

Výchozí threshold: **50 KB** (pro sekce bez explicitního `lazy` pole).
Generátor přidá `lazy: true` a `lazy_mode` podle `default_mode` automaticky při tvorbě dokumentu.

### Kombinace s kompresí

Lazy a komprese jsou na sobě nezávislé a lze je kombinovat:

```json
{
  "type": "knowledge_base",
  "lazy": true,
  "lazy_mode": "inline",
  "lazy_label": "Načíst znalostní bázi...",
  "src": "https://api.example.cz/kb/main",
  "compressed": true,
  "data": "eJyVkMtq...",
  "original_size": 145000,
  "compressed_size": 28300
}
```

Interpret nejdříve zdecomprimuje `data`, pak zobrazí obsah. `src` slouží jako fallback pokud `data` chybí.

### Pravidla

| Vlastnost | Popis | Výchozí |
|-----------|-------|---------|
| `lazy` | Aktivuje lazy load pro sekci | `false` |
| `lazy_mode` | `"on-demand"` nebo `"inline"` | `"on-demand"` |
| `lazy_label` | Text placeholderu | `"Načíst..."` |
| `src` | URL zdroje obsahu | — |
| `header.lazy.threshold` | Práh pro auto-lazy (bajty) | `51200` (50 KB) |
| `header.lazy.default_mode` | Výchozí mód pro auto-lazy | `"on-demand"` |

### Chování interpreteru

```
Render sekce:
  lazy: false  → vyrendruje okamžitě z dat v dokumentu
  lazy: true   → vyrendruje placeholder div, připne IntersectionObserver

Trigger (scroll do view nebo klik):
  lazy_mode: on-demand  → fetch(src) při každém zobrazení, nikdy neukládá
  lazy_mode: inline     → fetch(src) jednou, nahradí placeholder, data vloží do DOM
                          volitelně: updateDoc() uloží data zpět do raw-data JSON
```

**Mail verze:** `lazy: true` sekce se renderují jako statický placeholder text (`lazy_label`)
s odkazem na full verzi. JS není k dispozici — full verze obstará samotné načtení.

---

## 14. Roadmapa

### v1.0 (aktuální)
- [x] JSON schéma (header, metadata, content, visuals, logic)
- [x] Typy sekcí: header, party, table, image, rich_text, checklist, paragraph, divider
- [x] Full interpreter (inline, single-file)
- [x] Mail šablona (statická, bez JS)
- [x] Podmíněné bannery
- [x] Export JSON

### v1.1
- [ ] Sdílený interpreter na CDN (`poly-interpreter.js`)
- [ ] SubtleCrypto ověření podpisu
- [ ] Více vizuálních témat
- [ ] DOMPurify integrace pro rich_text

### v2.0
- [ ] Spec na GitHubu (`github.com/polydoc/spec`)
- [ ] JSON Schema validátor
- [ ] WYSIWYG editor v IS
- [ ] Offline-first (Service Worker)

---

## 15. GitHub & odkaz ve spec

```json
{
  "header": {
    "format": "poly/1.0",
    "spec": "https://github.com/polydoc/spec/blob/main/v1.0.md"
  }
}
```

Odkaz na spec je součástí každého dokumentu — samodokumentující formát.

---

*PolyDoc v1.0 · MIT licence · 2026-03-12*
