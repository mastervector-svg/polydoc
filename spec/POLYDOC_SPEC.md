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

## 11. Roadmapa

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

## 12. GitHub & odkaz ve spec

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
