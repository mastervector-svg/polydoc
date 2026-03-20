import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { EnvelopeSlotItem } from './envelopeProvider';

// ── Fill slot from workspace file picker ──────────────────────────────────────

export async function fillSlotFromWorkspace(
  item: EnvelopeSlotItem,
  context: vscode.ExtensionContext,
): Promise<void> {
  const config = vscode.workspace.getConfiguration('polydoc');
  const serverUrl = config.get<string>('serverUrl', 'http://localhost:3000');

  // If slot has workspace_hint, suggest it
  const hint = item.slotMeta.workspace_hint;
  let fileUri: vscode.Uri | undefined;

  // Try to find the file in workspace first
  if (hint) {
    const found = await vscode.workspace.findFiles(`**/${hint}`, '**/node_modules/**', 1);
    if (found.length > 0) {
      const pick = await vscode.window.showQuickPick(
        [
          { label: `$(file) ${hint}`, description: found[0].fsPath, uri: found[0] },
          { label: '$(folder-opened) Browse…', description: 'Pick a different file', uri: undefined },
        ],
        { placeHolder: `Fill slot "${item.label}" — select source file` }
      );
      if (!pick) return;
      fileUri = pick.uri;
    }
  }

  if (!fileUri) {
    const picked = await vscode.window.showOpenDialog({
      canSelectMany: false,
      openLabel: `Fill slot: ${item.label}`,
      title: `Select file for slot "${item.label}" (${item.slotMeta.type})`,
    });
    if (!picked?.length) return;
    fileUri = picked[0];
  }

  // Read file and send to server (or update envelope locally)
  const fileContent = fs.readFileSync(fileUri.fsPath);
  const base64 = fileContent.toString('base64');

  try {
    const response = await fetch(`${serverUrl}/envelope/${item.docId}/fill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slot_id: item.slotId,
        data: base64,
        compressed: false,
        filename: path.basename(fileUri.fsPath),
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as any).error ?? `HTTP ${response.status}`);
    }

    const result = await response.json() as any;
    const action = await vscode.window.showInformationMessage(
      `✅ Slot "${item.label}" filled from ${path.basename(fileUri.fsPath)}`,
      'Open Envelope',
    );
    if (action === 'Open Envelope' && result.html_url) {
      vscode.env.openExternal(vscode.Uri.parse(`${serverUrl}${result.html_url}`));
    }
  } catch (err: any) {
    // If server unavailable, patch envelope file locally
    if (err.message?.includes('ECONNREFUSED') || err.message?.includes('fetch')) {
      await fillSlotLocally(item, fileUri, fileContent);
    } else {
      vscode.window.showErrorMessage(`Fill failed: ${err.message}`);
    }
  }
}

// Patch the envelope HTML file directly when server is unavailable
async function fillSlotLocally(
  item: EnvelopeSlotItem,
  sourceUri: vscode.Uri,
  content: Buffer,
): Promise<void> {
  const envelopePath = item.envelopeUri.fsPath;
  const html = fs.readFileSync(envelopePath, 'utf-8');

  const scriptMatch = html.match(/<script[^>]+type="application\/poly\+json"[^>]*>([\s\S]*?)<\/script>/);
  if (!scriptMatch) {
    vscode.window.showErrorMessage('Could not parse envelope JSON.');
    return;
  }

  const envelope = JSON.parse(scriptMatch[1]);
  const base64 = content.toString('base64');
  const hash = await computeHash(content);

  // Update manifest slot state
  const manifestPart = envelope.manifest?.parts?.find((p: any) => p.id === item.slotId);
  if (manifestPart) {
    manifestPart.slot_state = 'filled';
    manifestPart.filled_at = new Date().toISOString();
    manifestPart.hash_at_fill = hash;
    manifestPart.size_stored = content.length;
  }

  // Add or replace in parts[]
  if (!envelope.parts) envelope.parts = [];
  const existingIdx = envelope.parts.findIndex((p: any) => p.id === item.slotId);
  const partEntry = { id: item.slotId, compressed: false, data: base64 };
  if (existingIdx >= 0) {
    envelope.parts[existingIdx] = partEntry;
  } else {
    envelope.parts.push(partEntry);
  }

  // Write back to HTML
  const newJson = JSON.stringify(envelope, null, 2);
  const newHtml = html.replace(
    /(<script[^>]+type="application\/poly\+json"[^>]*>)([\s\S]*?)(<\/script>)/,
    `$1\n${newJson}\n$3`
  );
  fs.writeFileSync(envelopePath, newHtml, 'utf-8');

  vscode.window.showInformationMessage(
    `✅ Slot "${item.label}" filled locally (server unavailable). File updated.`
  );
}

async function computeHash(data: Buffer): Promise<string> {
  const { createHash } = await import('crypto');
  return 'sha256:' + createHash('sha256').update(data).digest('hex');
}

// ── Pack envelope from workspace ──────────────────────────────────────────────

export async function packEnvelope(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration('polydoc');
  const serverUrl = config.get<string>('serverUrl', 'http://localhost:3000');

  // Step 1: name the package
  const label = await vscode.window.showInputBox({
    prompt: 'Envelope label (e.g. "Deployment Package v1.2")',
    placeHolder: 'My Package',
  });
  if (!label) return;

  // Step 2: pick files
  const files = await vscode.window.showOpenDialog({
    canSelectMany: true,
    openLabel: 'Add to Envelope',
    title: 'Select files to pack into envelope',
  });
  if (!files?.length) return;

  // Step 3: for each file, decide slot or embed
  const parts: any[] = [];
  const manifestParts: any[] = [];

  for (const fileUri of files) {
    const filename = path.basename(fileUri.fsPath);
    const mime = guessMime(filename);
    const isSlot = await vscode.window.showQuickPick(
      [
        { label: '$(package) Embed now', description: 'Include file content in envelope', value: false },
        { label: '$(circle-outline) Create slot', description: 'Recipient fills this part', value: true },
      ],
      { placeHolder: `${filename} — embed or slot?` }
    );
    if (!isSlot) continue;

    const asSlot = isSlot.value as boolean;

    manifestParts.push({
      id: filename.replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
      type: mime,
      label: { en: filename },
      ...(asSlot ? {
        slot: true,
        workspace_hint: filename,
        fill: { mode: 'manual' },
      } : {}),
    });

    if (!asSlot) {
      const content = fs.readFileSync(fileUri.fsPath);
      parts.push({
        id: filename.replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
        data: content.toString('base64'),
      });
    }
  }

  if (manifestParts.length === 0) {
    vscode.window.showErrorMessage('No files selected.');
    return;
  }

  // Step 4: send to server or bail
  try {
    const response = await fetch(`${serverUrl}/envelope`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        manifest: { label: { en: label }, parts: manifestParts },
        parts,
        options: { compress: true },
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json() as any;

    const action = await vscode.window.showInformationMessage(
      `📬 Envelope packed: ${result.doc_id} (${result.parts_count} parts)`,
      'Open in Browser',
      'Save JSON',
    );

    if (action === 'Open in Browser' && result.html_url) {
      vscode.env.openExternal(vscode.Uri.parse(`${serverUrl}${result.html_url}`));
    } else if (action === 'Save JSON' && result.envelope_json) {
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`${result.doc_id}.poly.json`),
        filters: { 'PolyDoc JSON': ['poly.json', 'json'] },
      });
      if (saveUri) {
        fs.writeFileSync(saveUri.fsPath, JSON.stringify(result.envelope_json, null, 2), 'utf-8');
        vscode.window.showInformationMessage(`Saved to ${saveUri.fsPath}`);
      }
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(
      `Pack failed: ${err.message}. Is the PolyDoc server running at ${serverUrl}?`
    );
  }
}

// ── Add file to existing envelope ─────────────────────────────────────────────

export async function addFileToEnvelope(fileUri: vscode.Uri, context: vscode.ExtensionContext): Promise<void> {
  // Find envelope files in workspace
  const envelopeFiles = await vscode.workspace.findFiles('**/*.html', '**/node_modules/**');
  const envelopes = envelopeFiles
    .map(f => ({ label: path.basename(f.fsPath), description: f.fsPath, uri: f }))
    .filter(f => {
      try {
        const html = fs.readFileSync(f.uri.fsPath, 'utf-8');
        return html.includes('application/poly+json') && html.includes('"envelope"');
      } catch { return false; }
    });

  if (envelopes.length === 0) {
    const create = await vscode.window.showInformationMessage(
      'No envelope files found. Create a new one?',
      'Pack Envelope',
    );
    if (create) vscode.commands.executeCommand('polydoc.packEnvelope');
    return;
  }

  const pick = await vscode.window.showQuickPick(envelopes, {
    placeHolder: 'Select envelope to add file to',
  });
  if (!pick) return;

  const filename = path.basename(fileUri.fsPath);
  const content = fs.readFileSync(fileUri.fsPath);
  const mime = guessMime(filename);
  const id = filename.replace(/[^a-z0-9-]/gi, '-').toLowerCase();

  const html = fs.readFileSync(pick.uri.fsPath, 'utf-8');
  const scriptMatch = html.match(/<script[^>]+type="application\/poly\+json"[^>]*>([\s\S]*?)<\/script>/);
  if (!scriptMatch) {
    vscode.window.showErrorMessage('Could not parse envelope.');
    return;
  }

  const envelope = JSON.parse(scriptMatch[1]);
  if (!envelope.manifest) envelope.manifest = { parts: [] };
  if (!envelope.parts) envelope.parts = [];

  // Add to manifest
  envelope.manifest.parts.push({ id, type: mime, label: { en: filename }, size_original: content.length });
  // Add to parts
  envelope.parts.push({ id, compressed: false, data: content.toString('base64') });

  const newJson = JSON.stringify(envelope, null, 2);
  const newHtml = html.replace(
    /(<script[^>]+type="application\/poly\+json"[^>]*>)([\s\S]*?)(<\/script>)/,
    `$1\n${newJson}\n$3`
  );
  fs.writeFileSync(pick.uri.fsPath, newHtml, 'utf-8');

  vscode.window.showInformationMessage(`✅ Added ${filename} to ${path.basename(pick.uri.fsPath)}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function guessMime(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    '.md': 'text/markdown', '.txt': 'text/plain', '.html': 'text/html',
    '.json': 'application/json', '.yaml': 'text/yaml', '.yml': 'text/yaml',
    '.pdf': 'application/pdf', '.zip': 'application/zip',
    '.tar': 'application/x-tar', '.gz': 'application/gzip',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.gif': 'image/gif',
    '.js': 'text/javascript', '.ts': 'text/typescript',
    '.sh': 'text/x-shellscript', '.py': 'text/x-python',
    '.sql': 'text/x-sql', '.env': 'text/plain',
  };
  return map[ext] ?? 'application/octet-stream';
}
