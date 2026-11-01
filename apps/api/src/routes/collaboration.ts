import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, currentUserId } from '../lib/auth';
import { isMember, workspaceIdForTask } from '../lib/access';
import { hashPassword } from '../lib/passwords';
import { logActivity, notify } from '../lib/activity';
import { emitToWorkspace } from '../lib/events';

/** Phase 0 collaboration: members, assignees, tags and task detail. */
export async function collaborationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // ---- Members -----------------------------------------------------------
  app.get<{ Params: { workspaceId: string } }>('/workspaces/:workspaceId/members', async (req, reply) => {
    if (!(await isMember(req.params.workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const memberships = await prisma.membership.findMany({
      where: { workspaceId: req.params.workspaceId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({ ...m.user, role: m.role }));
  });

  // Add a person to the workspace. If the email is new, a user is created and a
  // one-time temporary password is returned (there is no email service in dev).
  app.post<{ Params: { workspaceId: string } }>('/workspaces/:workspaceId/members', async (req, reply) => {
    const body = z
      .object({
        email: z.string().email(),
        name: z.string().min(1).optional(),
        role: z.enum(['admin', 'member', 'guest']).optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body' });
    if (!(await isMember(req.params.workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }

    let user = await prisma.user.findUnique({ where: { email: body.data.email } });
    let temporaryPassword: string | undefined;
    if (!user) {
      temporaryPassword = Math.random().toString(36).slice(2, 10);
      user = await prisma.user.create({
        data: {
          email: body.data.email,
          name: body.data.name ?? body.data.email.split('@')[0],
          passwordHash: hashPassword(temporaryPassword),
        },
      });
    }
    const membership = await prisma.membership.upsert({
      where: { userId_workspaceId: { userId: user.id, workspaceId: req.params.workspaceId } },
      create: {
        userId: user.id,
        workspaceId: req.params.workspaceId,
        role: body.data.role ?? 'member',
      },
      update: { role: body.data.role ?? undefined },
    });
    return reply.code(201).send({
      member: { id: user.id, name: user.name, email: user.email, role: membership.role },
      temporaryPassword,
    });
  });

  // ---- Tags --------------------------------------------------------------
  app.get<{ Params: { workspaceId: string } }>('/workspaces/:workspaceId/tags', async (req, reply) => {
    if (!(await isMember(req.params.workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    return prisma.tag.findMany({ where: { workspaceId: req.params.workspaceId }, orderBy: { name: 'asc' } });
  });

  app.post<{ Params: { workspaceId: string } }>('/workspaces/:workspaceId/tags', async (req, reply) => {
    const body = z.object({ name: z.string().min(1), color: z.string().optional() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body' });
    if (!(await isMember(req.params.workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const tag = await prisma.tag.upsert({
      where: { workspaceId_name: { workspaceId: req.params.workspaceId, name: body.data.name } },
      create: {
        workspaceId: req.params.workspaceId,
        name: body.data.name,
        color: body.data.color ?? '#64748b',
      },
      update: body.data.color ? { color: body.data.color } : {},
    });
    return reply.code(201).send(tag);
  });

  // ---- Task detail -------------------------------------------------------
  app.get<{ Params: { taskId: string } }>('/tasks/:taskId', async (req, reply) => {
    const workspaceId = await workspaceIdForTask(req.params.taskId);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const task = await prisma.task.findUnique({
      where: { id: req.params.taskId },
      include: {
        status: true,
        assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
        tags: { include: { tag: true } },
        fieldValues: true,
        dependencies: true,
        subtasks: { include: { status: true }, orderBy: { position: 'asc' } },
      },
    });
    return task;
  });

  // ---- Assignees ---------------------------------------------------------
  app.post<{ Params: { taskId: string } }>('/tasks/:taskId/assignees', async (req, reply) => {
    const body = z.object({ userId: z.string().uuid() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body' });
    const workspaceId = await workspaceIdForTask(req.params.taskId);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    if (!(await isMember(workspaceId, body.data.userId))) {
      return reply.code(400).send({ error: 'user_not_in_workspace' });
    }
    const assignment = await prisma.taskAssignee.upsert({
      where: { taskId_userId: { taskId: req.params.taskId, userId: body.data.userId } },
      create: { taskId: req.params.taskId, userId: body.data.userId },
      update: {},
    });
    const actorId = currentUserId(req);
    const task = await prisma.task.findUnique({
      where: { id: req.params.taskId },
      select: { title: true },
    });
    await logActivity({
      workspaceId,
      actorId,
      entityType: 'task',
      entityId: req.params.taskId,
      action: 'assigned',
      meta: { userId: body.data.userId },
    });
    if (body.data.userId !== actorId) {
      await notify({
        workspaceId,
        userId: body.data.userId,
        type: 'assigned',
        title: `Assigned: ${task?.title ?? 'task'}`,
        view: 'list',
      });
    }
    emitToWorkspace({ workspaceId, type: 'task.changed', payload: { taskId: req.params.taskId } });
    return reply.code(201).send(assignment);
  });

  app.delete<{ Params: { taskId: string; userId: string } }>(
    '/tasks/:taskId/assignees/:userId',
    async (req, reply) => {
      const workspaceId = await workspaceIdForTask(req.params.taskId);
      if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
      if (!(await isMember(workspaceId, currentUserId(req)))) {
        return reply.code(403).send({ error: 'forbidden' });
      }
      await prisma.taskAssignee.deleteMany({
        where: { taskId: req.params.taskId, userId: req.params.userId },
      });
      return reply.code(204).send();
    },
  );

  app.patch<{ Params: { taskId: string; userId: string } }>(
    '/tasks/:taskId/assignees/:userId',
    async (req, reply) => {
      const body = z.object({ estimateMs: z.number().int().min(0).nullable() }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'invalid_body' });
      const workspaceId = await workspaceIdForTask(req.params.taskId);
      if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
      if (!(await isMember(workspaceId, currentUserId(req)))) {
        return reply.code(403).send({ error: 'forbidden' });
      }
      const updated = await prisma.taskAssignee.update({
        where: { taskId_userId: { taskId: req.params.taskId, userId: req.params.userId } },
        data: { estimateMs: body.data.estimateMs },
      });
      return reply.send(updated);
    },
  );

  // ---- Task tags ---------------------------------------------------------
  app.post<{ Params: { taskId: string } }>('/tasks/:taskId/dependencies', async (req, reply) => {
    const body = z.object({ dependsOnTaskId: z.string().uuid() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body' });
    const workspaceId = await workspaceIdForTask(req.params.taskId);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    if (body.data.dependsOnTaskId === req.params.taskId) {
      return reply.code(400).send({ error: 'self_dependency' });
    }
    const dependency = await prisma.taskDependency.upsert({
      where: {
        taskId_dependsOnTaskId: {
          taskId: req.params.taskId,
          dependsOnTaskId: body.data.dependsOnTaskId,
        },
      },
      create: { taskId: req.params.taskId, dependsOnTaskId: body.data.dependsOnTaskId },
      update: {},
    });
    return reply.code(201).send(dependency);
  });

  app.delete<{ Params: { taskId: string; dependsOnTaskId: string } }>(
    '/tasks/:taskId/dependencies/:dependsOnTaskId',
    async (req, reply) => {
      const workspaceId = await workspaceIdForTask(req.params.taskId);
      if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
      if (!(await isMember(workspaceId, currentUserId(req)))) {
        return reply.code(403).send({ error: 'forbidden' });
      }
      await prisma.taskDependency.deleteMany({
        where: { taskId: req.params.taskId, dependsOnTaskId: req.params.dependsOnTaskId },
      });
      return reply.code(204).send();
    },
  );

  // ---- Task tags ---------------------------------------------------------
  app.post<{ Params: { taskId: string } }>('/tasks/:taskId/tags', async (req, reply) => {
    const body = z.object({ tagId: z.string().uuid() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body' });
    const workspaceId = await workspaceIdForTask(req.params.taskId);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const tag = await prisma.tag.findUnique({ where: { id: body.data.tagId } });
    if (!tag || tag.workspaceId !== workspaceId) return reply.code(400).send({ error: 'invalid_tag' });
    await prisma.taskTag.upsert({
      where: { taskId_tagId: { taskId: req.params.taskId, tagId: body.data.tagId } },
      create: { taskId: req.params.taskId, tagId: body.data.tagId },
      update: {},
    });
    return reply.code(201).send({ ok: true });
  });

  app.delete<{ Params: { taskId: string; tagId: string } }>(
    '/tasks/:taskId/tags/:tagId',
    async (req, reply) => {
      const workspaceId = await workspaceIdForTask(req.params.taskId);
      if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
      if (!(await isMember(workspaceId, currentUserId(req)))) {
        return reply.code(403).send({ error: 'forbidden' });
      }
      await prisma.taskTag.deleteMany({ where: { taskId: req.params.taskId, tagId: req.params.tagId } });
      return reply.code(204).send();
    },
  );
}
