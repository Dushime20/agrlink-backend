import CustomError from "./CustomError";
export class NotFoundError extends CustomError {
    constructor(message = "Not found error") {
        super(message,404);
       
    }
}