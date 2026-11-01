import type { FastifyReply, FastifyRequest } from 'fastify';

export interface JwtPayload {
  sub: string;
  email: string;
}

/** preHandler that rejects unauthenticated requests with 401. */
export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'unauthorized' });
  }
}

export function currentUserId(req: FastifyRequest): string {
  const payload = req.user as JwtPayload | undefined;
  if (!payload?.sub) {
    throw new Error('currentUserId called without an authenticated request');
  }
  return payload.sub;
}
