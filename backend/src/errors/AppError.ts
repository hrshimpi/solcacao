export class AppError extends Error {
  code: string;
  status: number;
  details: unknown[];

  constructor(code: string, status = 400, message = code, details: unknown[] = []) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
