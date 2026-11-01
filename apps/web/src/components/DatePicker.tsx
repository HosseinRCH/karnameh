import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { JALAALI_MONTHS_FA, isoToJalaali, jalaaliToIso, toJalaali } from '@karnameh/shared';

const WEEKDAYS_FA = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

function isoParts(iso: string): [number, number, number] {
  const d = new Date(iso);
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}

function jalaaliDaysInMonth(jy: number, jm: number): number {
  const next = jm === 12 ? { jy: jy + 1, jm: 1 } : { jy, jm: jm + 1 };
  const a = new Date(`${jalaaliToIso(jy, jm, 1)}T00:00:00Z`).getTime();
  const b = new Date(`${jalaaliToIso(next.jy, next.jm, 1)}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * Locale-aware date input. Persian uses a small Jalali (Shamsi) calendar;
 * other locales fall back to the browser's native date input.
 * Always reads/writes ISO `YYYY-MM-DD` (Gregorian) for the API.
 */
export default function DatePicker({
  value,
  onChange,
  locale,
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
  locale: string;
}) {
  if (locale !== 'fa') {
    return (
      <input
        type="date"
        value={value ? value.slice(0, 10) : ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-md border border-slate-200 px-2 py-1.5"
      />
    );
  }
  return <JalaaliPicker value={value} onChange={onChange} />;
}

function JalaaliPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const today = useMemo(() => {
    const n = new Date();
    return toJalaali(n.getUTCFullYear(), n.getUTCMonth() + 1, n.getUTCDate());
  }, []);
  const initial = value ? toJalaali(...isoParts(value)) : today;
  const [view, setView] = useState({ jy: initial.jy, jm: initial.jm });

  const daysInMonth = jalaaliDaysInMonth(view.jy, view.jm);
  const firstWeekday = (new Date(`${jalaaliToIso(view.jy, view.jm, 1)}T00:00:00Z`).getUTCDay() + 1) % 7;
  const selected = value ? toJalaali(...isoParts(value)) : null;

  const move = (delta: number) => {
    let jm = view.jm + delta;
    let jy = view.jy;
    if (jm < 1) {
      jm = 12;
      jy -= 1;
    }
    if (jm > 12) {
      jm = 1;
      jy += 1;
    }
    setView({ jy, jm });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-start text-sm"
      >
        {value ? isoToJalaali(value) : t('date.pick')}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => move(-1)} className="rounded px-2 text-slate-500 hover:bg-slate-100">
              ‹
            </button>
            <span className="text-sm font-medium">
              {JALAALI_MONTHS_FA[view.jm - 1]} {view.jy}
            </span>
            <button type="button" onClick={() => move(1)} className="rounded px-2 text-slate-500 hover:bg-slate-100">
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-400">
            {WEEKDAYS_FA.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: firstWeekday }).map((_, i) => (
              <span key={`e${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected =
                selected && selected.jy === view.jy && selected.jm === view.jm && selected.jd === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    onChange(jalaaliToIso(view.jy, view.jm, day));
                    setOpen(false);
                  }}
                  className={`rounded py-1 text-xs ${isSelected ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100'}`}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="text-slate-500 hover:underline"
            >
              {t('date.clear')}
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(jalaaliToIso(today.jy, today.jm, today.jd));
                setOpen(false);
              }}
              className="text-indigo-600 hover:underline"
            >
              {t('date.today')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
