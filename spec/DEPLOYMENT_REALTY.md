# PolyDoc — Deployment Guide: Real Estate Portal

> How to deploy PolyDoc for transactional client communication.
> Covers the auth layer, encryption, cookie session, and the concrete data model.

---

## 1. Which messages belong in PolyDoc

**YES — transactional and official messages:**
- Property offer (personalised tip for the client)
- Viewing appointment confirmation
- Acknowledgement of enquiry / document receipt
- Status update (price changed, new document added, seller responded)
- Meeting summary
- Request for additional information

**NO — do not put these in PolyDoc:**
- Everyday agent–client chat
- Ad-hoc quick replies
- Internal notes
- Sensitive attachments (contracts, national ID numbers, full profiles)

---

## 2. Message data model

Every PolyDoc message in the IS has this base structure:

```json
{
  "message_id": "msg_abc123",
  "entity_type": "viewing",
  "entity_id": "view_789",
  "client_id": "client_456",
  "sender_identity": {
    "name": "Jana Horáková",
    "role": "Agent",
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

### Entity types (`entity_type`)

| Value | Description |
|-------|-------------|
| `property` | Property offer |
| `viewing` | Viewing appointment |
| `reservation` | Reservation |
| `inquiry` | Enquiry |
| `contract` | Contract |
| `status_update` | Status update |
| `document_request` | Request for additional information |

---

## 3. Three message types — PolyDoc schema

### Type A: Property offer

```json
{
  "header": {
    "format": "poly/1.0",
    "doc_id": "prop_offer_2026_001",
    "doc_type": "property_offer",
    "created": "2026-03-12T08:00:00Z"
  },
  "metadata": {
    "title": "Offer: 3-bedroom flat Prague 6",
    "tags": ["offer", "flat", "prague"],
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
        "title": "3-bedroom flat, 82 m², Praha 6 – Dejvice",
        "price": "8 500 000 CZK",
        "tags": ["New build", "Parking", "Lift"]
      },
      {
        "type": "property_stats",
        "items": [
          { "label": "Layout", "value": "3+kk" },
          { "label": "Area", "value": "82 m²" },
          { "label": "Floor", "value": "4th of 8" },
          { "label": "Condition", "value": "New build 2024" },
          { "label": "Energy", "value": "Class B" }
        ]
      },
      {
        "type": "paragraph",
        "text": "I am sending you this offer because it matches the layout and location requirements you described to me at our meeting on 5 March."
      },
      {
        "type": "agent_card",
        "data": {
          "name": "Jana Horáková",
          "role": "Agent",
          "phone": "+420 777 000 111",
          "email": "horakova@realportal.cz",
          "photo_url": "https://cdn.realportal.cz/agents/horakova.jpg"
        }
      }
    ]
  }
}
```

### Type B: Action confirmation (viewing, reservation)

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
        "title": "Viewing confirmed",
        "subtitle": "3-bedroom flat, Dejvická 12, Praha 6"
      },
      {
        "type": "detail_grid",
        "items": [
          { "label": "Date", "value": "Friday 15 March 2026" },
          { "label": "Time", "value": "10:00 – 10:30" },
          { "label": "Address", "value": "Dejvická 12, Praha 6" },
          { "label": "Reference number", "value": "VIEW-2026-789" },
          { "label": "Contact person", "value": "Jana Horáková, +420 777 000 111" }
        ]
      },
      {
        "type": "next_steps",
        "items": [
          "Please arrive 5 minutes before the start time",
          "Bring with you: a valid ID document",
          "Parking: P+R zone Dejvická (200 m away)"
        ]
      }
    ]
  },
  "logic": {
    "actions": [
      {
        "label": "📅 Add to calendar",
        "type": "ics_download",
        "api_url": "https://app.realportal.cz/api/viewing/view_789/ics"
      },
      {
        "label": "❌ Cancel / reschedule",
        "type": "api_call",
        "api_url": "https://app.realportal.cz/api/viewing/view_789/cancel",
        "method": "POST",
        "confirm_prompt": "Are you sure you want to cancel the viewing?",
        "success_message": "Viewing cancelled. The agent will contact you."
      }
    ]
  }
}
```

### Type C: Status update

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
        "title": "Property price has been reduced",
        "subtitle": "3-bedroom flat, Dejvická 12, Praha 6"
      },
      {
        "type": "price_change",
        "from": "9 200 000 CZK",
        "to": "8 500 000 CZK",
        "diff": "−700 000 CZK",
        "diff_pct": "−7.6 %"
      },
      {
        "type": "paragraph",
        "text": "The seller has reduced the price. The offer is now available on significantly better terms. I recommend acting quickly — there is active interest in this property."
      }
    ]
  }
}
```

---

## 4. Auth layer — three access modes for the full version

After clicking the CTA button in the email, the full version can be protected in three ways. Choose based on the sensitivity of the document.

### Mode 1: Signed Token (recommended for most cases)

Simplest, most client-friendly. No password, no login.

**How it works:**
1. The IS generates a unique `token` when the message is created
2. The token is part of the URL in the CTA button: `https://app.realportal.cz/doc/msg_abc123?t=tok_xyz987`
3. The server verifies the token → returns the full HTML
4. The token can have an expiry (`expires_at`)

