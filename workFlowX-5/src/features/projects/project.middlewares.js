import AppError from "../../utils/appError.js";


// middleware to validate req.body against a Zod schema
export const validateBody=(schema)=>(req,res,next)=>{
    const result=schema.safeParse(req.body);

    if(!result.success){
        // collect all error from zod
        const errorMessage=result.error.issues.map((issue)=>issue.message).join(',')

        return next(new AppError(errorMessage,400))
    }

    //replace req.body with sanitized and coerced data from zod
    req.body=result.data;
    next()
}

// middleware to validate req.params against a zod schema
export const validateParams=(schema)=>(req,res,next)=>{
    const result=schema.safeParse(req.params)

    if(!result.success){
        const errorMessage=result.error.issues.map((issue)=>issue.message).join(',')

        return next(new AppError(errorMessage,'400'))
    }

    req.params = result.data;
    next()
}


// export const validateBody = (schema) => (req, res, next) => {

// • This is a higher-order function (a function that returns another function).
// • It takes a Zod schema as an argument and returns a standard Express middleware function: (req, res, next) => { ... }.
// • This allows you to reuse this single function across different routes by just passing in different schemas (e.g., validateBody(createProjectSchema)).

