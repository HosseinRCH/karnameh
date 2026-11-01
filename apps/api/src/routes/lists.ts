import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, currentUserId } from '../lib/auth';
import { isMember, workspaceIdForList } from '../lib/access';

const listQuery = z.object({ spaceId: z.string().uuid() });

const createBody = z.object({
  spaceId: z.string().uuid(),
  folderId: z.string().uuid().optional(),
  name: z.string().min(1),
});

const DEFAULT_STATUSES = [
  { name: 'To Do', type: 'open', color: '#94a3b8', position: 0 },
  { name: 'In Progress', type: 'custom', color: '#3b82f6', position: 1 },
  { name: 'Done', type: 'done', color: '#22c55e', position: 2 },
] as const;

export async function listRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get<{ Querystring: { spaceId?: string } }>('/', async (req, reply) => {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query' });
    const space = await prisma.space.findUnique({
      where: { id: parsed.data.spaceId },
      select: { workspaceId: true },
    });
    if (!space) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(space.workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    return prisma.taskList.findMany({
      where: { spaceId: parsed.data.spaceId },
      orderBy: { position: 'asc' },
    });
  });

  app.post('/', async (req, reply) => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const space = await prisma.space.findUnique({
      where: { id: parsed.data.spaceId },
      select: { workspaceId: true },
    });
    if (!space) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(space.workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const list = await prisma.taskList.create({
      data: {
        spaceId: parsed.data.spaceId,
        folderId: parsed.data.folderId ?? null,
        name: parsed.data.name,
        statuses: {
          create: DEFAULT_STATUSES.map((s) => ({
            name: s.name,
            type: s.type,
            color: s.color,
            position: s.position,
          })),
        },
      },
      include: { statuses: { orderBy: { position: 'asc' } } },
    });
    return reply.code(201).send(list);
  });

  app.get<{ Params: { listId: string } }>('/:listId', async (req, reply) => {
    const workspaceId = await workspaceIdForList(req.params.listId);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const list = await prisma.taskList.findUnique({
      where: { id: req.params.listId },
      include: {
        statuses: { orderBy: { position: 'asc' } },
        fields: { orderBy: { position: 'asc' } },
      },
    });
    return list;
  });

  app.post<{ Params: { listId: string } }>('/:listId/statuses', async (req, reply) => {
    const body = z
      .object({
        name: z.string().min(1),
        type: z.enum(['open', 'custom', 'done', 'closed']).optional(),
        color: z.string().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body' });
    const workspaceId = await workspaceIdForList(req.params.listId);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const count = await prisma.status.count({ where: { listId: req.params.listId } });
    const status = await prisma.status.create({
      data: {
        listId: req.params.listId,
        name: body.data.name,
        type: body.data.type ?? 'custom',
        color: body.data.color ?? '#64748b',
        position: count,
      },
    });
    return reply.code(201).send(status);
  });
}
