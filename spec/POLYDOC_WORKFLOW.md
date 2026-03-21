# PolyDoc — Workflow, Access Control & DRM

> **One document. Live state. Cryptographic authorization. Git-backed history.**

This specification extends PolyDoc with four related capabilities that share a common theme: **the document itself is the authority**, not a portal, not a separate system.

- **§1 Remote Key & DRM** — time-limited key fetch, device binding, revocation
- **§2 Time-Lock** — NTP-verified document unlock at a specific moment
- **§3 Quorum Voting** — n-of-m approval on sections or actions
- **§4 Git Integration** — version history, commit authorization, deploy gate

These are independent features — use any combination.

---

## §1 Remote Key & DRM

### The problem DRM solves (without the usual nonsense)

Standard AES-256-GCM fragment encryption (`key_location: "url_fragment"`) is perfect for one-time sharing: the key travels with the link. But for ongoing access control — subscription content, licensed documents, time-limited access — you need the key to come from a server that can enforce conditions.

`key_location: "remote"` solves this. The document is an encrypted blob. The key lives on a key server. The browser fetches it — only if all conditions pass.

### Declaration

```json
{
  "header": {
    "format": "poly/1.0",
    "doc_id": "REPORT-2026-Q1",
    "doc_type": "invoice",
    "encryption": {
      "algorithm": "AES-256-GCM",
      "key_location": "remote",
      "key_url": "https://keys.example.com/doc/REPORT-2026-Q1/key",
      "key_auth": "bearer",
      "key_ttl": 86400,
      "key_grace": 3600,
      "max_opens": 10,
      "device_binding": false,
      "revocable": true,
      "iv": "base64-encoded-iv"
    }
  }
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `key_location` | `"remote"` | Key must be fetched from `key_url` |
| `key_url` | URI | Key server endpoint |
| `key_auth` | `"none"` \| `"bearer"` \| `"cookie"` \| `"oauth2"` | How the browser authenticates to the key server |
| `key_ttl` | integer (seconds) | How long the key is valid after issuing. `0` = one-time use |
| `key_grace` | integer (seconds) | Offline grace period — cached key remains valid without network. Default `0` |
| `max_opens` | integer | Maximum number of key issues for this document. `null` = unlimited |
| `device_binding` | boolean | Key is tied to the requesting device fingerprint. Default `false` |
| `revocable` | boolean | Server can refuse to issue the key at any time |

### Key server protocol

```
GET {key_url}
Authorization: Bearer <user_token>
X-PolyDoc-Id: REPORT-2026-Q1
X-PolyDoc-Device: sha256(userAgent + screen + platform)  // if device_binding: true

→ 200 OK
{
  "key": "base64-aes-key",
  "expires_at": "2026-03-22T10:00:00Z",
  "opens_remaining": 7
}

