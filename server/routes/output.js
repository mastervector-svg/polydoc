import { Router } from 'express';
import { createReadStream, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');

router.get('/:filename', (req, res) => {
  // Sanitize filename — strip any path traversal attempts
  const filename = basename(req.params.filename);
  const filePath = join(OUTPUT_DIR, filename);

  if (!existsSync(filePath)) {
    return res.status(404).json({ ok: false, error: `File not found: ${filename}` });
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  createReadStream(filePath).pipe(res);
});

export default router;
