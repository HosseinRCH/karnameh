import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, currentUserId } from '../lib/auth';
import { isMember } from '../lib/access';

const listQuery = z.object({ workspaceId: z.string().uuid() });
const createBody = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1),
  color: z.string().optional(),
});

export async function spaceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get<{ Querystring: { workspaceId?: string } }>('/', async (req, reply) => {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query' });
    if (!(await isMember(parsed.data.workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    return prisma.space.findMany({
      where: { workspaceId: parsed.data.workspaceId },
      orderBy: { position: 'asc' },
      include: { lists: { orderBy: { position: 'asc' } }, folders: { orderBy: { position: 'asc' } } },
    });
  });

  app.post<{ Params: { spaceId: string } }>('/:spaceId/folders', async (req, reply) => {
    const body = z.object({ name: z.string().min(1) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body' });
    const space = await prisma.space.findUnique({
      where: { id: req.params.spaceId },
      select: { workspaceId: true },
    });
    if (!space) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(space.workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const folder = await prisma.folder.create({
      data: { spaceId: req.params.spaceId, name: body.data.name },
    });
    return reply.code(201).send(folder);
  });

  app.post('/', async (req, reply) => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    if (!(await isMember(parsed.data.workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const space = await prisma.space.create({
      data: {
        workspaceId: parsed.data.workspaceId,
        name: parsed.data.name,
        color: parsed.data.color ?? null,
      },
    });
    return reply.code(201).send(space);
  });
}
