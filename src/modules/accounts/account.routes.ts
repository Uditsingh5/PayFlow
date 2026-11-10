import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { depositFundsHandler } from '../payments/payment.controller.js';
import { depositFundsSchema } from '../payments/payment.schema.js';
import {
  createAccountHandler,
  getAccountHandler,
  listAccountsHandler,
} from './account.controller.js';
import { createAccountSchema } from './account.schema.js';

const router = Router();

router.use(authenticate);

router.post('/', validateBody(createAccountSchema), createAccountHandler);
router.get('/', listAccountsHandler);
router.get('/:id', getAccountHandler);
router.post('/:id/deposit', validateBody(depositFundsSchema), depositFundsHandler);

export default router;
