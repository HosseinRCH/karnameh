import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, currentUserId } from '../lib/auth';
import { isMember, workspaceIdForList, workspaceIdForTask } from '../lib/access';

const MIN = 60_000;

async function sharesWorkspace(a: string, b: string): Promise<boolean> {
  if (a === b) return true;
  const found = await prisma.membership.findFirst({
    where: { userId: a, workspace: { memberships: { some: { userId: b } } } },
    select: { id: true },
  });
  return found !== null;
}

/** Time tracking & reporting over completed focus sessions + manual entries. */
export async function timeRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // ---- Report ------------------------------------------------------------
  app.get<{ Querystring: { listId?: string } }>('/report', async (req, reply) => {
    const parsed = z.object({ listId: z.string().uuid() }).safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query' });
    const workspaceId = await workspaceIdForList(parsed.data.listId);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }

    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    const defaultRate = ws?.hourlyRate ?? 0;
    const currency = ws?.currency ?? 'IRR';

    const tasks = await prisma.task.findMany({
      where: { listId: parsed.data.listId },
      select: { id: true, title: true, estimateMs: true },
      orderBy: { position: 'asc' },
    });
    const taskIds = tasks.map((t) => t.id);
    const userSelect = { select: { id: true, name: true, billableRate: true } };

    const [sessions, entries] = await Promise.all([
      prisma.focusSession.findMany({
        where: { taskId: { in: taskIds }, status: 'completed' },
        include: { user: userSelect },
      }),
      prisma.timeEntry.findMany({ where: { taskId: { in: taskIds } }, include: { user: userSelect } }),
    ]);

    const items = [
      ...sessions.map((s) => ({
        userId: s.userId,
        name: s.user.name,
        taskId: s.taskId,
        minutes: s.durationMinutes,
        billable: s.billable,
        rate: s.user.billableRate ?? defaultRate,
      })),
      ...entries.map((e) => ({
        userId: e.userId,
        name: e.user.name,
        taskId: e.taskId,
        minutes: e.durationMinutes,
        billable: e.billable,
        rate: e.user.billableRate ?? defaultRate,
      })),
    ];

    const totalMs = items.reduce((s, i) => s + i.minutes * MIN, 0);
    const billableMs = items.filter((i) => i.billable).reduce((s, i) => s + i.minutes * MIN, 0);
    const billableAmount = Math.round(
      items.filter((i) => i.billable).reduce((s, i) => s + (i.minutes / 60) * i.rate, 0),
    );

    const byTask = tasks.map((t) => ({
      taskId: t.id,
      title: t.title,
      estimateMs: t.estimateMs ?? 0,
      actualMs: items.filter((i) => i.taskId === t.id).reduce((a, i) => a + i.minutes * MIN, 0),
    }));

    const umap = new Map<string, { userId: string; name: string; totalMs: number; billableMs: number; amount: number }>();
    for (const i of items) {
      const cur = umap.get(i.userId) ?? { userId: i.userId, name: i.name, totalMs: 0, billableMs: 0, amount: 0 };
      cur.totalMs += i.minutes * MIN;
      if (i.billable) {
        cur.billableMs += i.minutes * MIN;
        cur.amount += Math.round((i.minutes / 60) * i.rate);
      }
      umap.set(i.userId, cur);
    }

    return {
      currency,
      totals: { totalMs, billableMs, billableAmount, sessions: items.length },
      byTask,
      byUser: [...umap.values()],
    };
  });

  // ---- Manual time entries ----------------------------------------------
  app.get<{ Querystring: { listId?: string } }>('/entries', async (req, reply) => {
    const parsed = z.object({ listId: z.string().uuid() }).safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query' });
    const workspaceId = await workspaceIdForList(parsed.data.listId);
    if (!workspaceId) return reply.code(404).send({ error: 'not_found' });
    if (!(await isMember(workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const tasks = await prisma.task.findMany({ where: { listId: parsed.data.listId }, select: { id: true } });
    return prisma.timeEntry.findMany({
      where: { taskId: { in: tasks.map((t) => t.id) } },
      orderBy: { spentOn: 'desc' },
      take: 50,
      include: { user: { select: { id: true, name: true } }, task: { select: { id: true, title: true } } },
    });
  });

  app.post('/entries', async (req, reply) => {
    const parsed = z
      .object({
        taskId: z.string().uuid().optional(),
        durationMinutes: z.number().int().min(1).max(24 * 60),
        billable: z.boolean().optional(),
        description: z.string().max(300).optional(),
        spentOn: z.string().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const userId = currentUserId(req);
    if (parsed.data.taskId) {
      const workspaceId = await workspaceIdForTask(parsed.data.taskId);
      if (!workspaceId || !(await isMember(workspaceId, userId))) {
        return reply.code(400).send({ error: 'invalid_task' });
      }
    }
    const entry = await prisma.timeEntry.create({
      data: {
        userId,
        taskId: parsed.data.taskId ?? null,
        durationMinutes: parsed.data.durationMinutes,
        billable: parsed.data.billable ?? false,
        description: parsed.data.description ?? null,
        spentOn: parsed.data.spentOn ? new Date(parsed.data.spentOn) : new Date(),
      },
    });
    return reply.code(201).send(entry);
  });

  app.delete<{ Params: { id: string } }>('/entries/:id', async (req, reply) => {
    const entry = await prisma.timeEntry.findUnique({ where: { id: req.params.id } });
    if (!entry) return reply.code(404).send({ error: 'not_found' });
    if (entry.userId !== currentUserId(req)) return reply.code(403).send({ error: 'forbidden' });
    await prisma.timeEntry.delete({ where: { id: entry.id } });
    return reply.code(204).send();
  });

  // ---- Timesheets --------------------------------------------------------
  app.get<{ Querystring: { userId?: string } }>('/timesheets', async (req, reply) => {
    const userId = req.query.userId ?? currentUserId(req);
    if (!(await sharesWorkspace(userId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    return prisma.timesheet.findMany({
      where: { userId },
      orderBy: { periodStart: 'desc' },
      take: 20,
      include: { user: { select: { id: true, name: true } } },
    });
  });

  app.post('/timesheets', async (req, reply) => {
    const parsed = z.object({ periodStart: z.string(), periodEnd: z.string() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const userId = currentUserId(req);
    const start = new Date(parsed.data.periodStart);
    const end = new Date(parsed.data.periodEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return reply.code(400).send({ error: 'invalid_period' });
    }
    const [sessions, entries] = await Promise.all([
      prisma.focusSession.findMany({
        where: { userId, status: 'completed', startedAt: { gte: start, lt: end } },
      }),
      prisma.timeEntry.findMany({ where: { userId, spentOn: { gte: start, lt: end } } }),
    ]);
    const all = [
      ...sessions.map((s) => ({ m: s.durationMinutes, b: s.billable })),
      ...entries.map((e) => ({ m: e.durationMinutes, b: e.billable })),
    ];
    const totalMs = all.reduce((s, x) => s + x.m * MIN, 0);
    const billableMs = all.filter((x) => x.b).reduce((s, x) => s + x.m * MIN, 0);
    const timesheet = await prisma.timesheet.create({
      data: { userId, periodStart: start, periodEnd: end, status: 'submitted', totalMs, billableMs },
    });
    return reply.code(201).send(timesheet);
  });

  async function decide(id: string, userId: string, status: 'approved' | 'rejected', note?: string) {
    const sheet = await prisma.timesheet.findUnique({ where: { id } });
    if (!sheet) return { error: 'not_found' as const };
    if (!(await sharesWorkspace(sheet.userId, userId))) return { error: 'forbidden' as const };
    const updated = await prisma.timesheet.update({
      where: { id },
      data: { status, decidedBy: userId, decidedAt: new Date(), note: note ?? null },
    });
    return { timesheet: updated };
  }

  app.post<{ Params: { id: string } }>('/timesheets/:id/approve', async (req, reply) => {
    const r = await decide(req.params.id, currentUserId(req), 'approved');
    if ('error' in r) return reply.code(r.error === 'not_found' ? 404 : 403).send(r);
    return reply.send(r);
  });

  app.post<{ Params: { id: string } }>('/timesheets/:id/reject', async (req, reply) => {
    const parsed = z.object({ note: z.string().max(200).optional() }).safeParse(req.body ?? {});
    const r = await decide(req.params.id, currentUserId(req), 'rejected', parsed.success ? parsed.data.note : undefined);
    if ('error' in r) return reply.code(r.error === 'not_found' ? 404 : 403).send(r);
    return reply.send(r);
  });
}
