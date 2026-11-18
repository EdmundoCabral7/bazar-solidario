/** Formato padrão de erro da API: { error: { code, message, details? } } */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
