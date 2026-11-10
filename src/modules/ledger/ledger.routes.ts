import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { getAccountLedgerHandler, verifyAccountAuditHandler } from './ledger.controller.js';

const router = Router();

router.use(authenticate);

router.get('/accounts/:accountId', getAccountLedgerHandler);
router.get('/accounts/:accountId/audit', verifyAccountAuditHandler);

export default router;

