import CustomError from "./CustomError";

export class UnauthorizedError extends CustomError {
    constructor(message = "Unauthorized access") {
        super(message, 401);
    }
}