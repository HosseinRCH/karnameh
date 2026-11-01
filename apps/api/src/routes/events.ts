import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../env';
import { isMember } from '../lib/access';
import { onWorkspaceEvent } from '../lib/events';

/**
 * Server-Sent Events stream of workspace changes for cross-client realtime.
 * `EventSource` cannot set headers, so auth is passed as a query token.
 */
export async function eventRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { workspaceId?: string; token?: string } }>('/events', async (req, reply) => {
    const parsed = z
      .object({ workspaceId: z.string().uuid(), token: z.string().min(1) })
      .safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query' });

    let userId: string;
    try {
      userId = (app.jwt.verify(parsed.data.token) as { sub: string }).sub;
    } catch {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    if (!(await isMember(parsed.data.workspaceId, userId))) {
      return reply.code(403).send({ error: 'forbidden' });
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': env.corsOrigin,
    });
    reply.raw.write(': connected\n\n');

    const unsubscribe = onWorkspaceEvent((event) => {
      if (event.workspaceId !== parsed.data.workspaceId) return;
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    const keepAlive = setInterval(() => reply.raw.write(': ping\n\n'), 25_000);
    req.raw.on('close', () => {
      clearInterval(keepAlive);
      unsubscribe();
    });
    return reply;
  });
}