```php
// Generate token
function generateDocToken(string $messageId): string {
    $token = bin2hex(random_bytes(32)); // 64 characters, cryptographically secure
    DB::insert('doc_tokens', [
        'token'      => hash('sha256', $token), // store the hash, not plaintext
        'message_id' => $messageId,
        'created_at' => now(),
        'expires_at' => now()->addDays(30),
        'used_count' => 0,
    ]);
    return $token;
}

// Verify token (middleware)
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
        abort(403, 'Invalid or expired link.');
    }
    $message = Message::find($messageId);
    return generatePolyDocFull($message); // inject JSON into template
});
```

**URL in the email:**
```
https://app.realportal.cz/doc/msg_abc123?t=a3f9e2b1c4d5...
```

**Advantages:** No login required, works immediately, client does not need an account.
**Disadvantages:** Anyone with the URL has access (but the URL is 64 characters long — practically unguessable).

---

### Mode 2: Cookie Session (for clients with an account)

The client must be logged in. After clicking the link in the email → the server checks the session cookie → either displays the document or redirects to login.

```php
// Middleware: requires login
Route::get('/doc/{messageId}', function($messageId) {
    // 1. Verify session
    if (!Auth::check()) {
        // Save intended URL, redirect to login
        session(['intended_url' => request()->fullUrl()]);
        return redirect('/login');
    }

    $user = Auth::user();
    $message = Message::find($messageId);

    // 2. Verify that the document belongs to this client
    if ($message->client_id !== $user->client_id) {
        abort(403, 'This document does not belong to you.');
    }

    return generatePolyDocFull($message);
})->middleware('auth');

// Login controller — after login, redirect to original URL
public function login(Request $request) {
    // ... verify credentials ...
    Auth::login($user);
    $redirect = session('intended_url', '/dashboard');
    session()->forget('intended_url');
    return redirect($redirect);
}
```

**UX flow:**
```
Email CTA → /doc/msg_abc123
  → no cookie → redirect /login?next=/doc/msg_abc123
  → client enters email/password
  → redirect back to /doc/msg_abc123
  → document displayed
```

**Magic link (better UX):**
Instead of a password, send the client a one-time login link by email:
```php
// Client clicks "Log in via email" → receives a link
$magicToken = MagicLink::create($user->email, redirect: '/doc/msg_abc123');
Mail::to($user->email)->send(new MagicLinkMail($magicToken));
```

---

### Mode 3: Encrypted content (for sensitive documents)

The full version is encrypted on the server; the key is part of the URL fragment (`#key=...`).
The server **never sees the key** — decryption happens only in the client's browser.

```
https://app.realportal.cz/doc/msg_abc123#key=BASE64_AES_KEY
```

The fragment (`#...`) is **never sent to the server** — this is a key property of HTTP.