→ 403 Forbidden   // not authorised, subscription expired, revoked
→ 410 Gone        // max_opens exceeded, document permanently locked
→ 423 Locked      // time_lock not yet reached (see §2)
```

The browser caches the key in `sessionStorage` (not `localStorage`) for `key_ttl` seconds. If the user is offline and `key_grace > 0`, the cached key remains valid for that duration. After expiry, the document displays a lock screen and re-fetches.

### Revocation

The key server simply returns `403` for revoked documents. No changes to the HTML file needed. The next time any user tries to open it, the document locks. Existing cached keys expire within `key_ttl` seconds.

For immediate revocation (e.g. data breach, court order): set `key_ttl: 0` on all future issues and add the doc to a revocation list. All sessions expire within `key_grace` seconds.

### Use cases

| Use case | `key_ttl` | `key_grace` | `max_opens` | `device_binding` |
|----------|-----------|-------------|-------------|-----------------|
| Subscription report (monthly) | 2 592 000 (30 days) | 3 600 | null | false |
| Software licence document | 31 536 000 (1 year) | 86 400 | null | true |
| Due diligence data room | 604 800 (7 days) | 0 | 50 | false |
| One-time NDA review | 0 (one-time) | 0 | 1 | false |
| Embargoed press release | until embargo lifts (→ §2) | 0 | null | false |

### Why this beats standard DRM

| Standard DRM (Widevine, Adobe) | PolyDoc Remote Key |
|-------------------------------|-------------------|
| Requires a specific player/app | Any browser |
| Proprietary protocol | Plain HTTPS GET + JSON |
| Vendor lock-in | Self-hosted key server, 50 lines of code |
| Only for audio/video | Any MIME type, any content |
| Complex CDM licensing | MIT. Free. Forever. |

---

## §2 Time-Lock

A time-locked document cannot be opened before a specified moment — verified by multiple NTP sources, not the local system clock.

### Declaration

```json
{
  "header": {
    "access": {
      "mode": "time_lock",
      "unlock_at": "2026-04-01T09:00:00Z",
      "ntp_sources": [
        "https://time.cloudflare.com",
        "https://worldtimeapi.org/api/timezone/Etc/UTC",
        "https://timeapi.io/api/Time/current/zone?timeZone=UTC"
      ],
      "ntp_required": 2,
      "key_location": "remote",
      "key_url": "https://keys.example.com/doc/WILL-2026/key"
    }
  }
}
```

### How it works

```
Browser opens document
  → fetches time from ntp_sources[] in parallel
  → requires ntp_required sources to agree (within ±5s tolerance)
  → if consensus_time < unlock_at → display countdown, return 423
  → if consensus_time >= unlock_at → fetch key from key_url
    → key server also verifies time independently
    → key issued → document decrypts
```

Requiring consensus from multiple independent NTP sources prevents local clock manipulation. The key server performs its own time check as a second layer — the client cannot spoof the NTP response to unlock early.

### Offline behaviour

If NTP sources are unreachable and `consensus_time` cannot be established, the document stays locked. There is no offline grace period for time-locks — by design. A time-lock is a commitment, not a suggestion.

### Use cases

- **Embargoed press release** — journalists receive the file in advance, it unlocks at 09:00 GMT simultaneously for everyone
- **Delayed contract effective date** — document unlocks the moment the contract becomes binding
- **Will or testament** — unlocks on a specific date or after a verifiable event
- **Exam paper** — distributed to proctors in advance, unlocks at the start time
- **Scheduled announcement** — product launch, earnings release, election results

### Countdown display

While locked, the interpreter renders:

```
🔒 This document is time-locked.

   Opens in:  2d 14h 33m 07s

   Unlock time:  2026-04-01 09:00:00 UTC
   Verified via: Cloudflare Time, WorldTimeAPI (2/3 sources agree)
```

---

## §3 Quorum Voting

A PolyDoc section or action can require `n-of-m` approvals before it becomes effective. Each approval is a cryptographic signature from a named participant. The document holds the live approval state and updates it via the server API.

### Declaration

```json
{
  "header": {
    "doc_type": "approval",
    "quorum": {
      "required": 3,
      "participants": [
        { "id": "alice",  "key_hint": "sha256:alice...",  "role": "Engineering Lead" },
        { "id": "bob",    "key_hint": "sha256:bob...",    "role": "Security" },
        { "id": "carol",  "key_hint": "sha256:carol...",  "role": "Product" },
        { "id": "dave",   "key_hint": "sha256:dave...",   "role": "Legal" },
        { "id": "eve",    "key_hint": "sha256:eve...",    "role": "CTO" }
      ],
      "deadline": "2026-04-05T17:00:00Z",
      "on_quorum": {
        "action": "webhook",
        "url": "https://api.example.com/doc/DEPLOY-042/execute",
        "method": "POST"
      }
    }
  },
  "logic": {
    "approvals": [
      { "participant": "alice", "signed_at": "2026-03-21T10:14:00Z", "signature": "ES256:..." },
      { "participant": "bob",   "signed_at": "2026-03-21T11:02:00Z", "signature": "ES256:..." }
    ]
  }
}
```

### Quorum fields

| Field | Description |
|-------|-------------|
| `quorum.required` | Number of signatures needed |
| `quorum.participants[]` | All eligible signers with key hints |
| `quorum.deadline` | Optional — quorum must be reached by this time |
| `quorum.on_quorum.action` | What happens when quorum is reached: `webhook`, `git_merge`, `unlock`, `fill_slot` |
| `quorum.on_quorum.url` | Target of the action |
| `logic.approvals[]` | Current signatures — updated by the server on each sign |

### Signing API

```
POST /doc/{doc_id}/approve
Authorization: Bearer <user_token>

