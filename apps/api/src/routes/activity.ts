import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, currentUserId } from '../lib/auth';
import { isMember } from '../lib/access';

/** Workspace activity feed. */
export async function activityRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get<{ Querystring: { workspaceId?: string } }>('/activity', async (req, reply) => {
    const parsed = z.object({ workspaceId: z.string().uuid() }).safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query' });
    if (!(await isMember(parsed.data.workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    return prisma.activity.findMany({
      where: { workspaceId: parsed.data.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { actor: { select: { id: true, name: true } } },
    });
  });
}
