import { Router } from 'express';
import * as paymentController from './payments.controller.js';
import { authenticateUser } from '../auth/auth.middleware.js';

const router = Router();

router.use(authenticateUser);

router.post('/', paymentController.processPayment);

export default router;