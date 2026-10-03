import mongoose from 'mongoose';
import AppError from '../../utils/appError.js';
import { Project } from '../projects/project.model.js';
import { Transaction } from './transaction.model.js';

// create a new transaction service
//Verifies referenced project (if provided) belongs to the authenticated user

export const createTransactionService = async (userId, transactionData) => {
    if (transactionData.project) {
        const projectExists = await Project.findOne({ _id: transactionData.project, user: userId });
        if (!projectExists) {
            throw new AppError('Referenced project not found or does not belong to you', 404);
        }
    }

    const transaction = await Transaction.create({
        ...transactionData,
        user: userId
    })

    return transaction;
}

export const getAllTransactionsService = async (userId, query) => {
    const filter = { user: userId };

    // Filter by transaction type ('income' or 'expense')
    if (query.type) {
        filter.type = query.type;
    }

    if (query.category) {
        filter.category = query.category.toLowerCase();
    }
    // Filter by project (or standalone transactions: project=none)
    if (query.project === 'none' || query.project === 'null') {
        filter.project = null;
    } else if (query.project) {
        filter.project = query.project;
    }

    // Date Range Filtering (?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD)
    if (query.startDate || query.endDate) {
        filter.date = {};
        if (query.startDate) {
            filter.date.$gte = new Date(query.startDate);
        }
        if (query.endDate) {
            filter.date.$lte = new Date(query.endDate)
        }
    }

    //Search in description or category
    if (query.search) {
        filter.$or = [
            { description: { $regex: query.search, $options: 'i' } },
            { category: { $regex: query.search, $options: 'i' } }
        ];
    }

    const sortBy = query.sort ? query.sort.split(',').join(' ') : '-date -createdAt';

    // Pagination
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    // execute query and count in parallel
    const [transactions, totalTransactions] = await Promise.all([
        Transaction.find(filter)
            .populate('project', 'title status')
            .sort(sortBy)
            .skip(skip)
            .limit(limit),
        Transaction.countDocuments(filter)
    ])

    const totalPages = Math.ceil(totalTransactions / limit);

    return {
        transactions,
        pagination: {
            totalTransactions,
            totalPages,
            currentPage: page,
            limit,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    }
}

export const getTransactionByIdService = async (userId, transactionId) => {

    const transaction = await Transaction.findOne({ _id: transactionId, user: userId })
        .populate('project', 'title status');
    //In Mongoose, .populate() is a method used to automatically link documents across different collections, similar to a JOIN statement in SQL.

    if (!transaction) {
        throw new AppError('Transaction not found', 404);
    }
    return transaction;
};

export const updateTransactionService = async (userId, transactionId, updateData) => {
    if (updateData.project) {
        const projectExists = await Project.findOne({ _id: updateData.project, user: userId });
        if (!projectExists) {
            throw new AppError('Referenced project not found or does not belong to you', 404);
        }
    }

    const transaction = await Transaction.findOneAndUpdate(
        { _id: transactionId, user: userId },
        updateData,
        {
            returnDocument: 'after',
            runValidators: true
        }
    ).populate('project', 'title status');
    if (!transaction) {
        throw new AppError('Transaction not found', 404);
    }
    return transaction;
}

export const deleteTransactionService = async (userId, transactionId) => {
    const transaction = await Transaction.findOneAndDelete({ _id: transactionId, user: userId });
    if (!transaction) {
        throw new AppError('Transaction not found', 404);
    }
    return transaction;
};

// financial summary (aggregation pipeline)
// calculates total income, total expenses, net balance, and category breakdown 

export const getTransactionSummaryService = async (userId, query) => {
    const matchStage = { user: new mongoose.Types.ObjectId(userId) };

    // optional data filter for the summary
    if (query.startDate || query.endDate) {
        matchStage.date = {}
        if (query.startDate) matchStage.date.$gte = new Date(query.startDate)
        if (query.endDate) matchStage.date.$lte = new Date(query.endDate)
    }

    // overall income and expense totals
    // uses a MongoDB Aggregation Pipeline to calculate financial summaries. Instead of just fetching individual transaction rows, it tells the database to process, filter, and calculate totals directly on the server.
    // Think of an aggregation pipeline like an assembly line: data enters, passes through different stages (marked by $), and comes out as a finished calculation.
    const totals = await Transaction.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: '$type',
                totalAmount: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        }
    ]);

    //Step-by-Step Breakdown
    //Stage 1: { $match: matchStage } (The Filter)
    // • What it does: This acts like a standard Mongoose .find() query. It filters the database so only specific documents move down the assembly line.
    // • Example: Your matchStage variable likely looks something like { user: userId }. This ensures the database only calculates totals for this specific user, ignoring everyone else's transactions.
    //Stage 2: { $group: { ... } } (The Calculator)
    // This stage combines the filtered rows together based on a shared property and performs math on them.
    // • _id: '$type': This tells MongoDB how to split the data. The $ sign means "look at the type field in the document". Because transactions are usually either 'income' or 'expense', MongoDB will create two separate groups: one bucket for income data and one bucket for expense data.
    // • totalAmount: { $sum: '$amount' }: For every transaction inside a bucket, MongoDB looks at its amount field and adds it to a running total.
    // • count: { $sum: 1 }: For every document that falls into a bucket, MongoDB adds 1 to a counter. This tells you the total number of transactions in that category.

    let totalIncome = 0;
    let totalExpense = 0;

    totals.forEach((item) => {
        if (item._id === 'income') totalIncome = item.totalAmount;
        if (item._id === 'expense') totalExpense = item.totalAmount;
    })


    // This aggregation pipeline builds a spending breakdown by category, showing a user exactly where their money is going, sorted from their highest expense to lowest.
    // It uses a three-stage assembly line ($match \(\rightarrow \) $group \(\rightarrow \) $sort) to process the transaction documents in the database.
    // category breakdown for expenses
    const categoryBreakdown = await Transaction.aggregate([
        {
            $match: {
                ...matchStage,
                type: 'expense'
            }
        },
        {
            $group: {
                _id: '$category',
                totalSpent: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        },
        {
            $sort: { totalSpent: -1 }
        }
    ]);

    //     Step-by-Step Breakdown
    // Stage 1: { $match: { ...matchStage, type: 'expense' } } (The Filter)
    // • What it does: It filters the entire database to isolate only the target data.
    // • How it works: It spreads your existing filters (like user ID and date range from ...matchStage) and explicitly adds type: 'expense'. This guarantees that income transactions are ignored and do not skew your spending charts.
    // Stage 2: { $group: { _id: '$category', totalSpent: { $sum: '$amount' }, count: { $sum: 1 } } } (The Bucket Calculator)
    // • _id: '$category': Instead of grouping by transaction type, this separates documents into unique buckets based on their category field (e.g., 'food', 'rent', 'utilities').
    // • totalSpent: { $sum: '$amount' }: Sums up every transaction amount within each category bucket.
    // • count: { $sum: 1 }: Tracks the total number of transactions made in each category.
    // Stage 3: { $sort: { totalSpent: -1 } } (The Organizer)
    // • What it does: It sorts the resulting category buckets based on the calculated totalSpent field.
    // • The -1 value: This specifies a descending order (highest to lowest). If it were set to 1, it would sort from lowest to highest.

    return {
        totalIncome,
        totalExpense,
        netBalance: totalIncome - totalExpense,
        categoryBreakdown
    }
}