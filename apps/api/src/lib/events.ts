import { EventEmitter } from 'node:events';

export interface WorkspaceEvent {
  workspaceId: string;
  type: 'task.changed' | 'goal.changed' | 'notification' | 'activity' | string;
  payload?: unknown;
  at: number;
}

const bus = new EventEmitter();
bus.setMaxListeners(0);

export function emitToWorkspace(event: Omit<WorkspaceEvent, 'at'>): void {
  bus.emit('event', { ...event, at: Date.now() } satisfies WorkspaceEvent);
}

export function onWorkspaceEvent(listener: (event: WorkspaceEvent) => void): () => void {
  bus.on('event', listener);
  return () => bus.off('event', listener);
}
