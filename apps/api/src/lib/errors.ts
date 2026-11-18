/** Erro de aplicação com código estável e mensagem em pt-BR para o usuário. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }
  static unauthorized(message = 'Autenticação necessária') {
    return new AppError(401, 'UNAUTHORIZED', message);
  }
  static forbidden(message = 'Você não tem permissão para esta ação') {
    return new AppError(403, 'FORBIDDEN', message);
  }
  static notFound(message = 'Recurso não encontrado') {
    return new AppError(404, 'NOT_FOUND', message);
  }
  static conflict(message: string) {
    return new AppError(409, 'CONFLICT', message);
  }
}
