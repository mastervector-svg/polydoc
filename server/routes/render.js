import { Router } from 'express';
import { writeFile, mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { validatePolyDoc, renderFull, renderMail } from '../engine.js';

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');

router.post('/', async (req, res, next) => {
  try {
    const body = req.body;

    // Validate
    const { valid, errors } = validatePolyDoc(body);
    if (!valid) {
      return res.status(400).json({ ok: false, errors });
    }

    const { doc_id, doc_type } = body;

    // Render both views
    const [fullHtml, mailHtml] = await Promise.all([
      renderFull(body),
      renderMail(body),
    ]);

    // Ensure output directory exists
    await mkdir(OUTPUT_DIR, { recursive: true });

    // Save full HTML to disk
    const filename = `${doc_id}-full.html`;
    const outputPath = join(OUTPUT_DIR, filename);
    await writeFile(outputPath, fullHtml, 'utf-8');

    return res.json({
      ok: true,
      doc_id,
      doc_type,
      html_url: `/output/${filename}`,
      mail_html: mailHtml,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
