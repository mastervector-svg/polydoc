import * as vscode from 'vscode';

/**
 * Manages scheduled slot fills.
 * Parses cron expressions from slot.fill.schedule and triggers fills at the right time.
 * Lightweight: uses setInterval, checks every minute.
 */
export class ScheduledFillManager implements vscode.Disposable {
  private interval: NodeJS.Timeout | undefined;
  private lastCheck = new Date();

  constructor(private context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('polydoc');
    if (config.get<boolean>('scheduledFillEnabled', false)) {
      this.start();
    }

    // Watch config changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('polydoc.scheduledFillEnabled')) {
          const enabled = vscode.workspace.getConfiguration('polydoc')
            .get<boolean>('scheduledFillEnabled', false);
          if (enabled) this.start();
          else this.stop();
        }
      })
    );
  }

  private start() {
    if (this.interval) return;
    // Check every minute
    this.interval = setInterval(() => this.tick(), 60_000);
  }

  private stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  private async tick() {
    const now = new Date();
    const envelopes = await findScheduledEnvelopes();
    const config = vscode.workspace.getConfiguration('polydoc');
    const serverUrl = config.get<string>('serverUrl', 'http://localhost:3000');

    for (const { docId, slotId, src, schedule } of envelopes) {
      if (!shouldRun(schedule, this.lastCheck, now)) continue;

      try {
        const data = await fetch(src).then(r => r.text());
        await fetch(`${serverUrl}/envelope/${docId}/fill`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slot_id: slotId,
            data: Buffer.from(data).toString('base64'),
            compressed: false,
          }),
        });
        console.log(`[PolyDoc] Scheduled fill: ${docId}/${slotId} ✅`);
      } catch (err) {
        console.error(`[PolyDoc] Scheduled fill failed: ${docId}/${slotId}`, err);
      }
    }

    this.lastCheck = now;
  }

  dispose() {
    this.stop();
  }
}

interface ScheduledSlot {
  docId: string;
  slotId: string;
  src: string;
  schedule: string;
}

async function findScheduledEnvelopes(): Promise<ScheduledSlot[]> {
  const results: ScheduledSlot[] = [];
  const files = await vscode.workspace.findFiles('**/*.html', '**/node_modules/**');

  for (const file of files) {
    try {
      const bytes = await vscode.workspace.fs.readFile(file);
      const html = Buffer.from(bytes).toString('utf-8');
      const match = html.match(/<script[^>]+type="application\/poly\+json"[^>]*>([\s\S]*?)<\/script>/);
      if (!match) continue;

      const json = JSON.parse(match[1]);
      if (json?.header?.doc_type !== 'envelope') continue;

      for (const part of json?.manifest?.parts ?? []) {
        if (
          part.slot &&
          part.fill?.mode === 'scheduled' &&
          part.fill?.schedule &&
          part.fill?.src
        ) {
          results.push({
            docId: json.header.doc_id,
            slotId: part.id,
            src: part.fill.src,
            schedule: part.fill.schedule,
          });
        }
      }
    } catch {
      // skip
    }
  }

  return results;
}

/**
 * Minimal cron matcher — supports: "0 6 * * 1" style.
 * Fields: minute hour dom month dow
 * Only checks if cron would have fired between lastCheck and now.
 */
function shouldRun(cron: string, last: Date, now: Date): boolean {
  try {
    const fields = cron.trim().split(/\s+/);
    if (fields.length !== 5) return false;
    const [mF, hF, , , dowF] = fields;

    // Iterate minutes between last and now
    const cursor = new Date(last);
    cursor.setSeconds(0, 0);
    cursor.setMinutes(cursor.getMinutes() + 1);

    while (cursor <= now) {
      if (
        matches(cursor.getMinutes(), mF) &&
        matches(cursor.getHours(), hF) &&
        matches(cursor.getDay(), dowF)
      ) {
        return true;
      }
      cursor.setMinutes(cursor.getMinutes() + 1);
    }
    return false;
  } catch {
    return false;
  }
}

function matches(value: number, field: string): boolean {
  if (field === '*') return true;
  if (field.includes(',')) return field.split(',').some(f => matches(value, f.trim()));
  if (field.includes('-')) {
    const [lo, hi] = field.split('-').map(Number);
    return value >= lo && value <= hi;
  }
  if (field.includes('/')) {
    const [base, step] = field.split('/');
    const start = base === '*' ? 0 : Number(base);
    return value >= start && (value - start) % Number(step) === 0;
  }
  return value === Number(field);
}
