# PolyDoc — Deployment Guide: Realitní portál

> Jak nasadit PolyDoc pro transakční komunikaci s klienty.
> Zahrnuje auth vrstvu, šifrování, cookie session a konkrétní datový model.

---

## 1. Které zprávy patří do PolyDoc

**ANO — transakční a oficální zprávy:**
- Nabídka nemovitosti (personalizovaný tip pro klienta)
- Potvrzení rezervace prohlídky
- Potvrzení přijetí poptávky / dokumentů
- Stavová zpráva (cena změněna, přibyl dokument, prodávající odpověděl)
- Shrnutí jednání
- Výzva k doplnění údajů

**NE — necpat do PolyDoc:**
- Běžný chat makléř–klient
- Ad hoc rychlé odpovědi
- Interní poznámky
- Citlivé přílohy (smlouvy, RČ, celé profily)

---

## 2. Datový model zprávy

Každá PolyDoc zpráva v IS má tento základ:

```json
{
  "message_id": "msg_abc123",
  "entity_type": "viewing",
  "entity_id": "view_789",
  "client_id": "client_456",
  "sender_identity": {
    "name": "Jana Horáková",
    "role": "Makléřka",
    "email": "horakova@realportal.cz",
    "phone": "+420 777 000 111",
    "agency": "RealPortal s.r.o."
  },
  "issued_at": "2026-03-12T08:00:00Z",
  "expires_at": "2026-04-12T08:00:00Z",
  "status": "pending",
  "preview_payload": { ... },
  "full_view_url": "https://app.realportal.cz/doc/msg_abc123",
  "access": {
    "mode": "token",
    "token": "tok_xyz987",
    "require_login": false
  },
  "signature_hash": "sha256:e3b0c442..."
}
```

### Typy entit (`entity_type`)

| Hodnota | Popis |
|---------|-------|
| `property` | Nabídka nemovitosti |
| `viewing` | Prohlídka |
| `reservation` | Rezervace |
| `inquiry` | Poptávka |
| `contract` | Smlouva |
| `status_update` | Stavová zpráva |
| `document_request` | Výzva k doplnění |

---

## 3. Tři typy zpráv — PolyDoc schéma

### Typ A: Nabídka nemovitosti

```json
{
  "header": {
    "format": "poly/1.0",
    "doc_id": "prop_offer_2026_001",
    "doc_type": "property_offer",
    "created": "2026-03-12T08:00:00Z"
  },
  "metadata": {
    "title": "Nabídka: Byt 3+kk Praha 6",
    "tags": ["nabidka", "byt", "praha"],
    "custom_fields": {
      "property_id": "prop_123",
      "price": 8500000,
      "currency": "CZK",
      "disposition": "3+kk",
      "area_m2": 82,
      "location": "Praha 6 – Dejvice"
    }
  },
  "content": {
    "type": "document",
    "sections": [
      {
        "type": "property_hero",
        "image_url": "https://cdn.realportal.cz/prop_123/main.jpg",
        "title": "Byt 3+kk, 82 m², Praha 6 – Dejvice",
        "price": "8 500 000 Kč",
        "tags": ["Novostavba", "Parkování", "Výtah"]
      },
      {
        "type": "property_stats",
        "items": [
          { "label": "Dispozice", "value": "3+kk" },
          { "label": "Plocha", "value": "82 m²" },
          { "label": "Podlaží", "value": "4. z 8" },
          { "label": "Stav", "value": "Novostavba 2024" },
          { "label": "Energie", "value": "Třída B" }
        ]
      },
      {
        "type": "paragraph",
        "text": "Posílám vám tuto nabídku, protože odpovídá vašim požadavkům na dispozici a lokalitu, které jste mi sdělil/a na schůzce 5. března."
      },
      {
        "type": "agent_card",
        "data": {
          "name": "Jana Horáková",
          "role": "Makléřka",
          "phone": "+420 777 000 111",
          "email": "horakova@realportal.cz",
          "photo_url": "https://cdn.realportal.cz/agents/horakova.jpg"
        }
      }
    ]
  }
}
```

### Typ B: Potvrzení akce (prohlídka, rezervace)

