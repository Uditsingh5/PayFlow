import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { getReconciliationReportHandler } from './reconciliation.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', getReconciliationReportHandler);

export default router;
