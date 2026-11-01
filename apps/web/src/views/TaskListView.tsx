import { Fragment, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Status } from '@karnameh/shared';
import type { TaskListItem } from '../types';
import PriorityBadge from '../components/PriorityBadge';
import { formatDate } from '../lib/format';

export default function TaskListView({
  statuses,
  tasks,
  groupBy = 'none',
  onAddTask,
  onMoveTask,
  onOpenTask,
}: {
  statuses: Status[];
  tasks: TaskListItem[];
  groupBy?: 'none' | 'status';
  onAddTask: (title: string) => void;
  onMoveTask: (taskId: string, statusId: string) => void;
  onOpenTask: (taskId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [title, setTitle] = useState('');

  const groups =
    groupBy === 'status'
      ? statuses
          .map((s) => ({ key: s.id, label: s.name, items: tasks.filter((x) => x.statusId === s.id) }))
          .filter((g) => g.items.length > 0)
      : [{ key: 'all', label: '', items: tasks }];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = title.trim();
    if (!value) return;
    onAddTask(value);
    setTitle('');
  };

  return (
    <div className="p-4">
      <form onSubmit={submit} className="mb-4 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('task.title')}
          className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
        />
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          {t('task.add')}
        </button>
      </form>

      {tasks.length === 0 ? (
        <div className="py-10 text-center text-slate-400">{t('empty.tasks')}</div>
      ) : (
        <table className="w-full border-separate border-spacing-y-1 text-sm">
          <thead>
            <tr className="text-xs uppercase text-slate-400">
              <th className="px-3 py-2 text-start">{t('field.title')}</th>
              <th className="px-3 py-2 text-start">{t('task.assignees')}</th>
              <th className="px-3 py-2 text-start">{t('field.status')}</th>
              <th className="px-3 py-2 text-start">{t('field.priority')}</th>
              <th className="px-3 py-2 text-start">{t('field.due')}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.key}>
                {groupBy === 'status' && (
                  <tr>
                    <td colSpan={5} className="pt-4 text-xs font-semibold uppercase text-slate-400">
                      {group.label} · {group.items.length}
                    </td>
                  </tr>
                )}
                {group.items.map((task) => (
              <tr key={task.id} className="bg-white shadow-sm">
                <td className="rounded-s-lg px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onOpenTask(task.id)}
                    className="text-start text-slate-800 hover:text-indigo-700"
                  >
                    {task.title}
                  </button>
                  {task.tags.length > 0 && (
                    <span className="ms-2 inline-flex gap-1 align-middle">
                      {task.tags.map((tt) => (
                        <span
                          key={tt.tagId}
                          className="rounded-full px-2 py-0.5 text-[10px] text-white"
                          style={{ backgroundColor: tt.tag.color }}
                        >
                          {tt.tag.name}
                        </span>
                      ))}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {task.assignees.slice(0, 3).map((a) => (
                      <span
                        key={a.userId}
                        title={a.user.name}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-medium text-indigo-700"
                      >
                        {a.user.name.slice(0, 1)}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={task.statusId}
                    onChange={(e) => onMoveTask(task.id, e.target.value)}
                    className="rounded-md border border-slate-200 px-2 py-1 text-sm"
                  >
                    {statuses.map((status) => (
                      <option key={status.id} value={status.id}>
                        {status.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <PriorityBadge priority={task.priority} />
                </td>
                <td className="rounded-e-lg px-3 py-2 text-slate-500">
                  {formatDate(task.dueDate, i18n.language)}
                </td>
              </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
