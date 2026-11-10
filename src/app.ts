import express from 'express';
import { correlationIdMiddleware } from './middleware/correlation.middleware.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import accountRouter from './modules/accounts/account.routes.js';
import authRouter from './modules/auth/auth.routes.js';
import healthRouter from './modules/health/health.routes.js';
import ledgerRouter from './modules/ledger/ledger.routes.js';
import paymentRouter from './modules/payments/payment.routes.js';
import reconciliationRouter from './modules/reconciliation/reconciliation.routes.js';
import webhookRouter from './modules/webhooks/webhook.routes.js';

const app = express();

app.use(express.json());
app.use(correlationIdMiddleware);

// Health & Readiness probes
app.use(healthRouter);

app.get('/', (req, res) => {
  res.json({
    name: 'PayFlow API',
    version: '1.0.0',
    status: 'running',
  });
});

// API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/accounts', accountRouter);
app.use('/api/v1/payments', paymentRouter);
app.use('/api/v1/ledger', ledgerRouter);
app.use('/api/v1/webhooks', webhookRouter);
app.use('/api/v1/reconciliation', reconciliationRouter);

// 404 and Centralized Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
