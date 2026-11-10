import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import {
  createEndpointHandler,
  deleteEndpointHandler,
  listEndpointsHandler,
} from './webhook.controller.js';
import { createWebhookEndpointSchema } from './webhook.schema.js';

const router = Router();

router.use(authenticate);

router.post('/', validateBody(createWebhookEndpointSchema), createEndpointHandler);
router.get('/', listEndpointsHandler);
router.delete('/:id', deleteEndpointHandler);

export default router;
