import { prisma } from '../db';

export interface AutomationTrigger {
  type: 'task.created' | 'task.updated' | 'task.status_changed';
  to?: string;
}

export interface ConditionItem {
  field: 'priority' | 'statusId' | 'assigneeId';
  operator: 'equals' | 'not_equals';
  value: string;
}

export interface AutomationConditions {
  op?: 'and' | 'or';
  items?: ConditionItem[];
}

export interface AutomationAction {
  type: 'task.set_priority' | 'task.set_status' | 'task.assign' | 'time.start';
  params?: Record<string, unknown>;
}

export interface AutomationEvent {
  workspaceId: string;
  type: 'task.created' | 'task.updated' | 'task.status_changed';
  taskId: string;
  actorId: string;
  depth?: number;
  visited?: string[];
}

const MAX_DEPTH = 3;

async function actorFor(runAs: string, workspaceId: string, actorId: string): Promise<string> {
  if (runAs === 'actor') return actorId;
  const owner = await prisma.membership.findFirst({
    where: { workspaceId, role: 'owner' },
    select: { userId: true },
  });
  return owner?.userId ?? actorId;
}

function evaluateConditions(
  conditions: AutomationConditions,
  task: { priority: string; statusId: string; assignees: Array<{ userId: string }> },
  actorId: string,
): boolean {
  const items = conditions?.items ?? [];
  if (items.length === 0) return true;
  const results = items.map((it) => {
    if (it.field === 'priority') return task.priority === it.value;
    if (it.field === 'statusId') return task.statusId === it.value;
    if (it.field === 'assigneeId') {
      const present = task.assignees.some((a) => a.userId === it.value || (it.value === 'actor' && a.userId === actorId));
      return it.operator === 'not_equals' ? !present : present;
    }
    return true;
  });
  return (conditions.op ?? 'and') === 'or' ? results.some(Boolean) : results.every(Boolean);
}

async function applyAction(
  action: AutomationAction,
  ctx: { taskId: string; actorId: string },
): Promise<string> {
  const params = action.params ?? {};
  switch (action.type) {
    case 'task.set_priority':
      await prisma.task.update({
        where: { id: ctx.taskId },
        data: { priority: (params.value as never) ?? 'none' },
      });
      return `priority -> ${params.value}`;
    case 'task.set_status': {
      let statusId = params.statusId as string | undefined;
      if (!statusId && params.statusName) {
        const task = await prisma.task.findUnique({ where: { id: ctx.taskId }, select: { listId: true } });
        const status = await prisma.status.findFirst({
          where: { listId: task!.listId, name: params.statusName as string },
        });
        statusId = status?.id;
      }
      if (!statusId) throw new Error('status_not_found');
      const status = await prisma.status.findUnique({ where: { id: statusId } });
      await prisma.task.update({
        where: { id: ctx.taskId },
        data: {
          statusId,
          completedAt: status && ['done', 'closed'].includes(status.type) ? new Date() : null,
        },
      });
      return `status -> ${status?.name ?? statusId}`;
    }
    case 'task.assign':
      if (!params.userId) throw new Error('missing_user');
      await prisma.taskAssignee.upsert({
        where: { taskId_userId: { taskId: ctx.taskId, userId: params.userId as string } },
        create: { taskId: ctx.taskId, userId: params.userId as string },
        update: {},
      });
      return 'assigned';
    case 'time.start': {
      const running = await prisma.focusSession.findFirst({
        where: { userId: ctx.actorId, status: { in: ['running', 'paused'] } },
      });
      if (running) return 'timer already running';
      await prisma.focusSession.create({
        data: {
          userId: ctx.actorId,
          taskId: ctx.taskId,
          durationMinutes: Number(params.durationMinutes ?? 25),
          billable: Boolean(params.billable ?? false),
        },
      });
      return 'timer started';
    }
    default:
      throw new Error(`unknown_action_${action.type}`);
  }
}

/** Evaluate and run matching automations for a task event (with loop protection). */
export async function runAutomations(event: AutomationEvent): Promise<void> {
  const depth = event.depth ?? 0;
  const visited = event.visited ?? [];

  const task = await prisma.task.findUnique({
    where: { id: event.taskId },
    include: { assignees: true },
  });
  if (!task) return;

  const automations = await prisma.automation.findMany({
    where: { workspaceId: event.workspaceId, enabled: true },
  });

  for (const auto of automations) {
    const trigger = auto.trigger as unknown as AutomationTrigger;
    if (trigger.type !== event.type) continue;
    if (event.type === 'task.status_changed' && trigger.to && trigger.to !== task.statusId) continue;

    if (visited.includes(auto.id) || depth >= MAX_DEPTH) {
      await prisma.automationRun.create({
        data: { automationId: auto.id, status: 'looped', triggerType: event.type, log: [] as never },
      });
      continue;
    }

    const conditions = auto.conditions as unknown as AutomationConditions;
    if (!evaluateConditions(conditions, task, event.actorId)) {
      await prisma.automationRun.create({
        data: { automationId: auto.id, status: 'skipped', triggerType: event.type, log: [] as never },
      });
      continue;
    }

    const actions = auto.actions as unknown as AutomationAction[];
    const actor = await actorFor(auto.runAs, event.workspaceId, event.actorId);
    const log: Array<{ action: string; ok: boolean; detail?: string }> = [];
    const preStatus = task.statusId;

    for (const action of actions) {
      try {
        const detail = await applyAction(action, { taskId: event.taskId, actorId: actor });
        log.push({ action: action.type, ok: true, detail });
      } catch (err) {
        log.push({ action: action.type, ok: false, detail: String(err) });
      }
    }

    await prisma.automationRun.create({
      data: { automationId: auto.id, status: 'success', triggerType: event.type, log: log as never },
    });

    const after = await prisma.task.findUnique({ where: { id: event.taskId }, select: { statusId: true } });
    if (after && after.statusId !== preStatus) {
      await runAutomations({
        ...event,
        type: 'task.status_changed',
        depth: depth + 1,
        visited: [...visited, auto.id],
      });
    }
  }
}

/** Compute the projected effect of an automation without persisting anything. */
export async function dryRunAutomation(automationId: string, taskId: string) {
  const auto = await prisma.automation.findUnique({ where: { id: automationId } });
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { assignees: true } });
  if (!auto || !task) return null;
  const conditions = auto.conditions as unknown as AutomationConditions;
  const matches = evaluateConditions(conditions, task, task.id);
  const actions = auto.actions as unknown as AutomationAction[];
  return {
    matches,
    projected: matches ? actions.map((a) => ({ action: a.type, params: a.params ?? {} })) : [],
  };
}
