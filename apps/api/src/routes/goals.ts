import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, currentUserId } from '../lib/auth';
import { isMember } from '../lib/access';

const INCLUDE = {
  targets: {
    include: {
      tasks: {
        include: { task: { select: { id: true, title: true, status: { select: { type: true } } } } },
      },
    },
  },
} as const;

type LoadedTarget = {
  id: string;
  name: string;
  type: string;
  unit: string | null;
  startValue: number;
  targetValue: number;
  currentValue: number;
  weight: number;
  tasks: Array<{ taskId: string; task: { id: string; title: string; status: { type: string } } }>;
};

function progressOf(t: LoadedTarget) {
  if (t.type === 'task_completion') {
    const total = t.tasks.length;
    const done = t.tasks.filter((tt) => ['done', 'closed'].includes(tt.task.status.type)).length;
    return { progress: total ? done / total : 0, done, total };
  }
  if (t.type === 'boolean') return { progress: t.currentValue >= 1 ? 1 : 0 };
  const denom = t.targetValue - t.startValue;
  const progress =
    denom === 0
      ? t.targetValue > 0 && t.currentValue >= t.targetValue
        ? 1
        : 0
      : Math.max(0, Math.min(1, (t.currentValue - t.startValue) / denom));
  return { progress };
}

function serializeGoal(g: {
  id: string;
  name: string;
  folder: string | null;
  ownerId: string | null;
  periodType: string;
  periodStart: Date;
  periodEnd: Date;
  status: string;
  targets: LoadedTarget[];
}) {
  const targets = g.targets.map((t) => {
    const p = progressOf(t);
    return {
      id: t.id,
      name: t.name,
      type: t.type,
      unit: t.unit,
      startValue: t.startValue,
      targetValue: t.targetValue,
      currentValue: t.currentValue,
      weight: t.weight,
      progress: p.progress,
      done: p.done ?? null,
      total: p.total ?? null,
      tasks: t.tasks.map((tt) => ({ taskId: tt.taskId, title: tt.task.title, statusType: tt.task.status.type })),
    };
  });
  const weightSum = targets.reduce((s, t) => s + t.weight, 0) || 1;
  const progress = targets.reduce((s, t) => s + t.weight * t.progress, 0) / weightSum;
  return { ...g, targets, progress };
}

async function goalWorkspace(goalId: string) {
  const goal = await prisma.goal.findUnique({ where: { id: goalId }, select: { workspaceId: true } });
  return goal?.workspaceId ?? null;
}

async function targetWorkspace(targetId: string) {
  const target = await prisma.target.findUnique({
    where: { id: targetId },
    select: { goal: { select: { workspaceId: true } } },
  });
  return target?.goal.workspaceId ?? null;
}