{
  "participant": "alice",
  "signature": "ES256:base64..."
}

→ {
    "ok": true,
    "approvals": 2,
    "required": 3,
    "quorum_reached": false,
    "remaining": ["carol", "dave", "eve"]
  }
```

When `quorum_reached: true`, the server immediately fires `on_quorum` — no polling needed.

### Live state display

The interpreter renders the approval panel in real time (WebSocket or polling):

```
📋 Deployment Authorization — DEPLOY-042
Deploy feature/checkout-v2 → main

Approvals required: 3 of 5

  ✅ Alice Chen      Engineering Lead   21 Mar 10:14
  ✅ Bob Novák       Security           21 Mar 11:02
  ⏳ Carol Smith     Product            (pending)
  ⏳ Dave Müller     Legal              (pending)
  ⏳ Eve Johnson     CTO                (pending)

Deadline: 5 Apr 17:00 UTC

[✅ Approve]   [❌ Reject]   [💬 Comment]
```

### Rejection and veto

Any participant can reject. Rejection before quorum cancels the process. A `veto_participants` list can specify people whose single rejection blocks the quorum regardless of other approvals:

```json
"quorum": {
  "required": 3,
  "veto_participants": ["eve"],
  ...
}
```

---

## §4 Git Integration

### Document as a version-controlled object

Any PolyDoc document can declare a Git repository as its backing store. Each fill, approval, or edit creates a commit. The document always shows the current state; Git holds the full history.

```json
{
  "header": {
    "git": {
      "repo": "https://github.com/example/contracts.git",
      "branch": "main",
      "path": "docs/CONTRACT-2026-042.json",
      "auth": "bearer",
      "auto_commit": true,
      "commit_on": ["slot_fill", "approval", "section_edit"],
      "commit_message_template": "PolyDoc: {event} by {actor} on {doc_id}"
    }
  }
}
```

### What gets committed

Each write operation on the document generates a commit to `git.path`:

| Event | Commit message |
|-------|---------------|
| Slot filled | `PolyDoc: slot_fill infrastructure by ops@example.com` |
| Approval added | `PolyDoc: approval alice on DEPLOY-042 (2/3)` |
| Quorum reached | `PolyDoc: quorum_reached DEPLOY-042 — executing on_quorum` |
| Section edited | `PolyDoc: section_edit §3 by carol@example.com` |

The commit payload is the canonical JSON of the document (without `parts[]` binary data — those go to Git LFS or remain inline).

### Git as deploy gate

This is where document workflow meets infrastructure:

```
Document DEPLOY-042:
  slots:    diff.md (embedded) + test-results.json (CI fills after build)
  quorum:   3 of 5 (engineering, security, product, legal, CTO)
  on_quorum: git_merge feature/checkout-v2 → main

Flow:
  1. Engineer opens PR → CI fills test-results slot
  2. Document is shared with approvers
  3. Each approver reads diff.md + test-results → clicks [Approve]
  4. Quorum reached (3/5) → server calls GitHub API: merge PR
  5. Deploy pipeline triggers automatically
  6. Audit trail: who approved, when, which commit hash, which test results
```

The document IS the pull request review. The quorum IS the merge button. The manifest signature proves which version of the code each approver saw at approval time.

### Git-backed envelope versioning

For Envelope documents, Git stores a snapshot of the manifest JSON after each slot fill:

```
contracts/
  ENV-2026-DEPLOY-042/
    v1-manifest.json    ← initial pack (3 slots empty)
    v2-manifest.json    ← ops filled docker-compose.yml
    v3-manifest.json    ← CI filled test-results.json
    v4-manifest.json    ← quorum reached, all slots filled
