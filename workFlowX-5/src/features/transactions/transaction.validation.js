import { z } from 'zod';

// schema for creating a transactions
export const createTransactionSchema = z.object({
    type: z.enum(['income', 'expense'], { errorMap: () => ({ message: 'Type must be either income or expense' }) }),
    amount: z.number({ required_error: 'Amount is required' })
        .positive('Amount must be greater than 0'),
    category: z.string()
        .trim()
        .min(2, 'Category must be at least 2 characters')
        .max(50, 'Category must be less than 50 characters')
        .toLowerCase(),
    description: z.string()
        .trim()
        .max(500,)
        .optional(),
    date: z.coerce.date({ invalid_type_error: 'Date must be valid date' })
        .optional()
        .default(() => new Date()),
    project: z.string()
        .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Project Id format')
        .nullable()
        .optional()
})

export const updateTransactionSchema = createTransactionSchema.partial()
    .refine((data) => Object.keys(data).length > 0, { message: 'You must provide at least one field to update' });

// .refine((data) => Object.keys(data).length > 0, ...):
// Because .partial() makes everything optional, a user could technically send a completely empty object ({}). .refine() steps in to prevent this by running a custom JavaScript check:
// 	1 (data): This is the object being validated (e.g., req.body).
// 	2 Object.keys(data): This extracts all the keys/properties the user sent into an array. If they sent { amount: 100 }, it returns ['amount']. If they sent {}, it returns [].
// 	3 .length > 0: This checks the size of that array. If the length is 0, the check fails.


// schema for validating transaction id parameter 
export const transactionIdParamSchema = z.object({
    id: z.string()
        .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Transaction id format')

})