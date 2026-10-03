import { catchAsync } from '../../utils/catchAsync.js';
import { createTransactionService, deleteTransactionService, getAllTransactionsService, getTransactionByIdService, getTransactionSummaryService, updateTransactionService } from './transaction.service.js';

export const createTransaction = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const transaction = await createTransactionService(userId, req.body);
    
    res.status(201).json({
        status: 'success',
        message: 'Transaction created successfully',
        data: { transaction }
    });
});

export const getAllTransactions = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const result = await getAllTransactionsService(userId, req.query);

    res.status(200).json({
        status: 'success',
        ...result
    });
});

// get transactions summary
export const getTransactionSummary = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const summary = await getTransactionSummaryService(userId, req.query);

    res.status(200).json({
        status: 'success',
        data: summary
    });
});

export const getTransactionById = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const transactionId = req.params.id;
    const transaction = await getTransactionByIdService(userId, transactionId);

    res.status(200).json({
        status: 'success',
        data: { transaction }
    });
});

export const updateTransaction = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const transactionId = req.params.id;
    const transaction = await updateTransactionService(userId, transactionId, req.body);

    res.status(200).json({
        status: 'success',
        message: 'Transaction updated successfully',
        data: { transaction }
    });
});

export const deleteTransaction = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const transactionId = req.params.id;
    await deleteTransactionService(userId, transactionId);

    res.status(200).json({
        status: 'success',
        message: 'Transaction deleted successfully'
    });
});