import type { CustomField, Priority, Space, Status, Task, TaskList } from '@karnameh/shared';

/** Space as returned by `GET /spaces` (with lists + folders eager-loaded). */
export type SpaceWithLists = Space & { lists: TaskList[]; folders: Folder[] };

export interface Folder {
  id: string;
  spaceId: string;
  name: string;
  position: number;
}

/** List as returned by `GET /lists/:id` (with statuses and custom fields). */
export type ListDetail = TaskList & { statuses: Status[]; fields: CustomField[] };

export interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Tag {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
}

export interface AssigneeRef {
  userId: string;
  estimateMs?: number | null;
  user: { id: string; name: string };
}

export interface TagRef {
  tagId: string;
  tag: Tag;
}

export interface TaskDependencyRef {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
}

/** Task as returned by `GET /tasks` (with assignees, tags + dependencies). */
export interface TaskListItem extends Task {
  estimateMs: number | null;
  updatedAt: string;
  assignees: AssigneeRef[];
  tags: TagRef[];
  dependencies: TaskDependencyRef[];
}

export interface Widget {
  id: string;
  type: string;
  metric: string;
}

export interface Dashboard {
  id: string;
  workspaceId: string;
  name: string;
  config: { widgets?: Widget[] } | null;
}

export type ViewKind =
  | 'list'
  | 'board'
  | 'calendar'
  | 'gantt'
  | 'timeline'
  | 'workload'
  | 'table'
  | 'activity'
  | 'time'
  | 'goals'
  | 'automations'
  | 'dashboard'
  | 'focus'
  | 'guide';

export interface Automation {
  id: string;
  workspaceId: string;
  name: string;
  enabled: boolean;
  trigger: { type: string; to?: string };
  conditions: { op?: string; items?: Array<{ field: string; operator: string; value: string }> };
  actions: Array<{ type: string; params?: Record<string, unknown> }>;
  runAs: string;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  status: string;
  triggerType: string;
  log: Array<{ action: string; ok: boolean; detail?: string }>;
  createdAt: string;
  automation?: { id: string; name: string };
}

export interface ActivityEntry {
  id: string;
  workspaceId: string;
  actorId: string | null;
  entityType: string;
  entityId: string | null;
  action: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
  actor?: { id: string; name: string } | null;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  view: string | null;
  read: boolean;
  createdAt: string;
}

export interface TargetTaskRef {
  taskId: string;
  title: string;
  statusType: string;
}

export interface Target {
  id: string;
  name: string;
  type: string;
  unit: string | null;
  startValue: number;
  targetValue: number;
  currentValue: number;
  weight: number;
  progress: number;
  done: number | null;
  total: number | null;
  tasks: TargetTaskRef[];
}

export interface Goal {
  id: string;
  name: string;
  folder: string | null;
  ownerId: string | null;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  progress: number;
  targets: Target[];
}

export interface TimeByTask {
  taskId: string;
  title: string;
  estimateMs: number;
  actualMs: number;
}

export interface TimeByUser {
  userId: string;
  name: string;
  totalMs: number;
  billableMs: number;
  amount: number;
}

export interface TimeReport {
  currency: string;
  totals: { totalMs: number; billableMs: number; billableAmount: number; sessions: number };
  byTask: TimeByTask[];
  byUser: TimeByUser[];
}

export interface TimeEntry {
  id: string;
  userId: string;
  taskId: string | null;
  description: string | null;
  durationMinutes: number;
  billable: boolean;
  spentOn: string;
  user?: { id: string; name: string };
  task?: { id: string; title: string } | null;
}

export interface Timesheet {
  id: string;
  userId: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalMs: number;
  billableMs: number;
  user?: { id: string; name: string };
}

/** Task as returned by `GET /tasks/:id` (full detail). */
export interface TaskDetail extends TaskListItem {
  status: Status;
  fieldValues: Array<{ fieldId: string; value: unknown }>;
  subtasks: Array<Task & { status: Status }>;
}

export type SortBy = 'position' | 'priority' | 'dueDate' | 'title';

export interface ViewConfig {
  search?: string;
  statusIds?: string[];
  priority?: Priority[];
  assigneeIds?: string[];
  tagIds?: string[];
  sortBy?: SortBy;
  sortDir?: 'asc' | 'desc';
  groupBy?: 'none' | 'status';
}

export interface SavedView {
  id: string;
  listId: string;
  name: string;
  type: 'list' | 'board';
  config: ViewConfig;
  isDefault: boolean;
}
