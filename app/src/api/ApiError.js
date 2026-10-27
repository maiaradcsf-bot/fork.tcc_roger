export class ApiError extends Error {
  constructor(message, { status = 0, code = null, data = null, isNetworkError = false, isTimeout = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
    this.isNetworkError = isNetworkError;
    this.isTimeout = isTimeout;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isConflict() {
    return this.status === 409;
  }

  get isValidationError() {
    return this.status === 400;
  }
}
