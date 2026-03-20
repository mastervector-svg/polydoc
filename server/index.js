import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import renderRouter from './routes/render.js';
import validateRouter from './routes/validate.js';
import schemaRouter from './routes/schema.js';
import channelRouter from './routes/channel.js';
import outputRouter from './routes/output.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Security & middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/render', renderRouter);
app.use('/validate', validateRouter);
app.use('/schema', schemaRouter);
app.use('/.well-known', channelRouter);
app.use('/output', outputRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'polydoc-render-engine', version: '1.0.0' });
});

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Not found' });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[PolyDoc Error]', err);
  res.status(500).json({ ok: false, error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`PolyDoc Render Engine listening on port ${PORT}`);
});
