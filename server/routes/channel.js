import { Router } from 'express';

const router = Router();

router.get('/polydoc-channel', (_req, res) => {
  res.json({
    channel: 'polydoc-render-engine',
    version: '1.0.0',
    spec_version: 'poly/1.0',
    base_url: process.env.BASE_URL || 'http://localhost:3000',
    capabilities: [
      'render_full',
      'render_mail',
      'validate',
      'schema_examples',
      'output_serve',
    ],
    supported_doc_types: [
      'invoice',
      'confirmation',
      'offer',
      'status_update',
    ],
    endpoints: {
      render: 'POST /render',
      validate: 'POST /validate',
      schema: 'GET /schema/:doc_type',
      output: 'GET /output/:filename',
      channel: 'GET /.well-known/polydoc-channel',
      health: 'GET /health',
    },
    ai_instructions: [
      'Send a valid PolyDoc JSON object to POST /render to get rendered HTML.',
      'The response includes html_url (full view served at /output/) and mail_html (inline string for email sending).',
      'Use POST /validate to check a PolyDoc before rendering without producing output.',
      'Use GET /schema/:doc_type to retrieve an example document for: invoice, confirmation, offer, status_update.',
      'All PolyDoc documents must include: header.format (poly/X.Y), doc_id, doc_type.',
      'Optionally include visuals.colors to apply a custom theme (CSS variables injected into :root).',
      'Output files are served statically from /output/{doc_id}-full.html.',
    ],
  });
});

export default router;
