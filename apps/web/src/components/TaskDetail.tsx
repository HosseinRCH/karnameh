import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { CustomField, Priority, Status } from '@karnameh/shared';
import { api } from '../api/client';
import DatePicker from './DatePicker';
import type { Member, Tag, TaskListItem } from '../types';

const PRIORITIES: Priority[] = ['none', 'low', 'normal', 'high', 'urgent'];

export default function TaskDetail({
  taskId,
  statuses,
  fields,
  members,
  tags,
  tasks,
  onClose,
}: {
  taskId: string;
  statuses: Status[];
  fields: CustomField[];
  members: Member[];
  tags: Tag[];
  tasks: TaskListItem[];
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [subtaskTitle, setSubtaskTitle] = useState('');

  const detail = useQuery({ queryKey: ['task', taskId], queryFn: () => api.taskDetail(taskId) });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    void queryClient.invalidateQueries({ queryKey: ['goals'] });
  };

  const update = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.updateTask(taskId, patch),
    onSuccess: invalidate,
  });
  const assign = useMutation({
    mutationFn: (userId: string) => api.assignTask(taskId, userId),
    onSuccess: invalidate,
  });
  const unassign = useMutation({
    mutationFn: (userId: string) => api.unassignTask(taskId, userId),
    onSuccess: invalidate,
  });
  const tagTask = useMutation({
    mutationFn: (tagId: string) => api.tagTask(taskId, tagId),
    onSuccess: invalidate,
  });
  const untagTask = useMutation({
    mutationFn: (tagId: string) => api.untagTask(taskId, tagId),
    onSuccess: invalidate,
  });
  const setField = useMutation({
    mutationFn: (v: { fieldId: string; value: unknown }) =>
      api.setFieldValue(taskId, v.fieldId, v.value),
    onSuccess: invalidate,
  });
  const addSubtask = useMutation({
    mutationFn: (title: string) =>
      api.createTask({ listId: detail.data!.listId, title, parentTaskId: taskId }),
    onSuccess: () => {
      setSubtaskTitle('');
      invalidate();
    },
  });
  const removeTask = useMutation({
    mutationFn: () => api.deleteTask(taskId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
  });
  const addDep = useMutation({
    mutationFn: (dependsOnTaskId: string) => api.addDependency(taskId, dependsOnTaskId),
    onSuccess: invalidate,
  });
  const removeDep = useMutation({
    mutationFn: (dependsOnTaskId: string) => api.removeDependency(taskId, dependsOnTaskId),
    onSuccess: invalidate,
  });
  const setAssigneeEstimate = useMutation({
    mutationFn: (v: { userId: string; estimateMs: number | null }) =>
      api.setAssigneeEstimate(taskId, v.userId, v.estimateMs),
    onSuccess: invalidate,
  });

  const data = detail.data;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {!data ? (
          <div className="text-slate-500">{t('loading')}</div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <input
                defaultValue={data.title}
                onBlur={(e) => e.target.value.trim() && update.mutate({ title: e.target.value.trim() })}
                className="w-full rounded-lg border border-transparent px-2 py-1 text-lg font-semibold hover:border-slate-200 focus:border-indigo-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-slate-500">{t('field.status')}</span>
                <select
                  value={data.statusId}
                  onChange={(e) => update.mutate({ statusId: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-2 py-1.5"
                >
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-500">{t('field.priority')}</span>
                <select
                  value={data.priority}
                  onChange={(e) => update.mutate({ priority: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-2 py-1.5"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {t(`priority.${p}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-500">{t('field.start')}</span>
                <DatePicker
                  value={data.startDate}
                  onChange={(iso) => update.mutate({ startDate: iso })}
                  locale={i18n.language}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-500">{t('field.due')}</span>
                <DatePicker
                  value={data.dueDate}
                  onChange={(iso) => update.mutate({ dueDate: iso })}
                  locale={i18n.language}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-500">{t('table.estimate')}</span>
                <input
                  type="number"
                  step="0.5"
                  defaultValue={data.estimateMs ? data.estimateMs / 3_600_000 : ''}
                  onBlur={(e) => {
                    const hours = Number(e.target.value);
                    update.mutate({
                      estimateMs:
                        Number.isFinite(hours) && hours > 0 ? Math.round(hours * 3_600_000) : null,
                    });
                  }}
                  className="w-full rounded-md border border-slate-200 px-2 py-1.5"
                />
              </label>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block text-slate-500">{t('task.description')}</span>
              <textarea
                defaultValue={data.description ?? ''}
                onBlur={(e) => update.mutate({ description: e.target.value })}
                rows={3}
                className="w-full rounded-md border border-slate-200 px-2 py-1.5"
              />
            </label>

            {/* Assignees */}
            <section>
              <h3 className="mb-2 text-sm font-medium text-slate-600">{t('task.assignees')}</h3>
              <div className="mb-2 space-y-1">
                {data.assignees.map((a) => (
                  <div
                    key={a.userId}
                    className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1 text-sm"
                  >
                    <span className="min-w-0 truncate text-slate-700">{a.user.name}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      <input
                        type="number"
                        step="0.5"
                        min={0}
                        defaultValue={a.estimateMs ? a.estimateMs / 3_600_000 : ''}
                        onBlur={(e) => {
                          const hours = Number(e.target.value);
                          setAssigneeEstimate.mutate({
                            userId: a.userId,
                            estimateMs: Number.isFinite(hours) && hours > 0 ? Math.round(hours * 3_600_000) : null,
                          });
                        }}
                        title={t('table.estimate')}
                        className="w-16 rounded border border-slate-200 px-1 py-0.5 text-xs"
                      />
                      <span className="text-[10px] text-slate-400">h</span>
                      <button type="button" onClick={() => unassign.mutate(a.userId)} className="text-slate-400">
                        ✕
                      </button>
                    </span>
                  </div>
                ))}
              </div>
              <select
                value=""
                onChange={(e) => e.target.value && assign.mutate(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              >
                <option value="">{t('task.addAssignee')}</option>
                {members
                  .filter((m) => !data.assignees.some((a) => a.userId === m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </section>

            {/* Tags */}
            <section>
              <h3 className="mb-2 text-sm font-medium text-slate-600">{t('task.tags')}</h3>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {data.tags.map((tt) => (
                  <span
                    key={tt.tagId}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-white"
                    style={{ backgroundColor: tt.tag.color }}
                  >
                    {tt.tag.name}
                    <button type="button" onClick={() => untagTask.mutate(tt.tagId)} className="text-white/80">
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              <select
                value=""
                onChange={(e) => e.target.value && tagTask.mutate(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              >
                <option value="">{t('task.addTag')}</option>
                {tags
                  .filter((tg) => !data.tags.some((tt) => tt.tagId === tg.id))
                  .map((tg) => (
                    <option key={tg.id} value={tg.id}>
                      {tg.name}
                    </option>
                  ))}
              </select>
            </section>

            {/* Custom fields */}
            {fields.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-medium text-slate-600">{t('task.customFields')}</h3>
                <div className="space-y-2">
                  {fields.map((field) => (
                    <FieldInput
                      key={field.id}
                      field={field}
                      value={data.fieldValues.find((v) => v.fieldId === field.id)?.value}
                      onCommit={(value) => setField.mutate({ fieldId: field.id, value })}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Dependencies */}
            <section>
              <h3 className="mb-2 text-sm font-medium text-slate-600">{t('task.dependencies')}</h3>
              <ul className="mb-2 space-y-1">
                {data.dependencies.map((dep) => {
                  const on = tasks.find((x) => x.id === dep.dependsOnTaskId);
                  return (
                    <li
                      key={dep.id}
                      className="flex items-center justify-between rounded-md bg-amber-50 px-3 py-1.5 text-sm"
                    >
                      <span className="truncate text-slate-700">
                        {t('task.blockedBy')}: {on?.title ?? dep.dependsOnTaskId.slice(0, 8)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeDep.mutate(dep.dependsOnTaskId)}
                        className="text-slate-400"
                      >
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
              <select
                value=""
                onChange={(e) => e.target.value && addDep.mutate(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              >
                <option value="">{t('task.addDependency')}</option>
                {tasks
                  .filter((x) => x.id !== taskId && !data.dependencies.some((d) => d.dependsOnTaskId === x.id))
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.title}
                    </option>
                  ))}
              </select>
            </section>

            {/* Subtasks */}
            <section>
              <h3 className="mb-2 text-sm font-medium text-slate-600">{t('task.subtasks')}</h3>
              <ul className="mb-2 space-y-1">
                {data.subtasks.map((st) => (
                  <li key={st.id} className="rounded-md bg-slate-50 px-3 py-1.5 text-sm text-slate-700">
                    {st.title}
                  </li>
                ))}
              </ul>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = subtaskTitle.trim();
                  if (v) addSubtask.mutate(v);
                }}
                className="flex gap-2"
              >
                <input
                  value={subtaskTitle}
                  onChange={(e) => setSubtaskTitle(e.target.value)}
                  placeholder={t('task.addSubtask')}
                  className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
                >
                  {t('task.add')}
                </button>
              </form>
            </section>

            <button
              type="button"
              onClick={() => {
                if (window.confirm(t('task.deleteConfirm'))) removeTask.mutate();
              }}
              className="text-sm text-rose-600 hover:underline"
            >
              {t('task.delete')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onCommit,
}: {
  field: CustomField;
  value: unknown;
  onCommit: (value: unknown) => void;
}) {
  const commit = (raw: string | boolean, checked = false) => {
    if (field.type === 'number' || field.type === 'rating') {
      const n = Number(raw);
      onCommit(Number.isFinite(n) ? n : null);
    } else if (field.type === 'checkbox') {
      onCommit(checked);
    } else {
      onCommit(raw === '' ? null : raw);
    }
  };

  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-32 shrink-0 truncate text-slate-500">{field.name}</span>
      {field.type === 'checkbox' ? (
        <input
          type="checkbox"
          defaultChecked={Boolean(value)}
          onChange={(e) => commit('', e.target.checked)}
        />
      ) : (
        <input
          type={field.type === 'date' ? 'date' : field.type === 'number' || field.type === 'rating' ? 'number' : 'text'}
          defaultValue={
            field.type === 'date' && typeof value === 'string' ? value.slice(0, 10) : value == null ? '' : String(value)
          }
          onBlur={(e) => commit(e.target.value)}
          className="w-full rounded-md border border-slate-200 px-2 py-1.5"
        />
      )}
    </label>
  );
}
