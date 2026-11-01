import { useEffect, useReducer, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Task } from '@karnameh/shared';
import { api } from '../api/client';
import { focusReducer, formatClock, initialFocusState, isActive } from '../focus/machine';
import type { TimerState } from '../focus/types';
import FocusGrid from '../focus/FocusGrid';

export default function FocusView({ tasks }: { tasks: Task[] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [duration, setDuration] = useState(25);
  const [taskId, setTaskId] = useState('');
  const [billable, setBillable] = useState(true);
  const [blurGuard, setBlurGuard] = useState(true);
  const [machine, dispatch] = useReducer(focusReducer, duration, initialFocusState);
  const sessionIdRef = useRef<string | null>(null);
  const finalizingRef = useRef(false);
  const resumedRef = useRef(false);

  useEffect(() => {
    sessionIdRef.current = machine.sessionId;
  }, [machine.sessionId]);

  const focusState = useQuery({ queryKey: ['focus'], queryFn: api.focusState });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['focus'] });

  // Resume an in-progress session after a page reload.
  useEffect(() => {
    const running = focusState.data?.running;
    if (running && machine.status === 'Idle' && !resumedRef.current) {
      resumedRef.current = true;
      const elapsed = Math.floor((Date.now() - new Date(running.startedAt).getTime()) / 1000);
      dispatch({
        type: 'RESUME_FROM',
        sessionId: running.id,
        durationMinutes: running.durationMinutes,
        remainingSeconds: running.durationMinutes * 60 - elapsed,
      });
    }
  }, [focusState.data, machine.status]);

  const start = useMutation({
    mutationFn: (input: { durationMinutes: number; taskId?: string; billable?: boolean }) =>
      api.startFocus(input),
    onSuccess: (res) => {
      dispatch({
        type: 'START',
        durationMinutes: res.session.durationMinutes,
        sessionId: res.session.id,
      });
      invalidate();
    },
  });

  const complete = useMutation({
    mutationFn: (id: string) => api.completeFocus(id),
    onSuccess: invalidate,
  });

  const fail = useMutation({
    mutationFn: (input: { id: string; reason: string }) => api.failFocus(input.id, input.reason),
    onSuccess: invalidate,
  });

  const clearRuin = useMutation({
    mutationFn: (nodeId: string) => api.clearRuin(nodeId),
    onSuccess: invalidate,
  });

  // 1 Hz countdown while running.
  useEffect(() => {
    if (machine.status !== 'Running') return;
    const id = window.setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => window.clearInterval(id);
  }, [machine.status]);

  // Persist completion when the clock reaches zero.
  useEffect(() => {
    if (machine.status === 'Completed' && machine.sessionId && !finalizingRef.current) {
      finalizingRef.current = true;
      complete.mutate(machine.sessionId, {
        onSettled: () => {
          finalizingRef.current = false;
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machine.status, machine.sessionId]);

  // Interruption detection: losing window focus fails the session.
  useEffect(() => {
    if (machine.status !== 'Running' || !blurGuard) return;
    const interrupt = () => {
      const id = sessionIdRef.current;
      if (!id) return;
      fail.mutate({ id, reason: 'window_blur' });
      dispatch({ type: 'FAIL', reason: 'window_blur' });
    };
    const onVisibility = () => {
      if (document.hidden) interrupt();
    };
    window.addEventListener('blur', interrupt);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', interrupt);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machine.status, blurGuard]);

  const onStart = () =>
    start.mutate({ durationMinutes: duration, taskId: taskId || undefined, billable });
  const onGiveUp = () => {
    const id = sessionIdRef.current;
    if (id && isActive(machine.status)) fail.mutate({ id, reason: 'manual' });
    dispatch({ type: 'FAIL', reason: 'manual' });
  };
  const onNewSession = () => dispatch({ type: 'RESET', durationMinutes: duration });

  const profile = focusState.data?.profile;
  const nodes = focusState.data?.nodes ?? [];
  const clockSeconds = machine.status === 'Idle' ? duration * 60 : machine.remainingSeconds;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-4xl font-semibold tabular-nums text-slate-800">
            {formatClock(clockSeconds)}
          </span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700">
            🔥 {profile?.streakCount ?? 0} {t('focus.streak')}
          </span>
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs text-indigo-700">
            ◆ {profile?.focusPoints ?? 0} {t('focus.points')}
          </span>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={blurGuard}
            onChange={(e) => setBlurGuard(e.target.checked)}
          />
          {t('focus.blurGuard')}
        </label>
      </div>

      {machine.status === 'Idle' && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">{t('focus.duration')}</span>
            {[25, 50].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDuration(d);
                  dispatch({ type: 'RESET', durationMinutes: d });
                }}
                className={`rounded-md px-3 py-1 text-sm ${
                  duration === d ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {d}m
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-500">
            {t('focus.linkedTask')}
            <select
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              className="rounded-md border border-slate-200 px-2 py-1 text-sm"
            >
              <option value="">{t('focus.noTask')}</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-500">
            <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} />
            {t('focus.billable')}
          </label>
        </div>
      )}

      <FocusGrid
        width={profile?.gridWidth ?? 5}
        height={profile?.gridHeight ?? 5}
        nodes={nodes}
        onClearRuin={(id) => clearRuin.mutate(id)}
      />

      <div className="flex items-center justify-between">
        <StatusLabel status={machine.status} label={t(`focus.state.${machine.status}`)} />
        <div className="flex gap-2">
          {machine.status === 'Idle' && (
            <button
              type="button"
              onClick={onStart}
              disabled={start.isPending}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {t('focus.start')}
            </button>
          )}
          {machine.status === 'Running' && (
            <>
              <button
                type="button"
                onClick={() => dispatch({ type: 'PAUSE' })}
                className="rounded-lg bg-slate-200 px-4 py-2 text-sm text-slate-700"
              >
                {t('focus.pause')}
              </button>
              <button
                type="button"
                onClick={onGiveUp}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white"
              >
                {t('focus.giveUp')}
              </button>
            </>
          )}
          {machine.status === 'Paused' && (
            <>
              <button
                type="button"
                onClick={() => dispatch({ type: 'RESUME' })}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white"
              >
                {t('focus.resume')}
              </button>
              <button
                type="button"
                onClick={onGiveUp}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white"
              >
                {t('focus.giveUp')}
              </button>
            </>
          )}
          {(machine.status === 'Completed' || machine.status === 'Failed') && (
            <button
              type="button"
              onClick={onNewSession}
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm text-white"
            >
              {t('focus.newSession')}
            </button>
          )}
        </div>
      </div>

      {machine.status === 'Completed' && (
        <p className="text-sm text-emerald-600">
          {t('focus.completed')} +{machine.pointsEarned}
        </p>
      )}
      {machine.status === 'Failed' && <p className="text-sm text-rose-600">{t('focus.failed')}</p>}
      <p className="text-xs text-slate-400">{t('focus.tip')}</p>
    </div>
  );
}

function StatusLabel({ status, label }: { status: TimerState; label: string }) {
  const color: Record<TimerState, string> = {
    Idle: 'bg-slate-100 text-slate-600',
    Running: 'bg-emerald-100 text-emerald-700',
    Paused: 'bg-amber-100 text-amber-700',
    Failed: 'bg-rose-100 text-rose-700',
    Completed: 'bg-indigo-100 text-indigo-700',
  };
  return <span className={`rounded-full px-3 py-1 text-xs ${color[status]}`}>{label}</span>;
}
