import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { JALAALI_MONTHS_FA, jalaaliToIso, toJalaali } from '@karnameh/shared';
import type { TaskListItem } from '../types';

const DAY_MS = 86_400_000;
const WEEK_FA = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
const WEEK_EN = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function jalaaliDaysInMonth(jy: number, jm: number): number {
  const next = jm === 12 ? { jy: jy + 1, jm: 1 } : { jy, jm: jm + 1 };
  const a = new Date(`${jalaaliToIso(jy, jm, 1)}T00:00:00Z`).getTime();
  const b = new Date(`${jalaaliToIso(next.jy, next.jm, 1)}T00:00:00Z`).getTime();
  return Math.round((b - a) / DAY_MS);
}

const num = (n: number, locale: string) =>
  new Intl.NumberFormat(locale, { useGrouping: false }).format(n);

/**
 * Jalali-first calendar. The primary grid is always the Persian (Shamsi) month;
 * the Gregorian date is shown as a small secondary number in each cell
 * (the inverse of TickTick, which is Gregorian-first).
 */
export default function CalendarView({
  tasks,
  locale,
  onOpenTask,
}: {
  tasks: TaskListItem[];
  locale: string;
  onOpenTask: (id: string) => void;
}) {
  const { t } = useTranslation();
  const now = new Date();
  const j0 = toJalaali(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
  const [view, setView] = useState({ y: j0.jy, m: j0.jm });

  const byDay = new Map<string, TaskListItem[]>();
  for (const task of tasks) {
    if (!task.dueDate) continue;
    const key = new Date(task.dueDate).toISOString().slice(0, 10);
    byDay.set(key, [...(byDay.get(key) ?? []), task]);
  }

  const days = jalaaliDaysInMonth(view.y, view.m);
  const firstIso = jalaaliToIso(view.y, view.m, 1);
  const firstWeekday = (new Date(`${firstIso}T00:00:00Z`).getUTCDay() + 1) % 7; // Sat = 0
  const todayIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);

  const jalaliLabel = `${JALAALI_MONTHS_FA[view.m - 1]} ${num(view.y, locale)}`;
  const gregLabel = new Intl.DateTimeFormat(locale, {
    calendar: 'gregory',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${firstIso}T00:00:00Z`));

  const move = (delta: number) => {
    let m = view.m + delta;
    let y = view.y;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setView({ y, m });
  };

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => move(-1)} className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100">
          ‹
        </button>
        <div className="text-center">
          <div className="text-sm font-semibold text-slate-800">{jalaliLabel}</div>
          <div className="text-[11px] text-slate-400">{gregLabel}</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setView({ y: j0.jy, m: j0.jm })}
            className="rounded px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
          >
            {t('date.today')}
          </button>
          <button type="button" onClick={() => move(1)} className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100">
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-400">
        {(locale === 'fa' ? WEEK_FA : WEEK_EN).map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <div key={`e${i}`} />
        ))}
        {Array.from({ length: days }).map((_, i) => {
          const day = i + 1;
          const gregIso = jalaaliToIso(view.y, view.m, day);
          const gregDay = new Date(`${gregIso}T00:00:00Z`).getUTCDate();
          const items = byDay.get(gregIso) ?? [];
          const isToday = gregIso === todayIso;
          return (
            <div
              key={day}
              className={`min-h-16 rounded-md border p-1 ${
                isToday ? 'border-indigo-400 bg-indigo-50/40' : 'border-slate-100'
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className={`text-xs font-medium ${isToday ? 'text-indigo-700' : 'text-slate-500'}`}>
                  {num(day, locale)}
                </span>
                <span className="text-[9px] text-slate-300">{num(gregDay, locale)}</span>
              </div>
              <div className="mt-0.5 space-y-0.5">
                {items.slice(0, 2).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onOpenTask(task.id)}
                    className="block w-full truncate rounded bg-indigo-50 px-1 py-0.5 text-start text-[10px] text-indigo-700"
                  >
                    {task.title}
                  </button>
                ))}
                {items.length > 2 && <span className="text-[9px] text-slate-400">+{items.length - 2}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
