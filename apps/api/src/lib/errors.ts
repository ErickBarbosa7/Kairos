export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const unauthorized = (msg = "No autenticado") => new HttpError(401, msg, "unauthorized");
export const forbidden = (msg = "Sin permiso") => new HttpError(403, msg, "forbidden");
export const notFound = (msg = "No encontrado") => new HttpError(404, msg, "not_found");
export const conflict = (msg: string) => new HttpError(409, msg, "conflict");
