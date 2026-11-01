import type { TimerState } from './types';

/**
 * Isolated state machine for a focus session (React-free, pure).
 *
 *   Idle -> Running -> (Paused <-> Running) -> Completed
 *                   \-> Failed        (interruption / give up)
 *
 * The container performs API calls; the machine only models UI state.
 */
export interface FocusMachineState {
  status: TimerState;
  durationMinutes: number;
  remainingSeconds: number;
  sessionId: string | null;
  interruptionReason: string | null;
  pointsEarned: number;
}

export type FocusEvent =
  | { type: 'START'; durationMinutes: number; sessionId: string }
  | { type: 'RESUME_FROM'; sessionId: string; durationMinutes: number; remainingSeconds: number }
  | { type: 'TICK' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'FAIL'; reason: string }
  | { type: 'RESET'; durationMinutes?: number };

export function initialFocusState(durationMinutes = 25): FocusMachineState {
  return {
    status: 'Idle',
    durationMinutes,
    remainingSeconds: durationMinutes * 60,
    sessionId: null,
    interruptionReason: null,
    pointsEarned: 0,
  };
}

export function focusReducer(state: FocusMachineState, event: FocusEvent): FocusMachineState {
  switch (event.type) {
    case 'START':
      return {
        status: 'Running',
        durationMinutes: event.durationMinutes,
        remainingSeconds: event.durationMinutes * 60,
        sessionId: event.sessionId,
        interruptionReason: null,
        pointsEarned: 0,
      };
    case 'RESUME_FROM':
      return {
        status: 'Running',
        durationMinutes: event.durationMinutes,
        remainingSeconds: Math.max(0, event.remainingSeconds),
        sessionId: event.sessionId,
        interruptionReason: null,
        pointsEarned: 0,
      };
    case 'TICK': {
      if (state.status !== 'Running') return state;
      if (state.remainingSeconds <= 1) {
        return { ...state, remainingSeconds: 0, status: 'Completed', pointsEarned: state.durationMinutes };
      }
      return { ...state, remainingSeconds: state.remainingSeconds - 1 };
    }
    case 'PAUSE':
      return state.status === 'Running' ? { ...state, status: 'Paused' } : state;
    case 'RESUME':
      return state.status === 'Paused' ? { ...state, status: 'Running' } : state;
    case 'FAIL':
      return { ...state, status: 'Failed', interruptionReason: event.reason, pointsEarned: 0 };
    case 'RESET':
      return initialFocusState(event.durationMinutes ?? state.durationMinutes);
    default:
      return state;
  }
}

export function isActive(status: TimerState): boolean {
  return status === 'Running' || status === 'Paused';
}

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
