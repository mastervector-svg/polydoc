# Security

*Signing, encryption, access control, and what to never put in a PolyDoc.*

---

## Access Modes for Full Version

### Token (default)
64-character cryptographically random token in the URL.
Server stores `sha256(token)` — never the plaintext.
Suitable for: invoices, confirmations, offers, status updates.

```
https://app.example.cz/doc/INV-2026-001?t=a3f9e2b1c4d5...64chars
```

### Session Cookie
User must be authenticated. After clicking from email, redirected to login if no session.
Magic link (passwordless) recommended for better UX.
Suitable for: documents requiring audit trail, workflow steps.

### Fragment Encryption (AES-GCM)
AES-256-GCM key in URL fragment. Fragment is never sent to server per HTTP spec.
Server stores ciphertext only. Only the URL holder can decrypt.
Suitable for: contracts, documents with personal data, anything GDPR-sensitive.

```
https://app.example.cz/doc/contract-001#key=BASE64_AES_KEY
```

---

## Document Signing (ES256)

Signatures use ECDSA with P-256 curve (ES256).

**What is signed:** `sha256(canonical_payload_json)`
**What is in the signature:** `header.transfer + header.version + payload_hash`
**Verification:** Web Crypto API (`SubtleCrypto`) — no server needed, works offline.

```javascript
// Verify in browser
const publicKey = await crypto.subtle.importKey(
  'spki',
  pemToDer(doc.header.signature.public_key),
  { name: 'ECDSA', namedCurve: 'P-256' },
  false,
  ['verify']
);
// ... verify signature against payload hash
```

---

## What NEVER Goes in a PolyDoc

| Data | Why |
|------|-----|
| Private keys | Obviously |
| API secrets, passwords | Use `env_schema` (keys only, no values) |
| Full personal ID numbers | Use reference IDs instead |
| Internal system notes | May leak to unintended recipients |
| Entire user profiles | Include only what the recipient needs |

`env_schema` payload items describe the *shape* of your environment. Never the secrets.

---

## Email Security

Set DKIM, SPF, and DMARC before sending PolyDoc mails.
Users are trained to click "Open document" — phishing risk if your domain is spoofable.

```
SPF:   v=spf1 include:your-mail-provider ~all
DKIM:  v=DKIM1; k=rsa; p=...
DMARC: v=DMARC1; p=quarantine; rua=mailto:dmarc@your-domain.cz
```

Every mail version must display the sender identity and reference number visibly.
Never use URL shorteners for the CTA button link.

---

## XSS Prevention

`rich_text` sections accept raw HTML. Sanitize before rendering.

```javascript
// Production: use DOMPurify
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(section.html);
container.innerHTML = clean;
```

The reference interpreter intentionally omits DOMPurify (no external dependencies).
Add it in production. This is documented as a known gap.

Never allow `javascript:` or `data:text/html` in `image.src`.

---

*[Back to README](../README.md) · [Architecture](ARCHITECTURE.md)*
