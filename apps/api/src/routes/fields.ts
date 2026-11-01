import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, currentUserId } from '../lib/auth';
import { isMember, workspaceIdForList, workspaceIdForTask } from '../lib/access';

const fieldType = z.enum([
  'text',
  'long_text',
  'number',
  'currency',
  'dropdown',
  'labels',
  'checkbox',
  'date',
  'email',
  'phone',
  'url',
  'rating',
]);

const createBody = z.object({
  name: z.string().min(1),
  type: fieldType,
  config: z.unknown().optional(),
  required: z.boolean().optional(),
  position: z.number().int().optional(),
});

export async function fieldRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get<{ Params: { listId: string } }>('/lists/:listId/fields', async (req, reply) => {
    const workspaceId = await workspaceIdForList(req.params.listId);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    return prisma.customField.findMany({
      where: { listId: req.params.listId },
      orderBy: { position: 'asc' },
    });
  });

  app.post<{ Params: { listId: string } }>('/lists/:listId/fields', async (req, reply) => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const workspaceId = await workspaceIdForList(req.params.listId);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const field = await prisma.customField.create({
      data: {
        listId: req.params.listId,
        name: parsed.data.name,
        type: parsed.data.type,
        config: (parsed.data.config ?? null) as never,
        required: parsed.data.required ?? false,
        position: parsed.data.position ?? 0,
      },
    });
    return reply.code(201).send(field);
  });

  app.put<{ Params: { taskId: string; fieldId: string } }>(
    '/tasks/:taskId/fields/:fieldId',
    async (req, reply) => {
      const body = z.object({ value: z.unknown() }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'invalid_body' });
      const workspaceId = await workspaceIdForTask(req.params.taskId);
      if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
      if (!(await isMember(workspaceId, currentUserId(req)))) {
        return reply.code(403).send({ error: 'forbidden' });
      }
      const field = await prisma.customField.findUnique({ where: { id: req.params.fieldId } });
      const task = await prisma.task.findUnique({ where: { id: req.params.taskId } });
      if (!field || !task || field.listId !== task.listId) {
        return reply.code(400).send({ error: 'field_not_in_list' });
      }
      const value = await prisma.customFieldValue.upsert({
        where: { taskId_fieldId: { taskId: req.params.taskId, fieldId: req.params.fieldId } },
        create: {
          taskId: req.params.taskId,
          fieldId: req.params.fieldId,
          value: body.data.value as never,
        },
        update: { value: body.data.value as never },
      });
      return reply.send(value);
    },
  );
}
