import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'node:crypto';
import { prisma } from '../db';
import { authenticate, currentUserId } from '../lib/auth';
import { isMember } from '../lib/access';
import { hashPassword } from '../lib/passwords';

type V = Record<string, any>;

/** Export a workspace as a portable JSON bundle, and import it as a new workspace. */
export async function transferRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get<{ Querystring: { workspaceId?: string } }>('/export', async (req, reply) => {
    const workspaceId = req.query.workspaceId;
    if (!workspaceId) return reply.code(400).send({ error: 'invalid_query' });
    if (!(await isMember(workspaceId, currentUserId(req)))) {
      return reply.code(403).send({ error: 'forbidden' });
    }

    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) return reply.code(404).send({ error: 'not_found' });

    const memberships = await prisma.membership.findMany({
      where: { workspaceId },
      include: { user: { select: { email: true, name: true } } },
    });
    const spaces = await prisma.space.findMany({ where: { workspaceId } });
    const spaceIds = spaces.map((s) => s.id);
    const folders = await prisma.folder.findMany({ where: { spaceId: { in: spaceIds } } });
    const lists = await prisma.taskList.findMany({ where: { spaceId: { in: spaceIds } } });
    const listIds = lists.map((l) => l.id);
    const statuses = await prisma.status.findMany({ where: { listId: { in: listIds } } });
    const tasks = await prisma.task.findMany({ where: { listId: { in: listIds } } });
    const taskIds = tasks.map((t) => t.id);
    const fields = await prisma.customField.findMany({ where: { listId: { in: listIds } } });
    const fieldIds = fields.map((f) => f.id);
    const values = await prisma.customFieldValue.findMany({ where: { fieldId: { in: fieldIds } } });
    const assigneesRaw = await prisma.taskAssignee.findMany({
      where: { taskId: { in: taskIds } },
      include: { user: { select: { email: true } } },
    });
    const assignees = assigneesRaw.map((a) => ({
      taskId: a.taskId,
      estimateMs: a.estimateMs,
      email: a.user.email,
    }));
    const tags = await prisma.tag.findMany({ where: { workspaceId } });
    const tagIds = tags.map((t) => t.id);
    const taskTags = await prisma.taskTag.findMany({ where: { taskId: { in: taskIds } } });
    const dependencies = await prisma.taskDependency.findMany({ where: { taskId: { in: taskIds } } });
    const goals = await prisma.goal.findMany({ where: { workspaceId } });
    const goalIds = goals.map((g) => g.id);
    const targets = await prisma.target.findMany({ where: { goalId: { in: goalIds } } });
    const targetIds = targets.map((t) => t.id);
    const targetTasks = await prisma.targetTask.findMany({ where: { targetId: { in: targetIds } } });
    const dashboards = await prisma.dashboard.findMany({ where: { workspaceId } });
    const automations = await prisma.automation.findMany({ where: { workspaceId } });
    const timeEntriesRaw = await prisma.timeEntry.findMany({
      where: { taskId: { in: taskIds } },
      include: { user: { select: { email: true } } },
    });
    const timeEntries = timeEntriesRaw.map((e) => ({
      taskId: e.taskId,
      email: e.user.email,
      description: e.description,
      durationMinutes: e.durationMinutes,
      billable: e.billable,
      spentOn: e.spentOn,
    }));
    const memberUserIds = memberships.map((m) => m.userId);
    const timesheetsRaw = await prisma.timesheet.findMany({
      where: { userId: { in: memberUserIds } },
      include: { user: { select: { email: true } } },
    });
    const timesheets = timesheetsRaw.map((t) => ({
      email: t.user.email,
      periodStart: t.periodStart,
      periodEnd: t.periodEnd,
      status: t.status,
      totalMs: t.totalMs,
      billableMs: t.billableMs,
    }));

    return {
      format: 'karnameh-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      workspace,
      members: memberships.map((m) => ({ email: m.user.email, name: m.user.name, role: m.role })),
      spaces,
      folders,
      lists,
      statuses,
      tasks,
      fields,
      values,
      assignees,
      tags,
      taskTags,
      dependencies,
      goals,
      targets,
      targetTasks,
      dashboards,
      automations,
      timeEntries,
      timesheets,
    };
  });

  app.post('/import', async (req, reply) => {
    const body = (req.body ?? {}) as { bundle?: unknown };
    const bundle = body.bundle as Record<string, unknown> | undefined;
    if (!bundle || bundle.format !== 'karnameh-export') {
      return reply.code(400).send({ error: 'invalid_bundle' });
    }
    const actorId = currentUserId(req);
    const srcWs = bundle.workspace as { name?: string; defaultLocale?: string; currency?: string; hourlyRate?: number | null };

    const newWs = await prisma.workspace.create({
      data: {
        name: `${srcWs?.name ?? 'Workspace'} (imported)`,
        slug: `imported-${randomBytes(4).toString('hex')}`,
        defaultLocale: srcWs?.defaultLocale ?? 'en',
        currency: srcWs?.currency ?? 'IRR',
        hourlyRate: srcWs?.hourlyRate ?? null,
      },
    });

    // Users: reuse by email, else create with a random password.
    const members = (bundle.members as Array<{ email: string; name: string; role: string }>) ?? [];
    const userMap = new Map<string, string>();
    for (const m of members) {
      let user = await prisma.user.findUnique({ where: { email: m.email } });
      if (!user) {
        user = await prisma.user.create({
          data: { email: m.email, name: m.name, passwordHash: hashPassword(randomBytes(12).toString('hex')) },
        });
      }
      userMap.set(m.email, user.id);
    }
    userMap.set('__actor__', actorId);
    for (const m of members) {
      const userId = userMap.get(m.email)!;
      await prisma.membership.upsert({
        where: { userId_workspaceId: { userId, workspaceId: newWs.id } },
        create: { userId, workspaceId: newWs.id, role: userId === actorId ? 'owner' : (m.role as never) },
        update: {},
      });
    }
    if (!(await prisma.membership.findUnique({ where: { userId_workspaceId: { userId: actorId, workspaceId: newWs.id } } }))) {
      await prisma.membership.create({ data: { userId: actorId, workspaceId: newWs.id, role: 'owner' } });
    }

    const spaceMap = new Map<string, string>();
    for (const s of (bundle.spaces as Array<V>) ?? []) {
      const created = await prisma.space.create({
        data: { workspaceId: newWs.id, name: s.name, color: s.color ?? null, position: s.position ?? 0 },
      });
      spaceMap.set(s.id, created.id);
    }

    const folderMap = new Map<string, string>();
    for (const f of (bundle.folders as Array<V>) ?? []) {
      const created = await prisma.folder.create({
        data: { spaceId: spaceMap.get(f.spaceId)!, name: f.name, position: f.position ?? 0 },
      });
      folderMap.set(f.id, created.id);
    }

    const listMap = new Map<string, string>();
    for (const l of (bundle.lists as Array<V>) ?? []) {
      const created = await prisma.taskList.create({
        data: {
          spaceId: spaceMap.get(l.spaceId)!,
          folderId: l.folderId ? folderMap.get(l.folderId) ?? null : null,
          name: l.name,
          position: l.position ?? 0,
        },
      });
      listMap.set(l.id, created.id);
    }

    const statusMap = new Map<string, string>();
    for (const s of (bundle.statuses as Array<V>) ?? []) {
      const created = await prisma.status.create({
        data: {
          listId: listMap.get(s.listId)!,
          name: s.name,
          type: (s.type as never) ?? 'open',
          color: s.color ?? '#64748b',
          position: s.position ?? 0,
        },
      });
      statusMap.set(s.id, created.id);
    }

    const taskMap = new Map<string, string>();
    const parents: Array<{ id: string; parentTaskId: string }> = [];
    for (const t of (bundle.tasks as Array<V>) ?? []) {
      const created = await prisma.task.create({
        data: {
          listId: listMap.get(t.listId)!,
          statusId: statusMap.get(t.statusId)!,
          title: t.title,
          description: t.description ?? null,
          priority: (t.priority as never) ?? 'none',
          position: t.position ?? 0,
          startDate: t.startDate ? new Date(t.startDate) : null,
          dueDate: t.dueDate ? new Date(t.dueDate) : null,
          estimateMs: t.estimateMs ? Number(t.estimateMs) : null,
          completedAt: t.completedAt ? new Date(t.completedAt) : null,
        },
      });
      taskMap.set(t.id, created.id);
      if (t.parentTaskId) parents.push({ id: created.id, parentTaskId: t.parentTaskId });
    }
    for (const p of parents) {
      const mapped = taskMap.get(p.parentTaskId);
      if (mapped) await prisma.task.update({ where: { id: p.id }, data: { parentTaskId: mapped } });
    }

    const fieldMap = new Map<string, string>();
    for (const f of (bundle.fields as Array<V>) ?? []) {
      const created = await prisma.customField.create({
        data: {
          listId: listMap.get(f.listId)!,
          name: f.name,
          type: (f.type as never) ?? 'text',
          config: (f.config ?? null) as never,
          required: Boolean(f.required),
          position: f.position ?? 0,
        },
      });
      fieldMap.set(f.id, created.id);
    }
    for (const v of (bundle.values as Array<Record<string, unknown>>) ?? []) {
      const taskId = taskMap.get(String(v.taskId));
      const fieldId = fieldMap.get(String(v.fieldId));
      if (taskId && fieldId) {
        await prisma.customFieldValue.create({ data: { taskId, fieldId, value: (v.value ?? null) as never } });
      }
    }

    const tagMap = new Map<string, string>();
    for (const tg of (bundle.tags as Array<V>) ?? []) {
      const created = await prisma.tag.create({
        data: { workspaceId: newWs.id, name: tg.name, color: tg.color ?? '#64748b' },
      });
      tagMap.set(tg.id, created.id);
    }
    for (const tt of (bundle.taskTags as Array<V>) ?? []) {
      const taskId = taskMap.get(tt.taskId);
      const tagId = tagMap.get(tt.tagId);
      if (taskId && tagId) await prisma.taskTag.create({ data: { taskId, tagId } }).catch(() => {});
    }

    for (const a of (bundle.assignees as Array<V>) ?? []) {
      const taskId = taskMap.get(a.taskId);
      const userId = userMap.get(String(a.email ?? '')) ?? actorId;
      if (taskId) {
        await prisma.taskAssignee
          .create({ data: { taskId, userId, estimateMs: a.estimateMs ? Number(a.estimateMs) : null } })
          .catch(() => {});
      }
    }

    for (const d of (bundle.dependencies as Array<V>) ?? []) {
      const taskId = taskMap.get(d.taskId);
      const dependsOnTaskId = taskMap.get(d.dependsOnTaskId);
      if (taskId && dependsOnTaskId) {
        await prisma.taskDependency.create({ data: { taskId, dependsOnTaskId } }).catch(() => {});
      }
    }

    const goalMap = new Map<string, string>();
    for (const g of (bundle.goals as Array<V>) ?? []) {
      const created = await prisma.goal.create({
        data: {
          workspaceId: newWs.id,
          name: g.name,
          folder: g.folder ?? null,
          periodType: g.periodType ?? 'quarter',
          periodStart: new Date(g.periodStart),
          periodEnd: new Date(g.periodEnd),
          status: g.status ?? 'active',
        },
      });
      goalMap.set(g.id, created.id);
    }
    const targetMap = new Map<string, string>();
    for (const t of (bundle.targets as Array<V>) ?? []) {
      const created = await prisma.target.create({
        data: {
          goalId: goalMap.get(t.goalId)!,
          name: t.name,
          type: t.type ?? 'number',
          unit: t.unit ?? null,
          startValue: Number(t.startValue ?? 0),
          targetValue: Number(t.targetValue ?? 0),
          currentValue: Number(t.currentValue ?? 0),
          weight: Number(t.weight ?? 1),
        },
      });
      targetMap.set(t.id, created.id);
    }
    for (const tt of (bundle.targetTasks as Array<V>) ?? []) {
      const targetId = targetMap.get(tt.targetId);
      const taskId = taskMap.get(tt.taskId);
      if (targetId && taskId) await prisma.targetTask.create({ data: { targetId, taskId } }).catch(() => {});
    }

    for (const d of (bundle.dashboards as Array<V>) ?? []) {
      await prisma.dashboard.create({
        data: { workspaceId: newWs.id, name: d.name, config: (d.config ?? { widgets: [] }) as never },
      });
    }

    const remap = (value: unknown) => (typeof value === 'string' && statusMap.has(value) ? statusMap.get(value) : value);
    for (const a of (bundle.automations as Array<V>) ?? []) {
      const trigger = (a.trigger ?? {}) as Record<string, unknown>;
      const conditions = (a.conditions ?? {}) as { items?: Array<Record<string, unknown>> };
      const actions = (a.actions ?? []) as Array<{ params?: Record<string, unknown> }>;
      await prisma.automation.create({
        data: {
          workspaceId: newWs.id,
          name: a.name,
          enabled: Boolean(a.enabled),
          runAs: a.runAs ?? 'owner',
          trigger: { ...trigger, to: remap(trigger.to) } as never,
          conditions: {
            ...conditions,
            items: (conditions.items ?? []).map((it) => ({ ...it, value: remap(it.value) })),
          } as never,
          actions: actions.map((ac) => ({
            ...ac,
            params: ac.params ? { ...ac.params, statusId: remap(ac.params.statusId) } : {},
          })) as never,
        },
      });
    }

    for (const e of (bundle.timeEntries as Array<V>) ?? []) {
      const taskId = e.taskId ? taskMap.get(e.taskId) ?? null : null;
      const userId = userMap.get(String(e.email ?? '')) ?? actorId;
      await prisma.timeEntry.create({
        data: {
          userId,
          taskId,
          description: e.description ?? null,
          durationMinutes: Number(e.durationMinutes ?? 0),
          billable: Boolean(e.billable),
          spentOn: e.spentOn ? new Date(e.spentOn) : new Date(),
        },
      });
    }

    for (const t of (bundle.timesheets as Array<V>) ?? []) {
      const userId = userMap.get(String(t.email ?? '')) ?? actorId;
      await prisma.timesheet.create({
        data: {
          userId,
          periodStart: new Date(t.periodStart),
          periodEnd: new Date(t.periodEnd),
          status: t.status ?? 'submitted',
          totalMs: Number(t.totalMs ?? 0),
          billableMs: Number(t.billableMs ?? 0),
        },
      });
    }

    return reply.code(201).send({ workspace: newWs, imported: true });
  });
}
