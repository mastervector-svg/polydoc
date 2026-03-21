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

*PolyDoc Workflow & Access Control v1.0 · MIT licence · 2026-03-21*