**Generation (server, when the message is created):**
```javascript
// Node.js — generate encrypted document
import { webcrypto } from 'crypto';
const { subtle } = webcrypto;

async function encryptPolyDoc(jsonData) {
  // 1. Generate AES-GCM key
  const key = await subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // exportable
    ['encrypt', 'decrypt']
  );

  // 2. Encrypt JSON
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(jsonData));
  const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  // 3. Export key as Base64
  const rawKey = await subtle.exportKey('raw', key);
  const keyB64 = Buffer.from(rawKey).toString('base64url');
  const ivB64 = Buffer.from(iv).toString('base64url');
  const dataB64 = Buffer.from(ciphertext).toString('base64url');

  return {
    encrypted_payload: `${ivB64}.${dataB64}`, // stored on server
    fragment_key: keyB64,                      // goes into URL fragment, server never sees it
    url: `https://app.realportal.cz/doc/msg_abc123#key=${keyB64}`
  };
}
```

**Decryption (client, in the browser):**
```javascript
// Part of poly-interpreter.js for encrypted documents
async function decryptAndRender() {
  const fragment = window.location.hash.slice(1);
  const params = new URLSearchParams(fragment);
  const keyB64 = params.get('key');

  if (!keyB64) {
    // No key → show preview only or prompt to log in
    showLoginPrompt();
    return;
  }

  // Fetch encrypted data from server
  const res = await fetch(`/api/doc/${DOC_ID}/encrypted`);
  const { payload } = await res.json();
  const [ivB64, dataB64] = payload.split('.');

  // Decrypt in browser
  const keyBytes = Uint8Array.from(atob(keyB64.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivB64.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
  const data = Uint8Array.from(atob(dataB64.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
  const doc = JSON.parse(new TextDecoder().decode(decrypted));

  PolyDoc.renderFromObject(doc);
}
```

**When to use encryption:**
- Contracts and their drafts
- Documents containing personal data (national ID numbers, bank accounts)
- Offers with a confidential price
- Anything where you do not want the server to know the content after it has been opened

---

## 5. Decision matrix — which mode for what

| Message type | Recommended mode | Reason |
|-------------|-----------------|--------|
| Property offer | Signed Token | Simple, client does not need an account |
| Viewing confirmation | Signed Token | Quick access, low sensitivity |
| Status update | Signed Token | Routine information |
| Meeting summary | Cookie Session | Client has an account, we want an audit trail |
| Document request | Cookie Session | We want to know who completed it |
| Contract draft | Encryption | Sensitive content, legal relevance |
| Documents with national ID | Encryption | GDPR obligation |

---

## 6. Phishing protection — mandatory elements

Because you are training clients to click "Open document", it must always be clear that the link is legitimate.

### In the email (preview version)
```html
<!-- Always display the sender -->
<p style="...">Message sent by: <strong>Jana Horáková</strong> · RealPortal s.r.o.</p>

<!-- Always display the link domain visibly -->
<p style="font-size:11px;color:#999;">
  Link goes to: <strong>app.realportal.cz</strong>
</p>

<!-- Reference number visibly -->
<p>Reference: <code>VIEW-2026-789</code></p>
```

### On the server (full version)
- Always HTTPS with a valid certificate
- The URL must be on your domain — never use `bit.ly` or other URL shorteners
- Display in the page header: who issued the document, for whom, and when
- Add `Strict-Transport-Security` and `Content-Security-Policy` headers

### Email DKIM/SPF/DMARC
```
# DNS records — required for email trustworthiness
SPF:   v=spf1 include:sendgrid.net ~all
DKIM:  v=DKIM1; k=rsa; p=MIGfMA0GCS...
DMARC: v=DMARC1; p=quarantine; rua=mailto:dmarc@realportal.cz
```

---

## 7. Audit trail

Log every access to the full version:

```php
DocAccessLog::create([
    'message_id'  => $messageId,
    'client_id'   => $clientId,
    'accessed_at' => now(),
    'ip_hash'     => hash('sha256', $request->ip()), // GDPR: do not store raw IP
    'user_agent'  => $request->userAgent(),
    'token_used'  => $tokenId,
    'mode'        => 'token', // token | session | encrypted
]);
```

This way the CRM shows you:
- When the client first opened the offer
- How many times they returned
- Which message they came from

---

## 8. Flow from creation to client opening

```
[IS / backend]
  1. Agent creates/approves the message
  2. IS assembles JSON according to the schema
  3. IS generates signed token or encryption key
  4. IS renders email template (static version)
  5. Email sent via SMTP / SendGrid / Mailgun

[Client's email client]
  6. Client sees static preview (no JS)
  7. Clicks "Open interactive document →"

[Server]
  8. Receives GET /doc/{id}?t={token}
  9. Verifies token / session / decryption
  10. Logs access
  11. Returns full PolyDoc HTML

[Client's browser]
  12. Poly interpreter loads JSON from #raw-data
  13. Fetches live state from API (is_confirmed, is_cancelled...)
  14. Renders document with current state
  15. Displays action buttons (Cancel, Add to calendar...)

[IS / backend — webhook]
  16. Client clicks action → POST to API
  17. IS processes it, changes state, optionally sends a new message
```

---

## 9. GDPR checklist

- [ ] Do not include national ID numbers, full addresses, or bank accounts in the preview email
- [ ] Encrypt sensitive documents (Mode 3)
- [ ] Tokens have an expiry (max 30 days for offers, 7 days for confirmations)
- [ ] Anonymise audit logs (hashed IP, not raw)
- [ ] Client can request deletion → delete tokens and logs
- [ ] Include a link to the portal's GDPR information page in the email footer

---

## 10. MVP implementation plan

### Sprint 1 — foundation (2 weeks)
- [ ] Message data model in IS (message, token, access_log)
- [ ] Email version generator for message type "Viewing confirmation"
- [ ] Server route with token verification
- [ ] Full version (polydoc-full.html template)

### Sprint 2 — message types (2 weeks)
- [ ] Type "Property offer" (property_hero, property_stats)
- [ ] Type "Status update"
- [ ] New section types: property_hero, detail_grid, agent_card, next_steps

### Sprint 3 — auth and security (1 week)
- [ ] Cookie session mode for logged-in clients
- [ ] Magic link login
- [ ] DKIM/SPF/DMARC configuration
- [ ] Audit logs in CRM

### Sprint 4 — encryption (1 week, optional)
- [ ] AES-GCM encryption for sensitive documents
- [ ] Client-side decryption in poly interpreter

---

*PolyDoc Deployment Guide v1.0 · Real Estate Portal · 2026-03-12*
