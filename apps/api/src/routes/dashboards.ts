import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, currentUserId } from '../lib/auth';
import { isMember } from '../lib/access';

/** Dashboards: a named workspace page of widgets (widgets stored in `config`). */
export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get<{ Querystring: { workspaceId?: string } }>('/', async (req, reply) => {
    const parsed = z.object({ workspaceId: z.string().uuid() }).safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query' });
    if (!(await isMember(parsed.data.workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    return prisma.dashboard.findMany({
      where: { workspaceId: parsed.data.workspaceId },
      orderBy: { createdAt: 'asc' },
    });
  });

  app.post('/', async (req, reply) => {
    const parsed = z
      .object({
        workspaceId: z.string().uuid(),
        name: z.string().min(1),
        config: z.unknown().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    if (!(await isMember(parsed.data.workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const dashboard = await prisma.dashboard.create({
      data: {
        workspaceId: parsed.data.workspaceId,
        name: parsed.data.name,
        config: (parsed.data.config ?? { widgets: [] }) as never,
      },
    });
    return reply.code(201).send(dashboard);
  });

  app.patch<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const parsed = z
      .object({ name: z.string().min(1).optional(), config: z.unknown().optional() })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const dashboard = await prisma.dashboard.findUnique({ where: { id: req.params.id } });
    if (!dashboard) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(dashboard.workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    return prisma.dashboard.update({
      where: { id: dashboard.id },
      data: {
        name: parsed.data.name ?? undefined,
        config: parsed.data.config !== undefined ? (parsed.data.config as never) : undefined,
      },
    });
  });

  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const dashboard = await prisma.dashboard.findUnique({ where: { id: req.params.id } });
    if (!dashboard) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(dashboard.workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    await prisma.dashboard.delete({ where: { id: dashboard.id } });
    return reply.code(204).send();
  });
}
