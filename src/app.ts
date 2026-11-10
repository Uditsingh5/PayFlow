import express from 'express';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import authRouter from './modules/auth/auth.routes.js';

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello World!');
});

// API Routes
app.use('/api/v1/auth', authRouter);

// 404 and Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
