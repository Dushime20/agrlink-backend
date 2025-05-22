import CustomError from "./CustomError";
export class BadRequestError extends CustomError {
    constructor(message = "Resource not found") {
        super(message, 400); // Pass the status code directly
    }
}