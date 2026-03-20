import * as vscode from 'vscode';
import { EnvelopeProvider, EnvelopeSlotItem } from './envelopeProvider';
import { PolyDocPreviewPanel } from './previewPanel';
import { fillSlotFromWorkspace, packEnvelope, addFileToEnvelope } from './envelopeActions';
import { ScheduledFillManager } from './scheduledFill';

export function activate(context: vscode.ExtensionContext) {
  console.log('PolyDoc extension activated');

  // ── Tree view: Envelopes in workspace ──────────────────────────
  const envelopeProvider = new EnvelopeProvider(vscode.workspace.workspaceFolders);
  const treeView = vscode.window.createTreeView('polydocEnvelopes', {
    treeDataProvider: envelopeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // Refresh tree when files change
  const watcher = vscode.workspace.createFileSystemWatcher('**/*.html');
  watcher.onDidChange(() => envelopeProvider.refresh());
  watcher.onDidCreate(() => envelopeProvider.refresh());
  watcher.onDidDelete(() => envelopeProvider.refresh());
  context.subscriptions.push(watcher);

  // ── Scheduled fill manager ─────────────────────────────────────
  const scheduledFill = new ScheduledFillManager(context);
  context.subscriptions.push(scheduledFill);

  // ── Commands ───────────────────────────────────────────────────

  // Preview PolyDoc document
  context.subscriptions.push(
    vscode.commands.registerCommand('polydoc.preview', async (uri?: vscode.Uri) => {
      const target = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (!target) {
        vscode.window.showErrorMessage('No PolyDoc file selected.');
        return;
      }
      PolyDocPreviewPanel.createOrShow(context.extensionUri, target);
    })
  );

  // Fill a single slot from workspace file picker
  context.subscriptions.push(
    vscode.commands.registerCommand('polydoc.fillSlot', async (item?: EnvelopeSlotItem) => {
      if (!item) {
        vscode.window.showErrorMessage('Select a slot from the PolyDoc Envelopes panel.');
        return;
      }
      await fillSlotFromWorkspace(item, context);
      envelopeProvider.refresh();
    })
  );

  // Fill all slots assigned to this user
  context.subscriptions.push(
    vscode.commands.registerCommand('polydoc.fillAllSlots', async (item?: EnvelopeSlotItem) => {
      const envelopeUri = item?.envelopeUri ?? vscode.window.activeTextEditor?.document.uri;
      if (!envelopeUri) return;

      const slots = envelopeProvider.getSlotsForEnvelope(envelopeUri);
      if (slots.length === 0) {
        vscode.window.showInformationMessage('No slots assigned to you in this envelope.');
        return;
      }

      const results = await Promise.allSettled(
        slots.map(slot => fillSlotFromWorkspace(slot, context))
      );
      const filled = results.filter(r => r.status === 'fulfilled').length;
      vscode.window.showInformationMessage(`Filled ${filled}/${slots.length} slots.`);
      envelopeProvider.refresh();
    })
  );

  // Refresh a single on-demand slot
  context.subscriptions.push(
    vscode.commands.registerCommand('polydoc.refreshSlot', async (item?: EnvelopeSlotItem) => {
      if (!item?.fillSrc) {
        vscode.window.showErrorMessage('Slot has no fill.src URL configured.');
        return;
      }
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Refreshing ${item.label}…` },
        async () => {
          const response = await fetch(item.fillSrc!);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.text();
          await applyFillToEnvelope(item, Buffer.from(data).toString('base64'), context);
        }
      );
      envelopeProvider.refresh();
    })
  );

  // Pack envelope from workspace files
  context.subscriptions.push(
    vscode.commands.registerCommand('polydoc.packEnvelope', async () => {
      await packEnvelope(context);
      envelopeProvider.refresh();
    })
  );

  // Right-click on any file → Add to Envelope
  context.subscriptions.push(
    vscode.commands.registerCommand('polydoc.addToEnvelope', async (uri: vscode.Uri) => {
      await addFileToEnvelope(uri, context);
    })
  );

  // ── Context key: are there any envelopes in workspace? ─────────
  updateContextKey(envelopeProvider);
  envelopeProvider.onDidChangeTreeData(() => updateContextKey(envelopeProvider));
}

async function applyFillToEnvelope(
  item: EnvelopeSlotItem,
  base64Data: string,
  _context: vscode.ExtensionContext
) {
  const config = vscode.workspace.getConfiguration('polydoc');
  const serverUrl = config.get<string>('serverUrl', 'http://localhost:3000');

  const response = await fetch(`${serverUrl}/envelope/${item.docId}/fill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slot_id: item.slotId,
      data: base64Data,
      compressed: false,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error((err as any).error || response.statusText);
  }

  vscode.window.showInformationMessage(`✅ Slot "${item.label}" filled successfully.`);
}

function updateContextKey(provider: EnvelopeProvider) {
  vscode.commands.executeCommand(
    'setContext',
    'polydoc.hasEnvelopes',
    provider.hasEnvelopes()
  );
}

export function deactivate() {}
