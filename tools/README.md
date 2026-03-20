# PolyDoc Tools

Planned CLI and tooling for PolyDoc.

---

## Planned: `@polydoc/cli`

```bash
npx polydoc render invoice.json --template full --output invoice.html
npx polydoc validate invoice.html
npx polydoc transfer --input ./project --output snapshot.html --sign
npx polydoc extract snapshot.html --type agent_config --output ./agents/
```

## Planned: `@polydoc/transfer`

```javascript
import { PolyDocTransfer } from '@polydoc/transfer';

const t = await PolyDocTransfer.load('snapshot.html');
await t.verify();
const agents = t.getByType('agent_config');
```

## Planned: Validators

- JSON Schema for `PolyDocument`
- JSON Schema for `TransferDocument`
- XSS check for `rich_text` sections

---

*Contributions welcome — see [CONTRIBUTING.md](../CONTRIBUTING.md)*
