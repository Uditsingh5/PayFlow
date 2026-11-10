import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { getMeHandler, loginHandler, registerHandler } from './auth.controller.js';
import { loginSchema, registerSchema } from './auth.schema.js';

const router = Router();

router.post('/register', validateBody(registerSchema), registerHandler);
router.post('/login', validateBody(loginSchema), loginHandler);
router.get('/me', authenticate, getMeHandler);

export default router;
