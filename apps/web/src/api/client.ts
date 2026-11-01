import type { AuthResponse, CustomField, Space, Status, Task, TaskList, Workspace } from '@karnameh/shared';
import type {
  ActivityEntry,
  AppNotification,
  Automation,
  AutomationRun,
  Dashboard,
  Folder,
  Goal,
  ListDetail,
  Member,
  SavedView,
  SpaceWithLists,
  Tag,
  Target,
  TaskDetail,
  TaskListItem,
  TimeEntry,
  TimeReport,
  Timesheet,
  ViewConfig,
  Widget,
} from '../types';
import type { FocusActionResult, FocusProfile, FocusStateResponse } from '../focus/types';

const BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:4000' : '');
export const apiBase = BASE;
const TOKEN_KEY = 'karnameh.token';

export const tokenStore = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string): void => localStorage.setItem(TOKEN_KEY, token),
  clear: (): void => localStorage.removeItem(TOKEN_KEY),
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<AuthResponse | { twoFactorRequired: true; pendingToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  login2fa: (pendingToken: string, code: string) =>
    request<AuthResponse>('/auth/login/2fa', {
      method: 'POST',
      body: JSON.stringify({ pendingToken, code }),
    }),

  oauthProviders: () => request<string[]>('/auth/oauth/providers'),

  account: () =>
    request<{ id: string; email: string; name: string; locale: string; twoFactorEnabled: boolean }>(
      '/auth/me',
    ),

  twoFactorSetup: () =>
    request<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  twoFactorEnable: (code: string) =>
    request<{ twoFactorEnabled: boolean }>('/auth/2fa/enable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  twoFactorDisable: (code: string) =>
    request<{ twoFactorEnabled: boolean }>('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  reorderStatuses: (listId: string, ids: string[]) =>
    request<Status[]>(`/lists/${listId}/statuses/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ ids }),
    }),

  workspaces: () => request<Workspace[]>('/workspaces'),

  createWorkspace: (name: string) =>
    request<Workspace>('/workspaces', { method: 'POST', body: JSON.stringify({ name }) }),

  addDependency: (taskId: string, dependsOnTaskId: string) =>
    request<unknown>(`/tasks/${taskId}/dependencies`, {
      method: 'POST',
      body: JSON.stringify({ dependsOnTaskId }),
    }),

  removeDependency: (taskId: string, dependsOnTaskId: string) =>
    request<void>(`/tasks/${taskId}/dependencies/${dependsOnTaskId}`, { method: 'DELETE' }),

  dashboards: (workspaceId: string) =>
    request<Dashboard[]>(`/dashboards?workspaceId=${encodeURIComponent(workspaceId)}`),

  createDashboard: (workspaceId: string, name: string) =>
    request<Dashboard>('/dashboards', {
      method: 'POST',
      body: JSON.stringify({ workspaceId, name, config: { widgets: [] } }),
    }),

  updateDashboard: (id: string, patch: { name?: string; config?: { widgets: Widget[] } }) =>
    request<Dashboard>(`/dashboards/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  deleteDashboard: (id: string) => request<void>(`/dashboards/${id}`, { method: 'DELETE' }),

  spaces: (workspaceId: string) =>
    request<SpaceWithLists[]>(`/spaces?workspaceId=${encodeURIComponent(workspaceId)}`),

  lists: (spaceId: string) =>
    request<TaskList[]>(`/lists?spaceId=${encodeURIComponent(spaceId)}`),

  list: (listId: string) => request<ListDetail>(`/lists/${listId}`),

  tasks: (listId: string, q?: string) => {
    const query = q ? `&q=${encodeURIComponent(q)}` : '';
    return request<TaskListItem[]>(`/tasks?listId=${encodeURIComponent(listId)}${query}`);
  },

  createTask: (input: { listId: string; title: string; priority?: string; parentTaskId?: string }) =>
    request<Task>('/tasks', { method: 'POST', body: JSON.stringify(input) }),

  updateTask: (taskId: string, patch: Record<string, unknown>) =>
    request<Task>(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  focusState: () => request<FocusStateResponse>('/focus/state'),

  startFocus: (input: { durationMinutes: number; taskId?: string; billable?: boolean }) =>
    request<FocusActionResult>('/focus/sessions', { method: 'POST', body: JSON.stringify(input) }),

  completeFocus: (sessionId: string) =>
    request<FocusActionResult>(`/focus/sessions/${sessionId}/complete`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  failFocus: (sessionId: string, reason?: string) =>
    request<FocusActionResult>(`/focus/sessions/${sessionId}/fail`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  cancelFocus: (sessionId: string) =>
    request<FocusActionResult>(`/focus/sessions/${sessionId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  clearRuin: (nodeId: string) =>
    request<{ ok: boolean; cost: number; profile: FocusProfile }>(`/focus/ruins/${nodeId}/clear`, {
      method: 'POST',
    }),

  deleteTask: (taskId: string) => request<void>(`/tasks/${taskId}`, { method: 'DELETE' }),

  members: (workspaceId: string) => request<Member[]>(`/workspaces/${workspaceId}/members`),

  addMember: (workspaceId: string, input: { email: string; name?: string; role?: string }) =>
    request<{ member: Member; temporaryPassword?: string }>(`/workspaces/${workspaceId}/members`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  createSpace: (input: { workspaceId: string; name: string }) =>
    request<Space>('/spaces', { method: 'POST', body: JSON.stringify(input) }),

  createFolder: (spaceId: string, name: string) =>
    request<Folder>(`/spaces/${spaceId}/folders`, { method: 'POST', body: JSON.stringify({ name }) }),

  createList: (input: { spaceId: string; name: string; folderId?: string }) =>
    request<TaskList>('/lists', { method: 'POST', body: JSON.stringify(input) }),

  createStatus: (listId: string, input: { name: string; type?: string; color?: string }) =>
    request<Status>(`/lists/${listId}/statuses`, { method: 'POST', body: JSON.stringify(input) }),

  createField: (listId: string, input: { name: string; type: string }) =>
    request<CustomField>(`/lists/${listId}/fields`, { method: 'POST', body: JSON.stringify(input) }),

  updateMemberRole: (workspaceId: string, userId: string, role: string) =>
    request<unknown>(`/workspaces/${workspaceId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  removeMember: (workspaceId: string, userId: string) =>
    request<void>(`/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE' }),

  deleteTag: (workspaceId: string, tagId: string) =>
    request<void>(`/workspaces/${workspaceId}/tags/${tagId}`, { method: 'DELETE' }),

  renameList: (listId: string, name: string) =>
    request<unknown>(`/lists/${listId}`, { method: 'PATCH', body: JSON.stringify({ name }) }),

  deleteList: (listId: string) => request<void>(`/lists/${listId}`, { method: 'DELETE' }),

  renameFolder: (folderId: string, name: string) =>
    request<unknown>(`/folders/${folderId}`, { method: 'PATCH', body: JSON.stringify({ name }) }),

  deleteFolder: (folderId: string) => request<void>(`/folders/${folderId}`, { method: 'DELETE' }),

  deleteStatus: (listId: string, statusId: string) =>
    request<void>(`/lists/${listId}/statuses/${statusId}`, { method: 'DELETE' }),

  deleteField: (listId: string, fieldId: string) =>
    request<void>(`/lists/${listId}/fields/${fieldId}`, { method: 'DELETE' }),

  tags: (workspaceId: string) => request<Tag[]>(`/workspaces/${workspaceId}/tags`),

  createTag: (workspaceId: string, name: string) =>
    request<Tag>(`/workspaces/${workspaceId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  taskDetail: (taskId: string) => request<TaskDetail>(`/tasks/${taskId}`),

  setFieldValue: (taskId: string, fieldId: string, value: unknown) =>
    request<unknown>(`/tasks/${taskId}/fields/${fieldId}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }),

  assignTask: (taskId: string, userId: string) =>
    request<unknown>(`/tasks/${taskId}/assignees`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  unassignTask: (taskId: string, userId: string) =>
    request<void>(`/tasks/${taskId}/assignees/${userId}`, { method: 'DELETE' }),

  tagTask: (taskId: string, tagId: string) =>
    request<unknown>(`/tasks/${taskId}/tags`, { method: 'POST', body: JSON.stringify({ tagId }) }),

  untagTask: (taskId: string, tagId: string) =>
    request<void>(`/tasks/${taskId}/tags/${tagId}`, { method: 'DELETE' }),

  views: (listId: string) => request<SavedView[]>(`/lists/${listId}/views`),

  createView: (listId: string, input: { name: string; type: 'list' | 'board'; config: ViewConfig }) =>
    request<SavedView>(`/lists/${listId}/views`, { method: 'POST', body: JSON.stringify(input) }),

  deleteView: (viewId: string) => request<void>(`/views/${viewId}`, { method: 'DELETE' }),

  setViewDefault: (viewId: string) =>
    request<SavedView>(`/views/${viewId}`, { method: 'PATCH', body: JSON.stringify({ isDefault: true }) }),

  goals: (workspaceId: string) =>
    request<Goal[]>(`/goals?workspaceId=${encodeURIComponent(workspaceId)}`),

  createGoal: (input: {
    workspaceId: string;
    name: string;
    folder?: string;
    periodType?: string;
    periodStart: string;
    periodEnd: string;
  }) => request<Goal>('/goals', { method: 'POST', body: JSON.stringify(input) }),

  updateGoal: (id: string, patch: Record<string, unknown>) =>
    request<Goal>(`/goals/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  deleteGoal: (id: string) => request<void>(`/goals/${id}`, { method: 'DELETE' }),

  createTarget: (
    goalId: string,
    input: { name: string; type?: string; unit?: string; targetValue?: number; weight?: number },
  ) => request<Target>(`/goals/${goalId}/targets`, { method: 'POST', body: JSON.stringify(input) }),

  updateTarget: (targetId: string, patch: Record<string, unknown>) =>
    request<Target>(`/targets/${targetId}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  deleteTarget: (targetId: string) => request<void>(`/targets/${targetId}`, { method: 'DELETE' }),

  linkTargetTask: (targetId: string, taskId: string) =>
    request<unknown>(`/targets/${targetId}/tasks`, { method: 'POST', body: JSON.stringify({ taskId }) }),

  unlinkTargetTask: (targetId: string, taskId: string) =>
    request<void>(`/targets/${targetId}/tasks/${taskId}`, { method: 'DELETE' }),

  automations: (workspaceId: string) =>
    request<Automation[]>(`/automations?workspaceId=${encodeURIComponent(workspaceId)}`),

  createAutomation: (input: {
    workspaceId: string;
    name: string;
    trigger: { type: string; to?: string };
    conditions?: { items?: Array<{ field: string; operator: string; value: string }> };
    actions: Array<{ type: string; params?: Record<string, unknown> }>;
  }) => request<Automation>('/automations', { method: 'POST', body: JSON.stringify(input) }),

  updateAutomation: (id: string, patch: Record<string, unknown>) =>
    request<Automation>(`/automations/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  deleteAutomation: (id: string) => request<void>(`/automations/${id}`, { method: 'DELETE' }),

  automationRuns: (workspaceId: string) =>
    request<AutomationRun[]>(`/automations/runs?workspaceId=${encodeURIComponent(workspaceId)}`),

  dryRunAutomation: (id: string, taskId: string) =>
    request<{ matches: boolean; projected: Array<{ action: string; params: Record<string, unknown> }> }>(
      `/automations/${id}/dry-run`,
      { method: 'POST', body: JSON.stringify({ taskId }) },
    ),

  activity: (workspaceId: string) =>
    request<ActivityEntry[]>(`/activity?workspaceId=${encodeURIComponent(workspaceId)}`),

  notifications: () => request<AppNotification[]>('/notifications'),

  markNotificationRead: (id: string) =>
    request<AppNotification>(`/notifications/${id}/read`, { method: 'POST', body: JSON.stringify({}) }),

  markAllNotificationsRead: () =>
    request<{ ok: boolean }>('/notifications/read-all', { method: 'POST', body: JSON.stringify({}) }),

  exportWorkspace: (workspaceId: string) =>
    request<unknown>(`/export?workspaceId=${encodeURIComponent(workspaceId)}`),

  importWorkspace: (bundle: unknown) =>
    request<{ workspace: Workspace }>('/import', {
      method: 'POST',
      body: JSON.stringify({ bundle }),
    }),

  timeReport: (listId: string) =>
    request<TimeReport>(`/time/report?listId=${encodeURIComponent(listId)}`),

  timesheets: (userId?: string) =>
    request<Timesheet[]>(`/time/timesheets${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`),

  submitTimesheet: (periodStart: string, periodEnd: string) =>
    request<Timesheet>('/time/timesheets', {
      method: 'POST',
      body: JSON.stringify({ periodStart, periodEnd }),
    }),

  approveTimesheet: (id: string) =>
    request<{ timesheet: Timesheet }>(`/time/timesheets/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  rejectTimesheet: (id: string, note?: string) =>
    request<{ timesheet: Timesheet }>(`/time/timesheets/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),

  timeEntries: (listId: string) =>
    request<TimeEntry[]>(`/time/entries?listId=${encodeURIComponent(listId)}`),

  createTimeEntry: (input: {
    taskId?: string;
    durationMinutes: number;
    billable?: boolean;
    description?: string;
  }) => request<TimeEntry>('/time/entries', { method: 'POST', body: JSON.stringify(input) }),

  deleteTimeEntry: (id: string) => request<void>(`/time/entries/${id}`, { method: 'DELETE' }),

  updateWorkspaceSettings: (workspaceId: string, patch: { hourlyRate?: number | null; currency?: string }) =>
    request<Workspace>(`/workspaces/${workspaceId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  setAssigneeEstimate: (taskId: string, userId: string, estimateMs: number | null) =>
    request<unknown>(`/tasks/${taskId}/assignees/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ estimateMs }),
    }),
};