```json
{
  "header": {
    "format": "poly/1.0",
    "doc_id": "confirm_view_789",
    "doc_type": "confirmation"
  },
  "content": {
    "type": "document",
    "sections": [
      {
        "type": "confirmation_hero",
        "icon": "✅",
        "title": "Prohlídka potvrzena",
        "subtitle": "Byt 3+kk, Dejvická 12, Praha 6"
      },
      {
        "type": "detail_grid",
        "items": [
          { "label": "Datum", "value": "Pátek 15. 3. 2026" },
          { "label": "Čas", "value": "10:00 – 10:30" },
          { "label": "Adresa", "value": "Dejvická 12, Praha 6" },
          { "label": "Referenční číslo", "value": "VIEW-2026-789" },
          { "label": "Kontaktní osoba", "value": "Jana Horáková, +420 777 000 111" }
        ]
      },
      {
        "type": "next_steps",
        "items": [
          "Dostavte se prosím 5 minut před začátkem",
          "S sebou: občanský průkaz",
          "Parkování: zóna P+R Dejvická (200 m)"
        ]
      }
    ]
  },
  "logic": {
    "actions": [
      {
        "label": "📅 Přidat do kalendáře",
        "type": "ics_download",
        "api_url": "https://app.realportal.cz/api/viewing/view_789/ics"
      },
      {
        "label": "❌ Zrušit / změnit termín",
        "type": "api_call",
        "api_url": "https://app.realportal.cz/api/viewing/view_789/cancel",
        "method": "POST",
        "confirm_prompt": "Opravdu chcete zrušit prohlídku?",
        "success_message": "Prohlídka zrušena. Makléřka vás bude kontaktovat."
      }
    ]
  }
}
```

### Typ C: Stavová zpráva

```json
{
  "header": {
    "format": "poly/1.0",
    "doc_id": "status_2026_042",
    "doc_type": "status_update"
  },
  "content": {
    "type": "document",
    "sections": [
      {
        "type": "status_hero",
        "status": "price_changed",
        "icon": "🏷️",
        "title": "Cena nemovitosti byla snížena",
        "subtitle": "Byt 3+kk, Dejvická 12, Praha 6"
      },
      {
        "type": "price_change",
        "from": "9 200 000 Kč",
        "to": "8 500 000 Kč",
        "diff": "−700 000 Kč",
        "diff_pct": "−7,6 %"
      },
      {
        "type": "paragraph",
        "text": "Prodávající snížil cenu. Nabídka je nyní dostupná za výrazně lepších podmínek. Doporučuji jednat rychle — o nemovitost je zájem."
      }
    ]
  }
}
```

---

## 4. Auth vrstva — tři módy přístupu k full verzi

Po prokliknutí CTA tlačítka z mailu může být full verze chráněna třemi způsoby. Vyber podle citlivosti dokumentu.

### Mód 1: Signed Token (doporučeno pro většinu)

Nejjednodušší, nejpřívětivější pro klienta. Žádné heslo, žádné přihlášení.

**Jak funguje:**
1. IS vygeneruje unikátní `token` při vytvoření zprávy
2. Token je součástí URL v CTA tlačítku: `https://app.realportal.cz/doc/msg_abc123?t=tok_xyz987`
3. Server ověří token → vrátí full HTML
4. Token může mít expiraci (`expires_at`)

```php
// Generování tokenu
function generateDocToken(string $messageId): string {
    $token = bin2hex(random_bytes(32)); // 64 znaků, kryptograficky bezpečné
    DB::insert('doc_tokens', [
        'token'      => hash('sha256', $token), // ukládáme hash, ne plaintext
        'message_id' => $messageId,
        'created_at' => now(),
        'expires_at' => now()->addDays(30),
        'used_count' => 0,
    ]);
    return $token;
}

// Ověření tokenu (middleware)
function verifyDocToken(string $token, string $messageId): bool {
    $record = DB::find('doc_tokens', [
        'token'      => hash('sha256', $token),
        'message_id' => $messageId,
    ]);
    if (!$record) return false;
    if ($record->expires_at < now()) return false;
    DB::update('doc_tokens', $record->id, ['used_count' => $record->used_count + 1]);
    return true;
}

// Route
Route::get('/doc/{messageId}', function($messageId, Request $req) {
    $token = $req->query('t');
    if (!verifyDocToken($token, $messageId)) {
        abort(403, 'Neplatný nebo expirovaný odkaz.');
    }
    $message = Message::find($messageId);
    return generatePolyDocFull($message); // inject JSON do šablony
});
```

**URL v mailu:**
```
https://app.realportal.cz/doc/msg_abc123?t=a3f9e2b1c4d5...
```

**Výhody:** Žádné přihlášení, funguje hned, klient nemusí mít účet.
**Nevýhody:** Kdokoli s URL má přístup (ale URL je 64 znaků — prakticky nezjistitelná).

---

### Mód 2: Cookie Session (pro klienty s účtem)

Klient musí být přihlášen. Po prokliknutí z mailu → server zkontroluje session cookie → buď zobrazí, nebo přesměruje na login.

