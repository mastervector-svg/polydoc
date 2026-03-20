import * as vscode from 'vscode';
import * as fs from 'fs';

/**
 * WebviewPanel that renders a PolyDoc file (document or envelope) directly in VS Code.
 * The HTML is served with a relaxed CSP so the embedded interpreter can run.
 */
export class PolyDocPreviewPanel {
  static currentPanel: PolyDocPreviewPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static createOrShow(extensionUri: vscode.Uri, fileUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (PolyDocPreviewPanel.currentPanel) {
      PolyDocPreviewPanel.currentPanel.panel.reveal(column);
      PolyDocPreviewPanel.currentPanel.update(fileUri);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'polydocPreview',
      'PolyDoc Preview',
      column ?? vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
        retainContextWhenHidden: true,
      }
    );

    PolyDocPreviewPanel.currentPanel = new PolyDocPreviewPanel(panel, fileUri);
  }

  private constructor(panel: vscode.WebviewPanel, fileUri: vscode.Uri) {
    this.panel = panel;
    this.update(fileUri);

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Handle messages from the webview (e.g. slot fill requests)
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'fillSlot':
            vscode.commands.executeCommand('polydoc.fillSlot', message.slotId);
            break;
          case 'openExternal':
            vscode.env.openExternal(vscode.Uri.parse(message.url));
            break;
        }
      },
      null,
      this.disposables
    );
  }

  private update(fileUri: vscode.Uri) {
    try {
      const html = fs.readFileSync(fileUri.fsPath, 'utf-8');
      const filename = fileUri.fsPath.split('/').pop() ?? 'document';

      // Inject VS Code bridge script before </body>
      const bridge = `
<script>
(function() {
  const vscode = acquireVsCodeApi();
  // Intercept slot fill buttons → send to extension
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-slot-id]');
    if (btn) {
      vscode.postMessage({ command: 'fillSlot', slotId: btn.dataset.slotId });
      e.preventDefault();
    }
  });
  // Intercept external links
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="http"]');
    if (a && !a.dataset.internal) {
      vscode.postMessage({ command: 'openExternal', url: a.href });
      e.preventDefault();
    }
  });
})();
</script>`;

      this.panel.title = `PolyDoc: ${filename}`;
      this.panel.webview.html = html.replace('</body>', bridge + '</body>');
    } catch (err) {
      this.panel.webview.html = `<html><body style="padding:24px;font-family:sans-serif">
        <h2>Error loading PolyDoc</h2><pre>${err}</pre></body></html>`;
    }
  }

  dispose() {
    PolyDocPreviewPanel.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
