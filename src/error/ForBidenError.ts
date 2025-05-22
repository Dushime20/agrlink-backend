import CustomError from "./CustomError";



export class ForbiddenError extends CustomError {
    constructor(message = "ForbiddenError") {
        super(message,403);
        
    }
}