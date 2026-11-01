import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { authenticate, currentUserId } from '../lib/auth';
import { isMember, workspaceIdForList, workspaceIdForTask } from '../lib/access';
import { matchesPersian } from '../lib/normalize';
import { runAutomations } from '../lib/automation';
import { logActivity } from '../lib/activity';
import { emitToWorkspace } from '../lib/events';

const priority = z.enum(['none', 'low', 'normal', 'high', 'urgent']);
const dateish = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'invalid_date');

const createBody = z.object({
  listId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: priority.optional(),
  statusId: z.string().uuid().optional(),
  parentTaskId: z.string().uuid().optional(),
  startDate: dateish.optional(),
  dueDate: dateish.optional(),
});

const updateBody = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  priority: priority.optional(),
  statusId: z.string().uuid().optional(),
  parentTaskId: z.string().uuid().nullable().optional(),
  startDate: dateish.nullable().optional(),
  dueDate: dateish.nullable().optional(),
  estimateMs: z.number().int().nullable().optional(),
  position: z.number().int().optional(),
});

export async function taskRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get<{ Querystring: { listId?: string; q?: string } }>('/', async (req, reply) => {
    const parsed = z
      .object({ listId: z.string().uuid(), q: z.string().optional() })
      .safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query' });
    const workspaceId = await workspaceIdForList(parsed.data.listId);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const tasks = await prisma.task.findMany({
      where: { listId: parsed.data.listId },
      orderBy: { position: 'asc' },
      include: {
        assignees: { include: { user: { select: { id: true, name: true } } } },
        tags: { include: { tag: true } },
        dependencies: true,
      },
    });
    const q = parsed.data.q?.trim();
    if (!q) return tasks;
    return tasks.filter(
      (task) =>
        matchesPersian(task.title, q) ||
        (task.description ? matchesPersian(task.description, q) : false),
    );
  });

  app.post('/', async (req, reply) => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }
    const workspaceId = await workspaceIdForList(parsed.data.listId);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }

    let statusId = parsed.data.statusId;
    if (statusId) {
      const status = await prisma.status.findUnique({ where: { id: statusId } });
      if (!status || status.listId !== parsed.data.listId) {
        return reply.code(400).send({ error: 'invalid_status' });
      }
    } else {
      const first = await prisma.status.findFirst({
        where: { listId: parsed.data.listId },
        orderBy: { position: 'asc' },
      });
      if (!first) return reply.code(400).send({ error: 'list_has_no_statuses' });
      statusId = first.id;
    }

    const task = await prisma.task.create({
      data: {
        listId: parsed.data.listId,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        priority: parsed.data.priority ?? 'none',
        statusId,
        parentTaskId: parsed.data.parentTaskId ?? null,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      },
    });
    await runAutomations({
      workspaceId,
      type: 'task.created',
      taskId: task.id,
      actorId: currentUserId(req),
    });
    await logActivity({
      workspaceId,
      actorId: currentUserId(req),
      entityType: 'task',
      entityId: task.id,
      action: 'created',
      meta: { title: task.title },
    });
    emitToWorkspace({ workspaceId, type: 'task.changed', payload: { taskId: task.id } });
    return reply.code(201).send(task);
  });

  app.patch<{ Params: { taskId: string } }>('/:taskId', async (req, reply) => {
    const parsed = updateBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }
    const workspaceId = await workspaceIdForTask(req.params.taskId);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const existing = await prisma.task.findUnique({ where: { id: req.params.taskId } });
    if (!existing) return reply.code(404).send({ error: 'not_found' });

    const data: Prisma.TaskUpdateInput = {};
    if (parsed.data.title !== undefined) data.title = parsed.data.title;
    if (parsed.data.description !== undefined) data.description = parsed.data.description;
    if (parsed.data.priority !== undefined) data.priority = parsed.data.priority;
    if (parsed.data.position !== undefined) data.position = parsed.data.position;
    if (parsed.data.estimateMs !== undefined) data.estimateMs = parsed.data.estimateMs;
    if (parsed.data.parentTaskId !== undefined) {
      data.parent = parsed.data.parentTaskId
        ? { connect: { id: parsed.data.parentTaskId } }
        : { disconnect: true };
    }
    if (parsed.data.startDate !== undefined) {
      data.startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : null;
    }
    if (parsed.data.dueDate !== undefined) {
      data.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
    }
    if (parsed.data.statusId !== undefined) {
      const status = await prisma.status.findUnique({ where: { id: parsed.data.statusId } });
      if (!status || status.listId !== existing.listId) {
        return reply.code(400).send({ error: 'invalid_status' });
      }
      data.status = { connect: { id: status.id } };
      data.completedAt =
        status.type === 'done' || status.type === 'closed' ? (existing.completedAt ?? new Date()) : null;
    }

    const task = await prisma.task.update({ where: { id: req.params.taskId }, data });
    const actorId = currentUserId(req);
    await runAutomations({ workspaceId, type: 'task.updated', taskId: task.id, actorId });
    if (task.statusId !== existing.statusId) {
      await runAutomations({ workspaceId, type: 'task.status_changed', taskId: task.id, actorId });
    }
    await logActivity({
      workspaceId,
      actorId,
      entityType: 'task',
      entityId: task.id,
      action: 'updated',
      meta: { fields: Object.keys(parsed.data) },
    });
    emitToWorkspace({ workspaceId, type: 'task.changed', payload: { taskId: task.id } });
    return reply.send(task);
  });

  app.delete<{ Params: { taskId: string } }>('/:taskId', async (req, reply) => {
    const workspaceId = await workspaceIdForTask(req.params.taskId);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    await prisma.task.delete({ where: { id: req.params.taskId } });
    await logActivity({
      workspaceId,
      actorId: currentUserId(req),
      entityType: 'task',
      entityId: req.params.taskId,
      action: 'deleted',
    });
    emitToWorkspace({ workspaceId, type: 'task.changed', payload: { taskId: req.params.taskId } });
    return reply.code(204).send();
  });
}
