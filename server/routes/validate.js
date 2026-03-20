import { Router } from 'express';
import { validatePolyDoc } from '../engine.js';

const router = Router();

router.post('/', (req, res) => {
  const { valid, errors } = validatePolyDoc(req.body);
  return res.status(valid ? 200 : 400).json({ valid, errors });
});

export default router;
