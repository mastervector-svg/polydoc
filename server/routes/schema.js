import { Router } from 'express';

const router = Router();

const SCHEMAS = {
  invoice: {
    header: { format: 'poly/1.0', created_at: '2025-01-01T00:00:00Z', lang: 'en' },
    doc_id: 'inv-example-001',
    doc_type: 'invoice',
    meta: {
      title: 'Invoice 2025001',
      issuer: { name: 'Example Ltd.', id_no: '12345678', vat_no: 'GB12345678', address: 'Example St. 1, London EC1A 1BB' },
      recipient: { name: 'Client Corp.', id_no: '87654321', address: 'Client Ave. 5, Manchester M1 1AE' },
      issue_date: '2025-01-01',
      due_date: '2025-01-15',
      invoice_number: '2025001',
    },
    items: [
      { description: 'Web application development', quantity: 40, unit: 'hr', unit_price: 150, vat_rate: 20, total: 6000 },
      { description: 'Hosting (1 year)', quantity: 1, unit: 'pcs', unit_price: 360, vat_rate: 20, total: 360 },
    ],
    totals: { subtotal: 6360, vat: 1272, total: 7632, currency: 'USD' },
    payment: { method: 'bank_transfer', bank_account: 'GB29NWBK60161331926819', vs: '2025001', ks: '0308' },
    visuals: {
      colors: { primary: '#1a56db', accent: '#e74c3c', background: '#ffffff', text: '#111827' },
    },
  },

  confirmation: {
    header: { format: 'poly/1.0', created_at: '2025-01-01T00:00:00Z', lang: 'en' },
    doc_id: 'conf-example-001',
    doc_type: 'confirmation',
    meta: {
      title: 'Order Confirmation #ORD-2025-042',
      order_id: 'ORD-2025-042',
      customer: { name: 'John Smith', email: 'john.smith@example.com' },
      confirmed_at: '2025-01-10T14:30:00Z',
    },
    items: [
      { sku: 'PROD-001', name: 'Product Alpha', quantity: 2, unit_price: 49.99, total: 99.98 },
    ],
    totals: { subtotal: 99.98, shipping: 9.99, total: 109.97, currency: 'USD' },
    delivery: { method: 'courier', estimated_date: '2025-01-13', address: '10 Delivery Rd, New York NY 10001' },
    visuals: {
      colors: { primary: '#0e9f6e', accent: '#f59e0b', background: '#f9fafb', text: '#111827' },
    },
  },

  offer: {
    header: { format: 'poly/1.0', created_at: '2025-01-01T00:00:00Z', lang: 'en' },
    doc_id: 'offer-example-001',
    doc_type: 'offer',
    meta: {
      title: 'System Development Proposal',
      offer_number: 'PROP-2025-007',
      valid_until: '2025-02-01',
      issuer: { name: 'Dev Studio Ltd.', contact: 'info@devstudio.example' },
      recipient: { name: 'Potential Client Ltd.' },
    },
    sections: [
      {
        title: 'Analysis & Design',
        items: [
          { description: 'Requirements analysis', hours: 20, rate: 180, total: 3600 },
          { description: 'Technical architecture design', hours: 10, rate: 180, total: 1800 },
        ],
      },
      {
        title: 'Implementation',
        items: [
          { description: 'Backend API (Node.js)', hours: 80, rate: 150, total: 12000 },
          { description: 'Frontend (React)', hours: 60, rate: 150, total: 9000 },
        ],
      },
    ],
    totals: { subtotal: 26400, vat: 5280, total: 31680, currency: 'USD' },
    notes: 'Price is valid for 30 days from issue date. Invoiced upon milestone completion.',
    visuals: {
      colors: { primary: '#7c3aed', accent: '#f59e0b', background: '#ffffff', text: '#1f2937' },
    },
  },

  status_update: {
    header: { format: 'poly/1.0', created_at: '2025-01-15T09:00:00Z', lang: 'en' },
    doc_id: 'status-example-001',
    doc_type: 'status_update',
    meta: {
      title: 'Weekly Status Report — Sprint 5',
      project: 'PolyDoc Platform',
      period: { from: '2025-01-06', to: '2025-01-12' },
      author: 'Dev Team',
    },
    summary: 'Sprint 5 completed at 85%. 2 tasks carried over to Sprint 6.',
    progress: [
      { task: 'Audit page UI', status: 'done', note: 'Deployed to prod' },
      { task: 'Project roles', status: 'in_progress', note: 'Backend done, frontend remaining' },
      { task: 'Fill Providers mock', status: 'in_progress', note: 'ARES connector in review' },
      { task: 'Fleet Agent MQTT reconnect', status: 'todo', note: 'Moved to Sprint 6' },
    ],
    metrics: { planned: 12, completed: 10, carry_over: 2, velocity: '83%' },
    next_sprint: { focus: 'Project roles, Fleet Agent stability', start: '2025-01-13' },
    visuals: {
      colors: { primary: '#0369a1', accent: '#16a34a', background: '#f0f9ff', text: '#0c1a2e' },
    },
  },
};

router.get('/:doc_type', (req, res) => {
  const { doc_type } = req.params;
  const schema = SCHEMAS[doc_type];
  if (!schema) {
    return res.status(404).json({
      ok: false,
      error: `Unknown doc_type: "${doc_type}"`,
      available: Object.keys(SCHEMAS),
    });
  }
  return res.json(schema);
});

export default router;