```

Opening the current `.html` always shows the latest state. Opening any Git revision shows the state at that point in time — who filled what, when, with what content hash.

### Combining all four features

A single document can use all features together:

```json
{
  "header": {
    "doc_type": "approval",
    "encryption": {
      "key_location": "remote",
      "key_auth": "bearer",
      "key_ttl": 604800
    },
    "access": {
      "mode": "time_lock",
      "unlock_at": "2026-04-01T09:00:00Z"
    },
    "quorum": {
      "required": 3,
      "on_quorum": { "action": "git_merge", "url": "https://api.github.com/repos/..." }
    },
    "git": {
      "repo": "https://github.com/example/contracts.git",
      "auto_commit": true
    }
  }
}
```

Result: an encrypted deployment authorization document, time-locked until the release window, requiring 3-of-5 approval, that merges to `main` when quorum is reached — with a full audit trail in Git.

---

## §5 Summary — Feature Matrix

| Feature | `header` field | Requires server? | Works offline? |
|---------|---------------|-----------------|----------------|
| Fragment key (existing) | `encryption.key_location: "url_fragment"` | No | Yes |
| Remote key / DRM | `encryption.key_location: "remote"` | Yes (key server) | Grace period only |
| Time-lock | `access.mode: "time_lock"` | Yes (NTP + key server) | No |
| Quorum voting | `quorum` | Yes (sign API) | Read-only |
| Git integration | `git` | Yes (Git API) | Read-only |
| Fill Providers | `fill.src` (slot) | Yes (provider) | Stale cache only |

All features are **additive** — documents without these fields behave exactly as defined in `POLYDOC_SPEC.md`.

---

---

## §6 Trusted Timestamp & Remote Notary

### The problem with self-reported time

A signer can set their system clock to any time. A signature with `signed_at: "2026-01-01"` proves nothing about when the document was actually signed — unless a trusted third party attests to it.

**RFC 3161 Trusted Timestamp Authority (TSA)** solves this: the TSA signs a token that cryptographically binds the document hash to the current time as observed by the TSA. The signer cannot forge this — they can only request it, and the TSA records it.

### Signature block with timestamp

```json
"signature": {
  "algorithm": "ES256",
  "value": "base64-es256-signature",
  "signed_at": "2026-03-21T10:14:33Z",
  "timestamp": {
    "authority": "https://tsa.digicert.com/tsa",
    "token": "base64-rfc3161-timestamp-token",
    "algorithm": "SHA256",
    "serial": "1234567890",
    "policy": "1.3.6.1.4.1.311.3.2.1"
  },
  "location": {
    "country": "CZ",
    "hint": "Prague HQ"
  }
}
```

| Field | Description |
|-------|-------------|
| `timestamp.authority` | TSA endpoint that issued the token |
| `timestamp.token` | Base64-encoded RFC 3161 TSTInfo structure |
| `timestamp.algorithm` | Hash algorithm used for the token (SHA256 recommended) |
| `timestamp.serial` | TSA-assigned serial number for this token |
| `location.country` | ISO 3166-1 alpha-2 country code (optional) |
| `location.hint` | Human-readable location hint (optional, not legally binding) |

### What the timestamp proves

The RFC 3161 token binds three things together, attested by the TSA's own certificate chain:
1. The exact document state (SHA256 of the document at signing time)
2. The precise UTC timestamp as observed by the TSA
3. The TSA's identity (verified via its certificate)

Even if the signer's private key is later compromised, the timestamp token independently proves the document existed in this exact state at this exact time.

Free TSAs that issue valid RFC 3161 tokens: DigiCert, GlobalSign, Sectigo, FreeTSA.

---

## §7 Remote Notary & Four-Eyes Principle

### Why technical DRM is not enough

Any technical protection can be defeated by a sufficiently motivated person with physical access to the decrypted output (screenshot, camera, notes). The goal of DRM is not to make extraction *impossible* — it is to make it *unambiguously attributable*.

**The combination that achieves this:**

```
TSA timestamp     → proves WHO signed, WHEN, in what document state
Four eyes         → requires conspiracy between at least two people to leak
Watermark         → traces any leak back to a specific person
Remote notary     → independent third-party certifies the entire transaction
```

No single person can claim "I didn't sign this" or "the document was different". No single person can leak without implicating themselves. The result is not technical impossibility — it is **legal non-repudiation**.

### Four-eyes quorum as DRM

The quorum system from §3 becomes a DRM enforcement mechanism when `required: 2`:

```json
"quorum": {
  "required": 2,
  "four_eyes": true,
  "participants": [
    { "id": "primary",  "key_hint": "sha256:...", "role": "Responsible Person" },
    { "id": "witness",  "key_hint": "sha256:...", "role": "Independent Witness" }
  ],
  "on_quorum": { "action": "unlock" }
}
```

`four_eyes: true` means both participants receive independent TSA timestamps and their signatures are bound together in a combined token. A leak now requires both people to cooperate — any unilateral leak is immediately attributable to whoever broke ranks.

### Remote notary declaration

```json
"notary": {
  "service": "https://notary.example.com",
  "jurisdiction": "CZ",
  "level": "qualified",
  "witnesses": ["primary", "witness"],
  "notary_token": "base64-notary-certification",
  "legal_ref": "eIDAS Regulation (EU) No 910/2014, Article 26"
}
```

| Field | Description |
|-------|-------------|
| `service` | Notary service endpoint |
| `jurisdiction` | Legal jurisdiction under which the notarisation is valid |
| `level` | `"simple"` / `"advanced"` / `"qualified"` (eIDAS LoA) |
| `witnesses` | Participant IDs from `quorum.participants` who are co-signers |
| `notary_token` | Notary-issued certification token |
| `legal_ref` | Applicable legal framework |

### eIDAS compliance levels

| Level | Equivalent to | Requirements |
|-------|--------------|--------------|
| `simple` | Basic electronic signature | Any digital identifier |
| `advanced` | Advanced Electronic Signature (AdES) | Unique to signer, detectable tampering, ES256 |
| `qualified` | Qualified Electronic Signature (QES) | Qualified TSA + qualified certificate + HSM |

`qualified` level is legally equivalent to a handwritten signature in all EU member states under eIDAS.

### The complete non-repudiation stack

```
1. Signer A signs → ES256 signature + RFC 3161 TSA timestamp
2. Signer B signs (four eyes) → ES256 signature + RFC 3161 TSA timestamp
3. Both signatures + both timestamps → submitted to remote notary
4. Notary issues certification token → stored in document manifest
5. Watermark embedded in rendered content → tied to Signer A's identity
6. Export lock active → PolyDoc.exportJSON() disabled
7. Key TTL enforced → document re-locks after 24h