/** Goals & targets with live progress roll-up. */
export async function goalRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get<{ Querystring: { workspaceId?: string } }>('/goals', async (req, reply) => {
    const parsed = z.object({ workspaceId: z.string().uuid() }).safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query' });
    if (!(await isMember(parsed.data.workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const goals = await prisma.goal.findMany({
      where: { workspaceId: parsed.data.workspaceId },
      orderBy: { createdAt: 'asc' },
      include: INCLUDE,
    });
    return goals.map(serializeGoal);
  });

  app.post('/goals', async (req, reply) => {
    const parsed = z
      .object({
        workspaceId: z.string().uuid(),
        name: z.string().min(1),
        folder: z.string().max(80).optional(),
        ownerId: z.string().uuid().optional(),
        periodType: z.enum(['month', 'quarter', 'custom']).optional(),
        periodStart: z.string(),
        periodEnd: z.string(),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    if (!(await isMember(parsed.data.workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const goal = await prisma.goal.create({
      data: {
        workspaceId: parsed.data.workspaceId,
        name: parsed.data.name,
        folder: parsed.data.folder ?? null,
        ownerId: parsed.data.ownerId ?? null,
        periodType: parsed.data.periodType ?? 'quarter',
        periodStart: new Date(parsed.data.periodStart),
        periodEnd: new Date(parsed.data.periodEnd),
      },
      include: INCLUDE,
    });
    return reply.code(201).send(serializeGoal(goal));
  });

  app.patch<{ Params: { id: string } }>('/goals/:id', async (req, reply) => {
    const parsed = z
      .object({
        name: z.string().min(1).optional(),
        folder: z.string().max(80).nullable().optional(),
        status: z.enum(['active', 'done', 'archived']).optional(),
        periodStart: z.string().optional(),
        periodEnd: z.string().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const workspaceId = await goalWorkspace(req.params.id);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) return reply.code(403).send({ error: 'forbidden' });
    const goal = await prisma.goal.update({
      where: { id: req.params.id },
      data: {
        name: parsed.data.name ?? undefined,
        folder: parsed.data.folder === undefined ? undefined : parsed.data.folder,
        status: parsed.data.status ?? undefined,
        periodStart: parsed.data.periodStart ? new Date(parsed.data.periodStart) : undefined,
        periodEnd: parsed.data.periodEnd ? new Date(parsed.data.periodEnd) : undefined,
      },
      include: INCLUDE,
    });
    return reply.send(serializeGoal(goal));
  });

  app.delete<{ Params: { id: string } }>('/goals/:id', async (req, reply) => {
    const workspaceId = await goalWorkspace(req.params.id);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) return reply.code(403).send({ error: 'forbidden' });
    await prisma.goal.delete({ where: { id: req.params.id } });
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>('/goals/:id/targets', async (req, reply) => {
    const parsed = z
      .object({
        name: z.string().min(1),
        type: z.enum(['number', 'currency', 'task_completion', 'boolean']).optional(),
        unit: z.string().max(20).optional(),
        startValue: z.number().optional(),
        targetValue: z.number().optional(),
        weight: z.number().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const workspaceId = await goalWorkspace(req.params.id);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) return reply.code(403).send({ error: 'forbidden' });
    const target = await prisma.target.create({
      data: {
        goalId: req.params.id,
        name: parsed.data.name,
        type: parsed.data.type ?? 'number',
        unit: parsed.data.unit ?? null,
        startValue: parsed.data.startValue ?? 0,
        targetValue: parsed.data.targetValue ?? 0,
        weight: parsed.data.weight ?? 1,
      },
      include: { tasks: { include: { task: { select: { id: true, title: true, status: { select: { type: true } } } } } } },
    });
    const p = progressOf(target as unknown as LoadedTarget);
    return reply.code(201).send({ ...target, progress: p.progress, done: p.done ?? null, total: p.total ?? null });
  });

  app.patch<{ Params: { targetId: string } }>('/targets/:targetId', async (req, reply) => {
    const parsed = z
      .object({
        name: z.string().min(1).optional(),
        currentValue: z.number().optional(),
        targetValue: z.number().optional(),
        startValue: z.number().optional(),
        weight: z.number().optional(),
        unit: z.string().max(20).nullable().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const workspaceId = await targetWorkspace(req.params.targetId);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) return reply.code(403).send({ error: 'forbidden' });
    return prisma.target.update({
      where: { id: req.params.targetId },
      data: {
        name: parsed.data.name ?? undefined,
        currentValue: parsed.data.currentValue ?? undefined,
        targetValue: parsed.data.targetValue ?? undefined,
        startValue: parsed.data.startValue ?? undefined,
        weight: parsed.data.weight ?? undefined,
        unit: parsed.data.unit === undefined ? undefined : parsed.data.unit,
      },
    });
  });

  app.delete<{ Params: { targetId: string } }>('/targets/:targetId', async (req, reply) => {
    const workspaceId = await targetWorkspace(req.params.targetId);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) return reply.code(403).send({ error: 'forbidden' });
    await prisma.target.delete({ where: { id: req.params.targetId } });
    return reply.code(204).send();
  });

  app.post<{ Params: { targetId: string } }>('/targets/:targetId/tasks', async (req, reply) => {
    const parsed = z.object({ taskId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const workspaceId = await targetWorkspace(req.params.targetId);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) return reply.code(403).send({ error: 'forbidden' });
    await prisma.targetTask.upsert({
      where: { targetId_taskId: { targetId: req.params.targetId, taskId: parsed.data.taskId } },
      create: { targetId: req.params.targetId, taskId: parsed.data.taskId },
      update: {},
    });
    return reply.code(201).send({ ok: true });
  });

  app.delete<{ Params: { targetId: string; taskId: string } }>(
    '/targets/:targetId/tasks/:taskId',
    async (req, reply) => {
      const workspaceId = await targetWorkspace(req.params.targetId);
      if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
      if (!(await isMember(workspaceId, currentUserId(req)))) return reply.code(403).send({ error: 'forbidden' });
      await prisma.targetTask.deleteMany({
        where: { targetId: req.params.targetId, taskId: req.params.taskId },
      });
      return reply.code(204).send();
    },
  );
}
