import type { Priority } from '@karnameh/shared';
import type { TaskListItem, ViewConfig } from '../types';

const PRIORITY_ORDER: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
  none: 4,
};

/** Apply a saved view's filters + sort to a task list (client-side). */
export function applyView(tasks: TaskListItem[], config: ViewConfig): TaskListItem[] {
  let out = tasks;

  if (config.statusIds?.length) {
    out = out.filter((t) => config.statusIds?.includes(t.statusId));
  }
  if (config.priority?.length) {
    out = out.filter((t) => config.priority?.includes(t.priority));
  }
  if (config.assigneeIds?.length) {
    out = out.filter((t) => t.assignees.some((a) => config.assigneeIds?.includes(a.userId)));
  }
  if (config.tagIds?.length) {
    out = out.filter((t) => t.tags.some((tt) => config.tagIds?.includes(tt.tagId)));
  }

  const sortBy = config.sortBy ?? 'position';
  const dir = config.sortDir === 'desc' ? -1 : 1;
  return [...out].sort((a, b) => {
    switch (sortBy) {
      case 'priority':
        return (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) * dir;
      case 'title':
        return a.title.localeCompare(b.title) * dir;
      case 'dueDate': {
        const av = a.dueDate ? Date.parse(a.dueDate) : Number.MAX_SAFE_INTEGER;
        const bv = b.dueDate ? Date.parse(b.dueDate) : Number.MAX_SAFE_INTEGER;
        return (av - bv) * dir;
      }
      default:
        return (a.position - b.position) * dir;
    }
  });
}