Result:
  - WHO: cryptographically identified (ES256 key)
  - WHEN: RFC 3161 timestamp, TSA-attested
  - WHAT: SHA256 of exact document state at signing
  - WHERE: jurisdiction declared, notary certified
  - WHY impossible to deny: four eyes + notary token
  - WHY leak is traceable: watermark tied to identity
```

This is eIDAS Qualified Electronic Signature level — legally binding in all EU member states, and most jurisdictions globally that accept digital signatures.

---

## §8 Embedded Media & Applications

### Data that never leaves the envelope

HTML5 can render video, audio, and interactive applications directly from in-memory data using `URL.createObjectURL()`. The data is decoded from the envelope's `parts[]`, loaded into a temporary blob URL that exists only in browser memory, and revoked immediately after use.

```javascript
// Interpreter — playing a video part without writing to disk
const part = envelope.parts.find(p => p.id === 'training-video');
const raw = decrypt(decompress(part.data));  // in-memory only
const blob = new Blob([raw], { type: 'video/mp4' });
const url = URL.createObjectURL(blob);
videoElement.src = url;
videoElement.onended = () => URL.revokeObjectURL(url);  // gone from memory
```

The blob URL (`blob:https://...`) is scoped to the current tab and session. It cannot be bookmarked, shared, or accessed from another origin. When revoked, the data is released from memory. No file is written to disk by the interpreter.

### Supported embedded types

