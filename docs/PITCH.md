# Why PolyDoc Exists

*A pitch for people who care about documents, AI, and not depending on Microsoft.*

---

## The Document Problem Nobody Is Solving

It's 2026. We have AI that writes code, generates images, runs businesses.
And we're still emailing PDF attachments.

The PDF was designed in 1993. It solved a real problem: print fidelity across devices.
But we don't primarily print anymore. We process. We automate. We feed data to systems.

**PDF is a photograph of a document. PolyDoc is the document itself.**

---

## The Three Broken Promises

### Promise 1: "Just use PDF"
PDF is static. You cannot update it. You cannot query it. You cannot make it react to payment status.
Your accounting bot needs to OCR it to read the invoice number. In 2026.

### Promise 2: "Just use DOCX"
DOCX is a ZIP file of XML files inside a proprietary schema that Microsoft has changed 14 times.
Try generating one without LibreOffice or a $500/year API. Try reading one programmatically without losing your mind.

### Promise 3: "Just use a web app"
Great. Your client doesn't have an account. Your email has a link. The link requires login.
The login requires a password reset because they haven't been there in 6 months.
The document is inside an app that's down for maintenance.

---

## The Insight

Every format makes you choose:
- **Human-readable** OR **machine-readable**
- **Static** OR **interactive**
- **Sendable** OR **online**
- **Open** OR **proprietary**

PolyDoc refuses every one of these tradeoffs.

A `.html` file is the most universal container that has ever existed.
Every device. Every OS. No installation. No account. No app store.

Put structured JSON inside it. Put a JavaScript renderer inside it.
Now you have a document that is simultaneously:
- A beautiful invoice you can print
- A machine-readable data object
- An interactive experience with live status
- An email attachment that passes every filter
- A transfer container for your entire project

---

## The DisplayPort Metaphor

Here's the clearest way to explain what PolyDoc Channel API does:

A graphics card doesn't know what monitor you have. It doesn't care.
It speaks HDMI or DisplayPort — a standard protocol — and the monitor handles the rest.

AI agents are the same. They shouldn't know whether your user wants a PDF, an app, an email.
They should speak one protocol — PolyDoc Channel — and the channel handles rendering.

```
AI Agent → POST /render → PolyDoc Channel → html_url for user
                                           → mail_html for email
                                           → signed JSON for archive
```

The AI just says "render this document." The channel figures out the rest.
This is what we mean by "DisplayPort for AI."

---

## The Firewall Problem (And the Solution)

Corporate IT blocks JavaScript in emails. Every modern email client does.
This is correct. JavaScript in email is a security nightmare.

So how do you get interactivity to users behind corporate firewalls?

**The PolyDoc answer:** Don't fight the firewall. Route around it.

1. Send a beautiful static email. Zero JavaScript. Passes every filter.
2. Include one button: "Open interactive document →"
3. Button links to your server where the full version lives.
4. User wants to confirm the order, check payment status, download the contract.
5. User asks IT to whitelist your domain.
6. IT cannot say no because the user is asking — not you.

The user becomes your advocate inside the company.
This is not a hack. This is understanding how organizations actually work.

---

## The AI-Native Document

When you paste a PDF into Claude, it OCRs it. Imperfectly.
When you paste a PolyDoc HTML file into Claude, it reads the JSON directly.
No OCR. No parsing errors. No lost decimal points.

Every PolyDoc document contains a machine-readable data object.
Not as a separate file. Not as a hidden attachment. Right there in the source.

LLMs can:
- Extract the invoice total without parsing a PDF
- Understand the document structure from the JSON schema
- Generate a new document by calling the Channel API
- Transfer an entire project configuration as context

The `x-ai-instructions` field in the OpenAPI spec is a direct message to the LLM:
*"Here is how you use this channel. Here is what each endpoint does. Here is the workflow."*

No documentation. No prompt engineering. The spec is the prompt.

---

## Why Not Invent a New Extension?

We could call it `.poly` or `.pdoc` or `.opendoc`.

We didn't.

`.html` works in:
- Every email client (as attachment)
- Every browser (native rendering)
- Every file manager (preview)
- Every CDN (correct MIME type)
- Every LLM context window (as text)
- Every corporate firewall rule (it's just HTML)

A new extension requires: MIME type registration, OS associations, browser plugins, corporate whitelist updates, user education.

`.html` requires nothing.

The best format is the one that works everywhere, right now, without asking IT for permission.

---

## Who This Is For

**Developers** building document workflows — invoicing, contracts, confirmations, reports.
Stop generating PDFs. Start generating PolyDocs.

**AI builders** connecting LLMs to user-facing documents.
Give your agent the Channel API OpenAPI spec. Done.

**IS/ERP developers** who need to move data between systems.
The Transfer format is a signed, versioned, inspectable container for anything.

**Anyone** who sends business documents by email and wants them to be beautiful, trackable, interactive, and machine-readable.

---

## What Success Looks Like

In two years, someone sends an invoice.
Their client's accounting system reads it automatically — no OCR, no re-entry.
The client clicks "Pay" directly in the document.
The sender's IS gets a webhook.
Both parties have a cryptographically signed record.

No PDF. No DOCX. No portal login.
Just a `.html` file that contains everything.

That's the goal.

---

*PolyDoc is open. MIT license. Build on it.*  
*Spec: [POLYDOC_SPEC.md](../spec/POLYDOC_SPEC.md)*  
*Channel API: [openapi.yaml](../spec/openapi.yaml)*
