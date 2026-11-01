export type TimerState = 'Idle' | 'Running' | 'Paused' | 'Failed' | 'Completed';

export type NodeType = 'residential' | 'landmark' | 'park';
export type NodeStatus = 'blueprint' | 'constructed' | 'ruin';

export interface FocusNode {
  id: string;
  x: number;
  y: number;
  type: NodeType;
  status: NodeStatus;
  durationMinutes: number;
}

export interface FocusProfile {
  userId: string;
  focusPoints: number;
  streakCount: number;
  lastResult: string | null;
  gridWidth: number;
  gridHeight: number;
}

export interface FocusSession {
  id: string;
  durationMinutes: number;
  status: string;
  startedAt: string;
}

export interface FocusStateResponse {
  profile: FocusProfile;
  nodes: FocusNode[];
  running: FocusSession | null;
}

export interface FocusActionResult {
  session: FocusSession;
  node: FocusNode;
  profile: FocusProfile;
}
