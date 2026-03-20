import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface SlotMeta {
  id: string;
  label: string | { en?: string; cs?: string };
  type: string;
  slot: boolean;
  slot_state?: 'empty' | 'filled' | 'linked' | 'stale';
  assigned_to?: { key_hint: string };
  workspace_hint?: string;
  fill?: {
    mode: 'manual' | 'on-demand' | 'scheduled';
    src?: string;
    schedule?: string;
  };
}

export interface EnvelopeMeta {
  uri: vscode.Uri;
  docId: string;
  docType: string;
  label: string;
  slots: SlotMeta[];
  isSigned: boolean;
}

export class EnvelopeSlotItem extends vscode.TreeItem {
  constructor(
    public readonly envelopeUri: vscode.Uri,
    public readonly docId: string,
    public readonly slotId: string,
    label: string,
    public readonly slotMeta: SlotMeta,
    public readonly fillSrc?: string,
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    const state = slotMeta.slot_state ?? 'empty';
    this.description = slotMeta.type;
    this.tooltip = `Slot: ${slotId} · ${state}`;
    this.contextValue = `polySlot.${slotMeta.fill?.mode ?? 'manual'}.${state}`;

    // Icon per state
    this.iconPath = new vscode.ThemeIcon(
      state === 'filled' ? 'pass-filled' :
      state === 'stale'  ? 'warning' :
      state === 'linked' ? 'link'    : 'circle-outline'
    );

    // Click → fill slot
    this.command = {
      command: 'polydoc.fillSlot',
      title: 'Fill Slot',
      arguments: [this],
    };
  }
}

export class EnvelopeItem extends vscode.TreeItem {
  constructor(
    public readonly meta: EnvelopeMeta,
    emptySlots: number,
  ) {
    super(meta.label, vscode.TreeItemCollapsibleState.Expanded);
    this.description = emptySlots > 0 ? `${emptySlots} slots to fill` : '✅ complete';
    this.tooltip = `${meta.docId} · ${meta.docType}`;
    this.resourceUri = meta.uri;
    this.contextValue = 'polyEnvelope';
    this.iconPath = new vscode.ThemeIcon(emptySlots > 0 ? 'mail' : 'pass');
    this.command = {
      command: 'polydoc.preview',
      title: 'Preview',
      arguments: [meta.uri],
    };
  }
}

export class EnvelopeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private envelopes: EnvelopeMeta[] = [];

  constructor(private folders: readonly vscode.WorkspaceFolder[] | undefined) {
    this.scan();
  }

  refresh() {
    this.scan();
    this._onDidChangeTreeData.fire(undefined);
  }

  hasEnvelopes(): boolean {
    return this.envelopes.length > 0;
  }

  getSlotsForEnvelope(uri: vscode.Uri): EnvelopeSlotItem[] {
    const env = this.envelopes.find(e => e.uri.toString() === uri.toString());
    if (!env) return [];
    const myHint = vscode.workspace.getConfiguration('polydoc').get<string>('keyHint', '');
    return env.slots
      .filter(s => !myHint || !s.assigned_to || s.assigned_to.key_hint === myHint)
      .filter(s => (s.slot_state ?? 'empty') !== 'filled')
      .map(s => new EnvelopeSlotItem(
        env.uri, env.docId, s.id,
        resolveLabel(s.label), s, s.fill?.src
      ));
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (!element) {
      // Root: list envelopes
      return this.envelopes.map(env => {
        const emptySlots = env.slots.filter(s => (s.slot_state ?? 'empty') !== 'filled').length;
        return new EnvelopeItem(env, emptySlots);
      });
    }

    if (element instanceof EnvelopeItem) {
      const env = element.meta;
      const myHint = vscode.workspace.getConfiguration('polydoc').get<string>('keyHint', '');
      return env.slots
        .filter(s => !myHint || !s.assigned_to || s.assigned_to.key_hint === myHint)
        .map(s => new EnvelopeSlotItem(
          env.uri, env.docId, s.id,
          resolveLabel(s.label), s, s.fill?.src
        ));
    }

    return [];
  }

  private scan() {
    this.envelopes = [];
    if (!this.folders) return;

    for (const folder of this.folders) {
      this.scanFolder(folder.uri.fsPath);
    }
  }

  private scanFolder(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          this.scanFolder(fullPath);
        } else if (entry.name.endsWith('.html')) {
          const meta = tryParseEnvelope(fullPath);
          if (meta) this.envelopes.push(meta);
        }
      }
    } catch {
      // skip unreadable dirs
    }
  }
}

function tryParseEnvelope(filePath: string): EnvelopeMeta | null {
  try {
    const html = fs.readFileSync(filePath, 'utf-8');
    const match = html.match(/<script[^>]+type="application\/poly\+json"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) return null;

    const json = JSON.parse(match[1]);
    if (json?.header?.doc_type !== 'envelope') return null;
    if (!json?.manifest?.parts?.length) return null;

    const slots: SlotMeta[] = json.manifest.parts.filter((p: any) => p.slot === true);
    if (slots.length === 0) return null; // only show envelopes with slots

    return {
      uri: vscode.Uri.file(filePath),
      docId: json.header.doc_id ?? 'unknown',
      docType: json.header.doc_type,
      label: resolveLabel(json.manifest.label) || json.header.doc_id || path.basename(filePath),
      slots,
      isSigned: !!json.header.signature?.value,
    };
  } catch {
    return null;
  }
}

function resolveLabel(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  return val['en'] ?? val['cs'] ?? Object.values(val)[0] ?? '';
}
