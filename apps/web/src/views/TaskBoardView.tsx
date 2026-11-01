import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Status } from '@karnameh/shared';
import type { TaskListItem } from '../types';
import PriorityBadge from '../components/PriorityBadge';

export default function TaskBoardView({
  statuses,
  tasks,
  onMoveTask,
  onOpenTask,
}: {
  statuses: Status[];
  tasks: TaskListItem[];
  onMoveTask: (taskId: string, statusId: string) => void;
  onOpenTask: (taskId: string) => void;
}) {
  const { t } = useTranslation();
  const [dragId, setDragId] = useState<string | null>(null);

  return (
    <div className="flex gap-4 overflow-x-auto p-4">
      {statuses.map((status) => {
        const items = tasks.filter((task) => task.statusId === status.id);
        return (
          <section
            key={status.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragId) onMoveTask(dragId, status.id);
              setDragId(null);
            }}
            className="w-72 shrink-0 rounded-xl bg-slate-100 p-3"
          >
            <header className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: status.color }}>
                {status.name}
              </span>
              <span className="text-xs text-slate-500">{items.length}</span>
            </header>

            <div className="space-y-2">
              {items.map((task) => (
                <article
                  key={task.id}
                  draggable
                  onDragStart={() => setDragId(task.id)}
                  onDragEnd={() => setDragId(null)}
                  className="cursor-grab rounded-lg bg-white p-3 shadow-sm active:cursor-grabbing"
                >
                  <button
                    type="button"
                    onClick={() => onOpenTask(task.id)}
                    className="text-start text-sm text-slate-800 hover:text-indigo-700"
                  >
                    {task.title}
                  </button>
                  <div className="mt-2 flex items-center gap-1.5">
                    <PriorityBadge priority={task.priority} />
                    {task.tags.slice(0, 2).map((tt) => (
                      <span
                        key={tt.tagId}
                        className="rounded-full px-2 py-0.5 text-[10px] text-white"
                        style={{ backgroundColor: tt.tag.color }}
                      >
                        {tt.tag.name}
                      </span>
                    ))}
                  </div>
                </article>
              ))}

              {items.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-300 py-6 text-center text-xs text-slate-400">
                  {t('empty.tasks')}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
