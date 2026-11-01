import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, currentUserId } from '../lib/auth';
import { isMember, workspaceIdForFolder, workspaceIdForList } from '../lib/access';

/**
 * Manage/removal endpoints: rename or remove members, tags, lists, folders,
 * statuses and custom fields. Kept in one focused module.
 */
export async function manageRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // ---- Members -----------------------------------------------------------
  app.patch<{ Params: { workspaceId: string; userId: string } }>(
    '/workspaces/:workspaceId/members/:userId',
    async (req, reply) => {
      const body = z.object({ role: z.enum(['owner', 'admin', 'member', 'guest']) }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'invalid_body' });
      if (!(await isMember(req.params.workspaceId, currentUserId(req)))) {
        return reply.code(403).send({ error: 'forbidden' });
      }
      const membership = await prisma.membership.update({
        where: {
          userId_workspaceId: { userId: req.params.userId, workspaceId: req.params.workspaceId },
        },
        data: { role: body.data.role },
      });
      return reply.send(membership);
    },
  );

  app.delete<{ Params: { workspaceId: string; userId: string } }>(
    '/workspaces/:workspaceId/members/:userId',
    async (req, reply) => {
      if (!(await isMember(req.params.workspaceId, currentUserId(req)))) {
        return reply.code(403).send({ error: 'forbidden' });
      }
      await prisma.membership.deleteMany({
        where: { workspaceId: req.params.workspaceId, userId: req.params.userId },
      });
      return reply.code(204).send();
    },
  );

  // ---- Tags --------------------------------------------------------------
  app.patch<{ Params: { workspaceId: string } }>(
    '/workspaces/:workspaceId/settings',
    async (req, reply) => {
      const body = z
        .object({
          name: z.string().min(1).optional(),
          hourlyRate: z.number().int().min(0).nullable().optional(),
          currency: z.string().min(1).max(8).optional(),
        })
        .safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'invalid_body' });
      if (!(await isMember(req.params.workspaceId, currentUserId(req)))) {
        return reply.code(403).send({ error: 'forbidden' });
      }
      return prisma.workspace.update({
        where: { id: req.params.workspaceId },
        data: {
          name: body.data.name ?? undefined,
          hourlyRate: body.data.hourlyRate === undefined ? undefined : body.data.hourlyRate,
          currency: body.data.currency ?? undefined,
        },
      });
    },
  );

  app.delete<{ Params: { workspaceId: string; tagId: string } }>(
    '/workspaces/:workspaceId/tags/:tagId',
    async (req, reply) => {
      if (!(await isMember(req.params.workspaceId, currentUserId(req)))) {
        return reply.code(403).send({ error: 'forbidden' });
      }
      await prisma.tag.deleteMany({ where: { id: req.params.tagId, workspaceId: req.params.workspaceId } });
      return reply.code(204).send();
    },
  );

  // ---- Lists -------------------------------------------------------------
  app.patch<{ Params: { listId: string } }>('/lists/:listId', async (req, reply) => {
    const body = z.object({ name: z.string().min(1) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body' });
    const workspaceId = await workspaceIdForList(req.params.listId);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    return prisma.taskList.update({ where: { id: req.params.listId }, data: { name: body.data.name } });
  });

  app.delete<{ Params: { listId: string } }>('/lists/:listId', async (req, reply) => {
    const workspaceId = await workspaceIdForList(req.params.listId);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    await prisma.taskList.delete({ where: { id: req.params.listId } });
    return reply.code(204).send();
  });

  // ---- Folders -----------------------------------------------------------
  app.patch<{ Params: { folderId: string } }>('/folders/:folderId', async (req, reply) => {
    const body = z.object({ name: z.string().min(1) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body' });
    const workspaceId = await workspaceIdForFolder(req.params.folderId);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    return prisma.folder.update({ where: { id: req.params.folderId }, data: { name: body.data.name } });
  });

  app.delete<{ Params: { folderId: string } }>('/folders/:folderId', async (req, reply) => {
    const workspaceId = await workspaceIdForFolder(req.params.folderId);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    await prisma.folder.delete({ where: { id: req.params.folderId } });
    return reply.code(204).send();
  });

  // ---- Statuses ----------------------------------------------------------
  // ---- Statuses ----------------------------------------------------------
  app.patch<{ Params: { listId: string } }>('/lists/:listId/statuses/reorder', async (req, reply) => {
    const body = z.object({ ids: z.array(z.string().uuid()).min(1) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body' });
    const workspaceId = await workspaceIdForList(req.params.listId);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const existing = await prisma.status.findMany({
      where: { listId: req.params.listId },
      select: { id: true },
    });
    const known = new Set(existing.map((s) => s.id));
    if (!body.data.ids.every((id) => known.has(id))) {
      return reply.code(400).send({ error: 'unknown_status' });
    }
    await prisma.$transaction(
      body.data.ids.map((id, index) =>
        prisma.status.update({ where: { id }, data: { position: index } }),
      ),
    );
    return prisma.status.findMany({
      where: { listId: req.params.listId },
      orderBy: { position: 'asc' },
    });
  });

  app.delete<{ Params: { listId: string; statusId: string } }>(
    '/lists/:listId/statuses/:statusId',
    async (req, reply) => {
      const workspaceId = await workspaceIdForList(req.params.listId);
      if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
      if (!(await isMember(workspaceId, currentUserId(req)))) {
        return reply.code(403).send({ error: 'forbidden' });
      }
      const inUse = await prisma.task.count({ where: { statusId: req.params.statusId } });
      if (inUse > 0) return reply.code(409).send({ error: 'status_in_use', count: inUse });
      await prisma.status.deleteMany({ where: { id: req.params.statusId, listId: req.params.listId } });
      return reply.code(204).send();
    },
  );

  // ---- Custom fields -----------------------------------------------------
  app.delete<{ Params: { listId: string; fieldId: string } }>(
    '/lists/:listId/fields/:fieldId',
    async (req, reply) => {
      const workspaceId = await workspaceIdForList(req.params.listId);
      if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
      if (!(await isMember(workspaceId, currentUserId(req)))) {
        return reply.code(403).send({ error: 'forbidden' });
      }
      await prisma.customField.deleteMany({ where: { id: req.params.fieldId, listId: req.params.listId } });
      return reply.code(204).send();
    },
  );
}
