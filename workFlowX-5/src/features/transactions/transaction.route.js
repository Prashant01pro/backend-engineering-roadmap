import express from 'express';
import { validateBody, validateParams } from './transaction.middlewares.js';
import { createTransactionSchema, updateTransactionSchema, transactionIdParamSchema } from './transaction.validation.js';
import { createTransaction, deleteTransaction, getAllTransactions, getTransactionById, getTransactionSummary, updateTransaction } from './transaction.controller.js';
import { authenticate } from '../auth/auth.middleware.js';

const router = express.Router();

router.use(authenticate)

// Specific static route MUST come before /:id
router.get('/summary', getTransactionSummary);

router.route('/')
    .get(getAllTransactions)
    .post(validateBody(createTransactionSchema), createTransaction);

router.route('/:id')
    .all(validateParams(transactionIdParamSchema)) // Validates :id for GET, PATCH, DELETE
    .get(getTransactionById)
    .patch(validateBody(updateTransactionSchema), updateTransaction)
    .delete(deleteTransaction);

export default router;