```php
// Middleware: vyžaduje přihlášení
Route::get('/doc/{messageId}', function($messageId) {
    // 1. Ověř session
    if (!Auth::check()) {
        // Ulož intended URL, přesměruj na login
        session(['intended_url' => request()->fullUrl()]);
        return redirect('/login');
    }

    $user = Auth::user();
    $message = Message::find($messageId);

    // 2. Ověř že dokument patří tomuto klientovi
    if ($message->client_id !== $user->client_id) {
        abort(403, 'Tento dokument není váš.');
    }

    return generatePolyDocFull($message);
})->middleware('auth');

// Login controller — po přihlášení vrátí na původní URL
public function login(Request $request) {
    // ... ověření credentials ...
    Auth::login($user);
    $redirect = session('intended_url', '/dashboard');
    session()->forget('intended_url');
    return redirect($redirect);
}
```

**UX flow:**
```
Mail CTA → /doc/msg_abc123
  → není cookie → redirect /login?next=/doc/msg_abc123
  → klient zadá email/heslo
  → redirect zpět na /doc/msg_abc123
  → dokument se zobrazí
```

**Magický link (lepší UX):**
Místo hesla pošli klientovi jednorázový přihlašovací odkaz emailem:
```php
// Klient klikne "Přihlásit přes email" → dostane link
$magicToken = MagicLink::create($user->email, redirect: '/doc/msg_abc123');
Mail::to($user->email)->send(new MagicLinkMail($magicToken));
```

---

### Mód 3: Šifrovaný obsah (pro citlivé dokumenty)

Full verze je zašifrovaná na serveru, klíč je součástí URL fragmentu (`#key=...`).
Server **nikdy nevidí klíč** — dešifrování probíhá pouze v prohlížeči klienta.

```
https://app.realportal.cz/doc/msg_abc123#key=BASE64_AES_KEY
```

Fragment (`#...`) se **neodesílá na server** — to je klíčová vlastnost HTTP.

