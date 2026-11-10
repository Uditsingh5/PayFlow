import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import {
  createPaymentHandler,
  getPaymentHandler,
  refundPaymentHandler,
} from './payment.controller.js';
import { createPaymentSchema } from './payment.schema.js';

const router = Router();

router.use(authenticate);

router.post('/', validateBody(createPaymentSchema), createPaymentHandler);
router.get('/:id', getPaymentHandler);
router.post('/:id/refund', refundPaymentHandler);

export default router;