| MIME type | Rendering | Notes |
|-----------|-----------|-------|
| `video/mp4`, `video/webm` | `<video>` element via blob URL | Inline playback, no download |
| `audio/mpeg`, `audio/ogg`, `audio/wav` | `<audio>` element via blob URL | No download |
| `application/pdf` | PDF.js inline viewer | Rendered in canvas, not browser native PDF viewer |
| `text/html` | `<iframe sandbox>` | Sandboxed mini-application |
| `application/wasm` | WebAssembly runtime | Executable module inside the document |
| `image/*` | `<img>` tag | Already supported in v1.0 |
| `application/json` | Syntax-highlighted viewer | Already supported in v1.0 |

### Part declaration for embedded media

```json
{
  "id": "training-video",
  "type": "video/mp4",
  "label": { "en": "Module 3 — Security Fundamentals" },
  "encrypted": true,
  "compressed": true,
  "playback": {
    "inline": true,
    "allow_fullscreen": true,
    "allow_download": false,
    "allow_picture_in_picture": false,
    "max_plays": 3,
    "watermark": "user_email"
  }
}
```

| Field | Description |
|-------|-------------|
| `playback.inline` | Render in modal inside the document (vs. download prompt) |
| `playback.allow_download` | If `false`, no download button, blob URL not exposed |
| `playback.max_plays` | Key server refuses to issue key after N plays. `null` = unlimited |
| `playback.watermark` | Embed user identity into the rendered stream as a visible or steganographic watermark |

### WebAssembly embedded applications

A `application/wasm` part can be a fully functional application running inside the document — a calculator, a form, a viewer, a game, a CAD preview:

```json
{
  "id": "cad-viewer",
  "type": "application/wasm",
  "label": { "en": "Interactive floor plan viewer" },
  "encrypted": true,
  "wasm": {
    "entry": "viewer.wasm",
    "imports": { "env": "document-sandbox" },
    "canvas_id": "wasm-canvas",
    "allow_network": false,
    "allow_filesystem": false
  }
}
```

The WASM module runs in a sandboxed context — no network access, no filesystem, no access to the outer document's DOM beyond its declared canvas. The envelope is the container; the WASM module is the application.

### Combined DRM + embedded media

```
1. Video part encrypted with AES-256-GCM
2. User opens document → key fetched from key server (authenticated)
3. key_ttl: 7200 → key valid for 2 hours
4. max_plays: 5 → key server tracks play count
5. Video decoded in memory → blob URL → played in <video>
6. allow_download: false → no download button, blob URL not exposed to user
7. watermark: "user_email" → viewer's email burned into video stream
8. URL.revokeObjectURL() on close → data released from memory
9. After 2h or 5 plays → key server returns 403 → document re-locks
```

An attacker who captures the network traffic sees only the encrypted blob and the HTTPS key exchange. An attacker who captures the decrypted blob gets a watermarked copy that traces back to their account.

---

## §9 Summary — Feature Matrix

| Feature | `header` field | Requires server? | Works offline? |
|---------|---------------|-----------------|----------------|
| Fragment key (v1.0) | `encryption.key_location: "url_fragment"` | No | Yes |
| Remote key / DRM | `encryption.key_location: "remote"` | Yes (key server) | Grace period only |
| Export lock | `encryption.export_lock` | No | Yes |
| Time-lock | `access.mode: "time_lock"` | Yes (NTP + key server) | No |
| TSA timestamp | `signature.timestamp` | Yes (TSA, at sign time) | Yes (token embedded) |
| Four-eyes + notary | `quorum.four_eyes` + `notary` | Yes (notary service) | Read-only |
| Quorum voting | `quorum` | Yes (sign API) | Read-only |
| Git integration | `git` | Yes (Git API) | Read-only |
| Fill Providers | `fill.src` (slot) | Yes (provider) | Stale cache only |
| Embedded media | `playback` on part | No (data inline) | Yes |
| WASM application | `wasm` on part | No (data inline) | Yes |

All features are **additive** — documents without these fields behave exactly as defined in `POLYDOC_SPEC.md`.

---

*PolyDoc Workflow & Access Control v1.0 · MIT licence · 2026-03-21*
