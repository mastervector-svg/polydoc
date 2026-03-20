# PolyDoc VS Code Extension

Preview, pack, and fill PolyDoc envelopes directly from VS Code.

## Features

### Preview
Open any `.html` PolyDoc file → `PolyDoc: Preview Document` in the title bar.
Renders the full interactive document (or envelope) in a side panel.

### Envelope Slots panel
Sidebar shows all envelopes in your workspace that have unfilled slots.
Click a slot → pick a file from your workspace → fills it instantly.

```
📬 Deployment Package v1.2      2 slots to fill
   🔲 docker-compose.yml         text/yaml      [Click to fill]
   🔲 schema.sql                 text/x-sql     [Click to fill]

📬 Due Diligence Q1 2026        ✅ complete
```

### Pack Envelope
`PolyDoc: Pack Envelope from Workspace` — wizard:
1. Name your package
2. Pick files from workspace
3. Choose: embed now or create slot
4. Sends to PolyDoc server → saves HTML + JSON

### Add to Envelope
Right-click any file in Explorer → `PolyDoc: Add to Envelope`.
Picks an existing envelope and inserts the file.

### Scheduled Fills
Enable `polydoc.scheduledFillEnabled` → extension host checks cron schedules every minute.
Slots with `fill.mode: "scheduled"` auto-fetch from `fill.src` URL at the specified time.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `polydoc.serverUrl` | `http://localhost:3000` | PolyDoc render engine |
| `polydoc.keyHint` | `""` | Your SHA256 key hint for slot filtering |
| `polydoc.scheduledFillEnabled` | `false` | Enable cron-based auto-fill |
| `polydoc.autoDetect` | `true` | Auto-scan workspace for PolyDoc files |

## Offline mode

When the PolyDoc server is unavailable, fill operations patch the `.html` file directly.
The envelope JSON embedded in `<script type="application/poly+json">` is updated in place.

## Requirements

- PolyDoc render engine running locally (`docker run -p 3000:3000 ghcr.io/mastervector-svg/polydoc:latest`)
  — or just use offline mode for fill operations

## License

MIT
