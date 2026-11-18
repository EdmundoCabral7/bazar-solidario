import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { requestContext } from '../lib/request-context';

export const CORRELATION_HEADER = 'x-correlation-id';

/** Usa o x-correlation-id recebido (ou gera um) e o devolve na resposta. */
export const correlationId: RequestHandler = (req, res, next) => {
  const incoming = req.header(CORRELATION_HEADER);
  const id = incoming && /^[\w-]{1,128}$/.test(incoming) ? incoming : randomUUID();
  req.correlationId = id;
  res.setHeader(CORRELATION_HEADER, id);
  requestContext.run({ correlationId: id }, () => next());
};
