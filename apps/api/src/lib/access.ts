import { prisma } from '../db';

/**
 * True when the user is a member of the workspace. Phase 0 uses a simple
 * membership check; role-based permissions are layered in later phases.
 */
export async function isMember(workspaceId: string, userId: string): Promise<boolean> {
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { id: true },
  });
  return membership !== null;
}

/** Resolve the workspace that owns a list, via list -> space -> workspace. */
export async function workspaceIdForList(listId: string): Promise<string | null> {
  const list = await prisma.taskList.findUnique({
    where: { id: listId },
    select: { space: { select: { workspaceId: true } } },
  });
  return list?.space.workspaceId ?? null;
}

/** Resolve the workspace that owns a task. */
export async function workspaceIdForTask(taskId: string): Promise<string | null> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { list: { select: { space: { select: { workspaceId: true } } } } },
  });
  return task?.list.space.workspaceId ?? null;
}

/** Resolve the workspace that owns a space. */
export async function workspaceIdForSpace(spaceId: string): Promise<string | null> {
  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: { workspaceId: true },
  });
  return space?.workspaceId ?? null;
}

/** Resolve the workspace that owns a folder. */
export async function workspaceIdForFolder(folderId: string): Promise<string | null> {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    select: { space: { select: { workspaceId: true } } },
  });
  return folder?.space.workspaceId ?? null;
}
