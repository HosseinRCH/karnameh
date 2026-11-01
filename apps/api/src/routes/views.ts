import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, currentUserId } from '../lib/auth';
import { isMember, workspaceIdForList } from '../lib/access';

/** Saved views (filters / sort / grouping / columns) per list. */
const configSchema = z.object({
  search: z.string().optional(),
  statusIds: z.array(z.string()).optional(),
  priority: z.array(z.string()).optional(),
  assigneeIds: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
  sortBy: z.enum(['position', 'priority', 'dueDate', 'title']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['list', 'board']).default('list'),
  config: configSchema.default({}),
  isDefault: z.boolean().optional(),
});

export async function viewRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get<{ Params: { listId: string } }>('/lists/:listId/views', async (req, reply) => {
    const workspaceId = await workspaceIdForList(req.params.listId);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    return prisma.view.findMany({
      where: { listId: req.params.listId },
      orderBy: { createdAt: 'asc' },
    });
  });

  app.post<{ Params: { listId: string } }>('/lists/:listId/views', async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const workspaceId = await workspaceIdForList(req.params.listId);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const view = await prisma.view.create({
      data: {
        listId: req.params.listId,
        name: parsed.data.name,
        type: parsed.data.type,
        config: parsed.data.config as never,
        isDefault: parsed.data.isDefault ?? false,
        createdBy: currentUserId(req),
      },
    });
    return reply.code(201).send(view);
  });

  app.patch<{ Params: { viewId: string } }>('/views/:viewId', async (req, reply) => {
    const parsed = z
      .object({
        name: z.string().min(1).optional(),
        config: configSchema.optional(),
        isDefault: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const view = await prisma.view.findUnique({ where: { id: req.params.viewId } });
    if (!view) return reply.code(404).send({ error: 'not_found' });
    const workspaceId = await workspaceIdForList(view.listId);
    if (!workspaceId || !(await isMember(workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const updated = await prisma.view.update({
      where: { id: view.id },
      data: {
        name: parsed.data.name ?? undefined,
        config: parsed.data.config !== undefined ? (parsed.data.config as never) : undefined,
        isDefault: parsed.data.isDefault ?? undefined,
      },
    });
    return reply.send(updated);
  });

  app.delete<{ Params: { viewId: string } }>('/views/:viewId', async (req, reply) => {
    const view = await prisma.view.findUnique({ where: { id: req.params.viewId } });
    if (!view) return reply.code(404).send({ error: 'not_found' });
    const workspaceId = await workspaceIdForList(view.listId);
    if (!workspaceId || !(await isMember(workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    await prisma.view.delete({ where: { id: view.id } });
    return reply.code(204).send();
  });
}
