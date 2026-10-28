import { z } from 'zod';
import { JOB_TYPES } from './jobs.model.js';
import AppError from '../../utils/appError.js';

export const createJobSchema = z.object({
    type: z.enum([JOB_TYPES.REPORT_GENERATION, JOB_TYPES.DATA_EXPORT],
        {
            errorMap: () => ({ message: `Invalid job type. Available: ${JOB_TYPES.REPORT_GENERATION},${JOB_TYPES.DATA_EXPORT}` })
        }

        //• (): This function takes no arguments (though Zod errorMap functions usually accept (issue, ctx), they can be left empty if the arguments aren't needed).
        //• ({ ... }): The parentheses around the curly braces force JavaScript to treat the braces as an object literal rather than a function body. This allows the function to implicitly and immediately return the object without needing the return keyword.

    ),
    payload: z.record(z.any()).default({}),
    delaySeconds: z.number().int().positive().max(7 * 24 * 3600).optional(), // Optional: delay up to 7 days
})

export const validate=(schema)=>(req,res,next)=>{
    const result=schema.safeParse(req.body);

    if(!result.success){
        const errorMessage=result.error.issues.map((issue)=>issue.message).join(',')

        return next(new AppError(errorMessage,400))
    }
    req.body=result.data
    next();
}