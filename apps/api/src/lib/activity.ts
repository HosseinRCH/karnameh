import { prisma } from '../db';
import { emitToWorkspace } from './events';

/** Append an entry to the workspace activity log. */
export async function logActivity(entry: {
  workspaceId: string;
  actorId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  meta?: unknown;
}) {
  const activity = await prisma.activity.create({
    data: {
      workspaceId: entry.workspaceId,
      actorId: entry.actorId ?? null,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      action: entry.action,
      meta: (entry.meta ?? null) as never,
    },
  });
  emitToWorkspace({ workspaceId: entry.workspaceId, type: 'activity', payload: { id: activity.id } });
  return activity;
}

/** Create an in-app notification for a user and broadcast it. */
export async function notify(entry: {
  workspaceId: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  view?: string;
}) {
  const notification = await prisma.notification.create({
    data: {
      userId: entry.userId,
      type: entry.type,
      title: entry.title,
      body: entry.body ?? null,
      view: entry.view ?? null,
    },
  });
  emitToWorkspace({
    workspaceId: entry.workspaceId,
    type: 'notification',
    payload: { userId: entry.userId, id: notification.id },
  });
  return notification;
}
