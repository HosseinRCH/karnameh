import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, currentUserId } from '../lib/auth';
import { isMember } from '../lib/access';
import { dryRunAutomation } from '../lib/automation';

const trigger = z.object({
  type: z.enum(['task.created', 'task.updated', 'task.status_changed']),
  to: z.string().optional(),
});

const conditions = z.object({
  op: z.enum(['and', 'or']).optional(),
  items: z
    .array(
      z.object({
        field: z.enum(['priority', 'statusId', 'assigneeId']),
        operator: z.enum(['equals', 'not_equals']),
        value: z.string(),
      }),
    )
    .optional(),
});

const action = z.object({
  type: z.enum(['task.set_priority', 'task.set_status', 'task.assign', 'time.start']),
  params: z.record(z.unknown()).optional(),
});

async function workspaceOf(automationId: string) {
  const a = await prisma.automation.findUnique({
    where: { id: automationId },
    select: { workspaceId: true },
  });
  return a?.workspaceId ?? null;
}

/** Automations: trigger -> conditions -> actions, with a run log + dry-run. */
export async function automationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get<{ Querystring: { workspaceId?: string } }>('/automations', async (req, reply) => {
    const parsed = z.object({ workspaceId: z.string().uuid() }).safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query' });
    if (!(await isMember(parsed.data.workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    return prisma.automation.findMany({
      where: { workspaceId: parsed.data.workspaceId },
      orderBy: { createdAt: 'asc' },
    });
  });

  app.get<{ Querystring: { workspaceId?: string } }>('/automations/runs', async (req, reply) => {
    const parsed = z.object({ workspaceId: z.string().uuid() }).safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query' });
    if (!(await isMember(parsed.data.workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    return prisma.automationRun.findMany({
      where: { automation: { workspaceId: parsed.data.workspaceId } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { automation: { select: { id: true, name: true } } },
    });
  });

  app.post('/automations', async (req, reply) => {
    const parsed = z
      .object({
        workspaceId: z.string().uuid(),
        name: z.string().min(1),
        enabled: z.boolean().optional(),
        runAs: z.enum(['owner', 'actor']).optional(),
        trigger,
        conditions: conditions.optional(),
        actions: z.array(action).min(1),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    if (!(await isMember(parsed.data.workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const automation = await prisma.automation.create({
      data: {
        workspaceId: parsed.data.workspaceId,
        name: parsed.data.name,
        enabled: parsed.data.enabled ?? true,
        runAs: parsed.data.runAs ?? 'owner',
        trigger: parsed.data.trigger as never,
        conditions: (parsed.data.conditions ?? { items: [] }) as never,
        actions: parsed.data.actions as never,
      },
    });
    return reply.code(201).send(automation);
  });

  app.patch<{ Params: { id: string } }>('/automations/:id', async (req, reply) => {
    const parsed = z
      .object({
        name: z.string().min(1).optional(),
        enabled: z.boolean().optional(),
        trigger: trigger.optional(),
        conditions: conditions.optional(),
        actions: z.array(action).min(1).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const workspaceId = await workspaceOf(req.params.id);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) return reply.code(403).send({ error: 'forbidden' });
    return prisma.automation.update({
      where: { id: req.params.id },
      data: {
        name: parsed.data.name ?? undefined,
        enabled: parsed.data.enabled ?? undefined,
        trigger: parsed.data.trigger ? (parsed.data.trigger as never) : undefined,
        conditions: parsed.data.conditions ? (parsed.data.conditions as never) : undefined,
        actions: parsed.data.actions ? (parsed.data.actions as never) : undefined,
      },
    });
  });

  app.delete<{ Params: { id: string } }>('/automations/:id', async (req, reply) => {
    const workspaceId = await workspaceOf(req.params.id);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) return reply.code(403).send({ error: 'forbidden' });
    await prisma.automation.delete({ where: { id: req.params.id } });
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>('/automations/:id/dry-run', async (req, reply) => {
    const parsed = z.object({ taskId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const workspaceId = await workspaceOf(req.params.id);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) return reply.code(403).send({ error: 'forbidden' });
    const result = await dryRunAutomation(req.params.id, parsed.data.taskId);
    if (!result) return reply.code(404).send({ error: 'not_found' });
    return reply.send(result);
  });
}
