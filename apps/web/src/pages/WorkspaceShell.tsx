import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, apiBase, tokenStore } from '../api/client';
import type { ListDetail, SavedView, ViewConfig, ViewKind } from '../types';
import { applyView } from '../lib/view';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import FilterBar from '../components/FilterBar';
import TaskDetail from '../components/TaskDetail';
import ManagePanel from '../components/ManagePanel';
import TaskListView from '../views/TaskListView';
import TaskBoardView from '../views/TaskBoardView';
import CalendarView from '../views/CalendarView';
import GanttChart from '../views/GanttChart';
import WorkloadView from '../views/WorkloadView';
import TableView from '../views/TableView';
import ActivityView from '../views/ActivityView';
import TimeView from '../views/TimeView';
import GoalsView from '../views/GoalsView';
import AutomationsView from '../views/AutomationsView';
import GuideView from '../views/GuideView';
import DashboardView from '../views/DashboardView';
import FocusView from '../views/FocusView';

export default function WorkspaceShell({ onSignOut }: { onSignOut: () => void }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [view, setView] = useState<ViewKind>('list');
  const [config, setConfig] = useState<ViewConfig>({});
  const [search, setSearch] = useState('');
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const appliedDefaultRef = useRef(false);

  const workspaces = useQuery({ queryKey: ['workspaces'], queryFn: api.workspaces });
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  useEffect(() => {
    if (!activeWorkspaceId && workspaces.data && workspaces.data.length > 0) {
      setActiveWorkspaceId(workspaces.data[0].id);
    }
  }, [workspaces.data, activeWorkspaceId]);
  const workspace =
    (workspaces.data ?? []).find((w) => w.id === activeWorkspaceId) ?? workspaces.data?.[0];

  // Reset the active list when switching workspace.
  useEffect(() => {
    setActiveListId(null);
  }, [workspace?.id]);

  const spaces = useQuery({
    queryKey: ['spaces', workspace?.id],
    queryFn: () => api.spaces(workspace!.id),
    enabled: Boolean(workspace?.id),
  });
  const members = useQuery({
    queryKey: ['members', workspace?.id],
    queryFn: () => api.members(workspace!.id),
    enabled: Boolean(workspace?.id),
  });
  const tags = useQuery({
    queryKey: ['tags', workspace?.id],
    queryFn: () => api.tags(workspace!.id),
    enabled: Boolean(workspace?.id),
  });

  const lists = useMemo(() => (spaces.data ?? []).flatMap((s) => s.lists ?? []), [spaces.data]);
  useEffect(() => {
    if (!activeListId && lists.length > 0) setActiveListId(lists[0].id);
  }, [lists, activeListId]);

  const detail = useQuery<ListDetail>({
    queryKey: ['list', activeListId],
    queryFn: () => api.list(activeListId!),
    enabled: Boolean(activeListId),
  });
  const views = useQuery<SavedView[]>({
    queryKey: ['views', activeListId],
    queryFn: () => api.views(activeListId!),
    enabled: Boolean(activeListId),
  });
  const tasks = useQuery({
    queryKey: ['tasks', activeListId, search],
    queryFn: () => api.tasks(activeListId!, search || undefined),
    enabled: Boolean(activeListId),
  });

  // Reset filters when the active list changes.
  useEffect(() => {
    setConfig({});
    setSearch('');
    setActiveViewId(null);
    setSelectedTaskId(null);
    appliedDefaultRef.current = false;
  }, [activeListId]);

  // Apply a saved view marked as default (once per list).
  useEffect(() => {
    if (appliedDefaultRef.current || activeViewId) return;
    const def = (views.data ?? []).find((v) => v.isDefault);
    if (def) {
      appliedDefaultRef.current = true;
      setActiveViewId(def.id);
      setConfig(def.config ?? {});
      setSearch(def.config?.search ?? '');
      if (def.type === 'board' || def.type === 'list') setView(def.type);
    }
  }, [views.data, activeViewId]);

  const setDefault = useMutation({
    mutationFn: (viewId: string) => api.setViewDefault(viewId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['views', activeListId] }),
  });

  const refreshTasks = () => {
    void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    void queryClient.invalidateQueries({ queryKey: ['goals'] });
  };
  const createTask = useMutation({
    mutationFn: (title: string) => api.createTask({ listId: activeListId!, title }),
    onSuccess: refreshTasks,
  });
  const moveTask = useMutation({
    mutationFn: (input: { taskId: string; statusId: string }) =>
      api.updateTask(input.taskId, { statusId: input.statusId }),
    onSuccess: refreshTasks,
  });
  const updateTask = useMutation({
    mutationFn: (input: { taskId: string; patch: Record<string, unknown> }) =>
      api.updateTask(input.taskId, input.patch),
    onSuccess: refreshTasks,
  });
  const saveView = useMutation({
    mutationFn: (name: string) =>
      api.createView(activeListId!, {
        name,
        type: view === 'board' ? 'board' : 'list',
        config: { ...config, search: search || undefined },
      }),
    onSuccess: (created) => {
      setActiveViewId(created.id);
      void queryClient.invalidateQueries({ queryKey: ['views', activeListId] });
    },
  });
  const deleteView = useMutation({
    mutationFn: (viewId: string) => api.deleteView(viewId),
    onSuccess: () => {
      setActiveViewId(null);
      void queryClient.invalidateQueries({ queryKey: ['views', activeListId] });
    },
  });

  const createSpace = useMutation({
    mutationFn: (name: string) => api.createSpace({ workspaceId: workspace!.id, name }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['spaces'] }),
  });
  const createFolder = useMutation({
    mutationFn: (v: { spaceId: string; name: string }) => api.createFolder(v.spaceId, v.name),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['spaces'] }),
  });
  const createList = useMutation({
    mutationFn: (v: { spaceId: string; name: string; folderId?: string }) => api.createList(v),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['spaces'] }),
  });

  // Realtime: subscribe to workspace events (SSE) and refresh affected queries.
  useEffect(() => {
    const token = tokenStore.get();
    if (!workspace?.id || !token) return;
    const source = new EventSource(
      `${apiBase}/events?workspaceId=${workspace.id}&token=${encodeURIComponent(token)}`,
    );
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { type?: string };
        if (data.type === 'task.changed') {
          void queryClient.invalidateQueries({ queryKey: ['tasks'] });
          void queryClient.invalidateQueries({ queryKey: ['goals'] });
          void queryClient.invalidateQueries({ queryKey: ['activity'] });
        } else if (data.type === 'notification') {
          void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      } catch {
        // ignore malformed frames
      }
    };
    return () => source.close();
  }, [workspace?.id, queryClient]);
  const createWorkspace = useMutation({
    mutationFn: (name: string) => api.createWorkspace(name),
    onSuccess: (created) => {
      setActiveWorkspaceId(created.id);
      void queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });

  const filteredTasks = useMemo(() => applyView(tasks.data ?? [], config), [tasks.data, config]);

  const onSaveView = () => {
    const name = window.prompt(t('filter.viewName'));
    if (name) saveView.mutate(name);
  };
  const onSelectView = (viewId: string) => {
    setActiveViewId(viewId || null);
    if (!viewId) return;
    const found = views.data?.find((v) => v.id === viewId);
    if (found) {
      setConfig(found.config ?? {});
      setSearch(found.config?.search ?? '');
    }
  };

  if (workspaces.isLoading) return <Centered text={t('loading')} />;
  if (workspaces.error) return <Centered text={t('error.generic')} />;

  const statuses = detail.data?.statuses ?? [];
  const fields = detail.data?.fields ?? [];
  const activeSpace = (spaces.data ?? []).find((s) =>
    (s.lists ?? []).some((l) => l.id === activeListId),
  );

  return (
    <div className="flex h-full">
      <Sidebar
        workspaces={workspaces.data ?? []}
        activeWorkspaceId={activeWorkspaceId}
        onSelectWorkspace={setActiveWorkspaceId}
        onCreateWorkspace={() => {
          const name = window.prompt(t('manage.newWorkspace'));
          if (name) createWorkspace.mutate(name);
        }}
        spaces={spaces.data ?? []}
        activeListId={activeListId}
        onSelectList={setActiveListId}
        onCreateSpace={() => {
          const name = window.prompt(t('manage.newSpace'));
          if (name) createSpace.mutate(name);
        }}
        onCreateList={(spaceId, folderId) => {
          const name = window.prompt(t('manage.newList'));
          if (name) createList.mutate({ spaceId, name, folderId });
        }}
        onCreateFolder={(spaceId) => {
          const name = window.prompt(t('manage.newFolder'));
          if (name) createFolder.mutate({ spaceId, name });
        }}
        onOpenManage={() => setManageOpen(true)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={detail.data?.name ?? workspace?.name ?? t('app.name')}
          view={view}
          onViewChange={setView}
          onSignOut={onSignOut}
        />

        {view !== 'focus' && view !== 'dashboard' && view !== 'goals' && view !== 'automations' && view !== 'guide' && activeListId && (
          <FilterBar
            config={config}
            onConfigChange={setConfig}
            search={search}
            onSearchChange={setSearch}
            statuses={statuses}
            members={members.data ?? []}
            tags={tags.data ?? []}
            views={views.data ?? []}
            activeViewId={activeViewId}
            onSelectView={onSelectView}
            onSaveView={onSaveView}
            onDeleteActive={() => activeViewId && deleteView.mutate(activeViewId)}
            onSetDefault={() => activeViewId && setDefault.mutate(activeViewId)}
          />
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          {view === 'dashboard' && workspace ? (
            <DashboardView
              workspaceId={workspace.id}
              tasks={tasks.data ?? []}
              statuses={statuses}
              members={members.data ?? []}
            />
          ) : !activeListId ? (
            <Centered text={t('empty.lists')} />
          ) : view === 'list' ? (
            <TaskListView
              statuses={statuses}
              tasks={filteredTasks}
              groupBy={config.groupBy ?? 'none'}
              onAddTask={(title) => createTask.mutate(title)}
              onMoveTask={(taskId, statusId) => moveTask.mutate({ taskId, statusId })}
              onOpenTask={setSelectedTaskId}
            />
          ) : view === 'board' ? (
            <TaskBoardView
              statuses={statuses}
              tasks={filteredTasks}
              onMoveTask={(taskId, statusId) => moveTask.mutate({ taskId, statusId })}
              onOpenTask={setSelectedTaskId}
            />
          ) : view === 'calendar' ? (
            <CalendarView tasks={filteredTasks} locale={i18n.language} onOpenTask={setSelectedTaskId} />
          ) : view === 'gantt' ? (
            <GanttChart
              tasks={filteredTasks}
              statuses={statuses}
              locale={i18n.language}
              showDependencies
              onOpenTask={setSelectedTaskId}
            />
          ) : view === 'timeline' ? (
            <GanttChart
              tasks={filteredTasks}
              statuses={statuses}
              locale={i18n.language}
              groupByStatus
              onOpenTask={setSelectedTaskId}
            />
          ) : view === 'workload' ? (
            <WorkloadView tasks={filteredTasks} members={members.data ?? []} statuses={statuses} />
          ) : view === 'table' ? (
            <TableView
              tasks={filteredTasks}
              statuses={statuses}
              onUpdate={(taskId, patch) => updateTask.mutate({ taskId, patch })}
              onOpenTask={setSelectedTaskId}
            />
          ) : view === 'activity' && workspace ? (
            <ActivityView workspaceId={workspace.id} />
          ) : view === 'time' && workspace ? (
            <TimeView workspace={workspace} listId={activeListId} tasks={tasks.data ?? []} />
          ) : view === 'goals' && workspace ? (
            <GoalsView workspaceId={workspace.id} tasks={tasks.data ?? []} />
          ) : view === 'automations' && workspace ? (
            <AutomationsView
              workspaceId={workspace.id}
              statuses={statuses}
              members={members.data ?? []}
              tasks={tasks.data ?? []}
            />
          ) : view === 'guide' ? (
            <GuideView onOpenView={setView} />
          ) : (
            <FocusView tasks={tasks.data ?? []} />
          )}
        </div>
      </div>

      {selectedTaskId && (
        <TaskDetail
          taskId={selectedTaskId}
          statuses={statuses}
          fields={fields}
          members={members.data ?? []}
          tags={tags.data ?? []}
          tasks={tasks.data ?? []}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {manageOpen && workspace && (
        <ManagePanel
          workspaceId={workspace.id}
          listId={activeListId}
          members={members.data ?? []}
          tags={tags.data ?? []}
          fields={fields}
          statuses={statuses}
          lists={activeSpace?.lists ?? []}
          folders={activeSpace?.folders ?? []}
          onClose={() => setManageOpen(false)}
        />
      )}
    </div>
  );
}

function Centered({ text }: { text: string }) {
  return <div className="flex h-full items-center justify-center text-slate-500">{text}</div>;
}
