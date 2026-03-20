import { Router } from 'express';

const router = Router();

const SCHEMAS = {
  invoice: {
    header: { format: 'poly/1.0', created_at: '2025-01-01T00:00:00Z', lang: 'cs' },
    doc_id: 'inv-example-001',
    doc_type: 'invoice',
    meta: {
      title: 'Faktura 2025001',
      issuer: { name: 'Example s.r.o.', id_no: '12345678', vat_no: 'CZ12345678', address: 'Příkladná 1, 110 00 Praha 1' },
      recipient: { name: 'Klient a.s.', id_no: '87654321', address: 'Odběratelská 5, 602 00 Brno' },
      issue_date: '2025-01-01',
      due_date: '2025-01-15',
      invoice_number: '2025001',
    },
    items: [
      { description: 'Vývoj webové aplikace', quantity: 40, unit: 'hod', unit_price: 1500, vat_rate: 21, total: 60000 },
      { description: 'Hosting (1 rok)', quantity: 1, unit: 'ks', unit_price: 3600, vat_rate: 21, total: 3600 },
    ],
    totals: { subtotal: 63600, vat: 13356, total: 76956, currency: 'CZK' },
    payment: { method: 'bank_transfer', bank_account: '123456789/0800', vs: '2025001', ks: '0308' },
    visuals: {
      colors: { primary: '#1a56db', accent: '#e74c3c', background: '#ffffff', text: '#111827' },
    },
  },

  confirmation: {
    header: { format: 'poly/1.0', created_at: '2025-01-01T00:00:00Z', lang: 'cs' },
    doc_id: 'conf-example-001',
    doc_type: 'confirmation',
    meta: {
      title: 'Potvrzení objednávky #OBJ-2025-042',
      order_id: 'OBJ-2025-042',
      customer: { name: 'Jan Novák', email: 'jan.novak@example.com' },
      confirmed_at: '2025-01-10T14:30:00Z',
    },
    items: [
      { sku: 'PROD-001', name: 'Produkt Alpha', quantity: 2, unit_price: 499, total: 998 },
    ],
    totals: { subtotal: 998, shipping: 99, total: 1097, currency: 'CZK' },
    delivery: { method: 'courier', estimated_date: '2025-01-13', address: 'Doručovací 10, 130 00 Praha 3' },
    visuals: {
      colors: { primary: '#0e9f6e', accent: '#f59e0b', background: '#f9fafb', text: '#111827' },
    },
  },

  offer: {
    header: { format: 'poly/1.0', created_at: '2025-01-01T00:00:00Z', lang: 'cs' },
    doc_id: 'offer-example-001',
    doc_type: 'offer',
    meta: {
      title: 'Nabídka na vývoj systému',
      offer_number: 'NAB-2025-007',
      valid_until: '2025-02-01',
      issuer: { name: 'Dev Studio s.r.o.', contact: 'info@devstudio.cz' },
      recipient: { name: 'Potenciální klient s.r.o.' },
    },
    sections: [
      {
        title: 'Analýza a návrh',
        items: [
          { description: 'Analýza požadavků', hours: 20, rate: 1800, total: 36000 },
          { description: 'Technický návrh architektury', hours: 10, rate: 1800, total: 18000 },
        ],
      },
      {
        title: 'Implementace',
        items: [
          { description: 'Backend API (Node.js)', hours: 80, rate: 1500, total: 120000 },
          { description: 'Frontend (React)', hours: 60, rate: 1500, total: 90000 },
        ],
      },
    ],
    totals: { subtotal: 264000, vat: 55440, total: 319440, currency: 'CZK' },
    notes: 'Cena je platná 30 dní od data vydání nabídky. Fakturace po dokončení milníků.',
    visuals: {
      colors: { primary: '#7c3aed', accent: '#f59e0b', background: '#ffffff', text: '#1f2937' },
    },
  },

  status_update: {
    header: { format: 'poly/1.0', created_at: '2025-01-15T09:00:00Z', lang: 'cs' },
    doc_id: 'status-example-001',
    doc_type: 'status_update',
    meta: {
      title: 'Týdenní status report — Sprint 5',
      project: 'MaxCloud PCC',
      period: { from: '2025-01-06', to: '2025-01-12' },
      author: 'Tým vývoje',
    },
    summary: 'Sprint 5 dokončen na 85 %. Zbývají 2 úkoly přesunuté do Sprint 6.',
    progress: [
      { task: 'PCC: Audit stránka UI', status: 'done', note: 'Nasazeno na prod' },
      { task: 'PCC: Project roles', status: 'in_progress', note: 'Backend hotov, frontend zbývá' },
      { task: 'DarwinAFW: Luma v2', status: 'in_progress', note: 'Intent detection rozšířen' },
      { task: 'Fleet Agent: MQTT reconnect', status: 'todo', note: 'Přesun do Sprint 6' },
    ],
    metrics: { planned: 12, completed: 10, carry_over: 2, velocity: '83 %' },
    next_sprint: { focus: 'Project roles, Fleet Agent stabilizace', start: '2025-01-13' },
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