**Generování (server, při vytvoření zprávy):**
```javascript
// Node.js — generování šifrovaného dokumentu
import { webcrypto } from 'crypto';
const { subtle } = webcrypto;

async function encryptPolyDoc(jsonData) {
  // 1. Vygeneruj AES-GCM klíč
  const key = await subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // exportovatelný
    ['encrypt', 'decrypt']
  );

  // 2. Zašifruj JSON
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(jsonData));
  const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  // 3. Export klíče jako Base64
  const rawKey = await subtle.exportKey('raw', key);
  const keyB64 = Buffer.from(rawKey).toString('base64url');
  const ivB64 = Buffer.from(iv).toString('base64url');
  const dataB64 = Buffer.from(ciphertext).toString('base64url');

  return {
    encrypted_payload: `${ivB64}.${dataB64}`, // uloží se na server
    fragment_key: keyB64,                      // jde do URL fragmentu, server ho nevidí
    url: `https://app.realportal.cz/doc/msg_abc123#key=${keyB64}`
  };
}
```

**Dešifrování (klient, v prohlížeči):**
```javascript
// Součást poly-interpreter.js pro šifrované dokumenty
async function decryptAndRender() {
  const fragment = window.location.hash.slice(1);
  const params = new URLSearchParams(fragment);
  const keyB64 = params.get('key');

  if (!keyB64) {
    // Žádný klíč → zobraz pouze preview nebo výzvu k přihlášení
    showLoginPrompt();
    return;
  }

  // Načti zašifrovaná data ze serveru
  const res = await fetch(`/api/doc/${DOC_ID}/encrypted`);
  const { payload } = await res.json();
  const [ivB64, dataB64] = payload.split('.');

  // Dešifruj v prohlížeči
  const keyBytes = Uint8Array.from(atob(keyB64.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivB64.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
  const data = Uint8Array.from(atob(dataB64.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
  const doc = JSON.parse(new TextDecoder().decode(decrypted));

  PolyDoc.renderFromObject(doc);
}
```

**Kdy použít šifrování:**
- Smlouvy a jejich návrhy
- Dokumenty s osobními údaji (RČ, bank. účty)
- Nabídky s důvěrnou cenou
- Cokoliv kde nechceš, aby server znal obsah po otevření

---

## 5. Rozhodovací matice — který mód pro co

| Typ zprávy | Doporučený mód | Důvod |
|-----------|---------------|-------|
| Nabídka nemovitosti | Signed Token | Jednoduché, klient nemusí mít účet |
| Potvrzení prohlídky | Signed Token | Rychlý přístup, nízká citlivost |
| Stavová zpráva | Signed Token | Rutinní info |
| Shrnutí jednání | Cookie Session | Klient má účet, chceme audit |
| Výzva k dokumentům | Cookie Session | Chceme vědět kdo to splnil |
| Návrh smlouvy | Šifrování | Citlivý obsah, právní relevance |
| Dokumenty s RČ | Šifrování | GDPR povinnost |

---

## 6. Phishing ochrana — povinné prvky

Protože klienty učíš klikat na "Otevřít dokument", musí být vždy jasné že je odkaz legitimní.

### V mailu (preview verze)
```html
<!-- Vždy zobraz odesílatele -->
<p style="...">Zprávu odeslala: <strong>Jana Horáková</strong> · RealPortal s.r.o.</p>

<!-- Vždy zobraz doménu odkazu viditelně -->
<p style="font-size:11px;color:#999;">
  Odkaz vede na: <strong>app.realportal.cz</strong>
</p>

<!-- Referenční číslo viditelně -->
<p>Reference: <code>VIEW-2026-789</code></p>
```

### Na serveru (full verze)
- Vždy HTTPS, platný certifikát
- URL musí být na vaší doméně — nikdy `bit.ly` nebo jiné zkracovače
- V hlavičce stránky zobrazit: kdo dokument vystavil, pro koho, kdy
- Přidat `Strict-Transport-Security` a `Content-Security-Policy` hlavičky

### Email DKIM/SPF/DMARC
```
# DNS záznamy — povinné pro důvěryhodnost mailu
SPF:   v=spf1 include:sendgrid.net ~all
DKIM:  v=DKIM1; k=rsa; p=MIGfMA0GCS...
DMARC: v=DMARC1; p=quarantine; rua=mailto:dmarc@realportal.cz
```

---

## 7. Auditní stopa

Každé otevření full verze loguj:

```php
DocAccessLog::create([
    'message_id'  => $messageId,
    'client_id'   => $clientId,
    'accessed_at' => now(),
    'ip_hash'     => hash('sha256', $request->ip()), // GDPR: neukládáme raw IP
    'user_agent'  => $request->userAgent(),
    'token_used'  => $tokenId,
    'mode'        => 'token', // token | session | encrypted
]);
```

Tím pádem v CRM vidíš:
- Kdy klient poprvé otevřel nabídku
- Kolikrát se vrátil
- Ze které zprávy přišel

---

## 8. Tok od vytvoření po otevření klientem

```
[IS / backend]
  1. Makléř vytvoří/schválí zprávu
  2. IS sestaví JSON dle schématu
  3. IS vygeneruje signed token nebo šifrovací klíč
  4. IS renderuje mail šablonu (statická verze)
  5. Mail odeslán přes SMTP / SendGrid / Mailgun

[Klientův emailový klient]
  6. Klient vidí statický preview (bez JS)
  7. Klikne "Otevřít interaktivní dokument →"

[Server]
  8. Příjem GET /doc/{id}?t={token}
  9. Ověření tokenu / session / dešifrování
  10. Logování přístupu
  11. Vrácení full PolyDoc HTML

[Klientův prohlížeč]
  12. Poly interpreter načte JSON z #raw-data
  13. Fetchne živý stav z API (is_confirmed, is_cancelled...)
  14. Vyrendruje dokument s aktuálním stavem
  15. Zobrazí akční tlačítka (Zrušit, Přidat do kalendáře...)

[IS / backend — webhook]
  16. Klient klikne akci → POST na API
  17. IS zpracuje, změní stav, případně pošle novou zprávu
```

---

## 9. GDPR checklist

- [ ] Do preview mailu nedávat RČ, celé adresy, bankovní účty
- [ ] Citlivé dokumenty šifrovat (Mód 3)
- [ ] Tokeny mají expiraci (max 30 dní pro nabídky, 7 dní pro potvrzení)
- [ ] Auditní logy anonymizovat (hash IP, ne raw)
- [ ] Klient může požádat o smazání → smazat tokeny a logy
- [ ] V patičce mailu odkaz na GDPR informace portálu

---

## 10. MVP implementační plán

### Sprint 1 — základ (2 týdny)
- [ ] Datový model zpráv v IS (message, token, access_log)
- [ ] Generátor mail verze pro typ "Potvrzení prohlídky"
- [ ] Server route s token ověřením
- [ ] Full verze (polydoc-full.html šablona)

### Sprint 2 — typy zpráv (2 týdny)
- [ ] Typ "Nabídka nemovitosti" (property_hero, property_stats)
- [ ] Typ "Stavová zpráva"
- [ ] Nové typy sekcí: property_hero, detail_grid, agent_card, next_steps

### Sprint 3 — auth a bezpečnost (1 týden)
- [ ] Cookie session mód pro přihlášené klienty
- [ ] Magic link login
- [ ] DKIM/SPF/DMARC nastavení
- [ ] Auditní logy v CRM

### Sprint 4 — šifrování (1 týden, volitelné)
- [ ] AES-GCM šifrování pro citlivé dokumenty
- [ ] Client-side dešifrování v poly interpreteru

---

*PolyDoc Deployment Guide v1.0 · Realitní portál · 2026-03-12*
