/**
 * Error Handler Middleware
 * 
 * Centralized Express error handling for consistent error responses.
 */

/**
 * Express error handling middleware
 * Place at the end of middleware chain after all routes
 */
export function errorHandler(err, req, res, next) {
    console.error(`[${req.method}] ${req.path}:`, err);

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal server error";

    // Don't leak internal error details in production
    const response = {
        error: message,
        ...(process.env.NODE_ENV === "development" && { stack: err.stack })
    };

    res.status(status).json(response);
}

/**
 * Async route wrapper - catches errors and forwards to error handler
 * @param {Function} fn - Async route handler
 * @returns {Function} Wrapped route handler
 */
export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Create an HTTP error with status code
 * @param {number} status - HTTP status code
 * @param {string} message - Error message
 * @returns {Error} Error with status property
 */
export function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}
