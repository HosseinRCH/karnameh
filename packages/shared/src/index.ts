/**
 * Shared domain types for Karnameh.
 *
 * This package is intentionally TYPE-ONLY (no runtime values, no `enum`).
 * Consumers must import with `import type { ... } from '@karnameh/shared'`
 * so the module is erased at build time.
 */

export type Role = 'owner' | 'admin' | 'member' | 'guest';

export type StatusType = 'open' | 'custom' | 'done' | 'closed';

export type Priority = 'none' | 'low' | 'normal' | 'high' | 'urgent';

export type CustomFieldType =
  | 'text'
  | 'long_text'
  | 'number'
  | 'currency'
  | 'dropdown'
  | 'labels'
  | 'checkbox'
  | 'date'
  | 'email'
  | 'phone'
  | 'url'
  | 'rating';

export interface User {
  id: string;
  email: string;
  name: string;
  locale: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  defaultLocale: string;
  hourlyRate?: number | null;
  currency?: string;
}

export interface Space {
  id: string;
  workspaceId: string;
  name: string;
  color: string | null;
  position: number;
}

export interface Folder {
  id: string;
  spaceId: string;
  name: string;
  position: number;
}

export interface TaskList {
  id: string;
  spaceId: string;
  folderId: string | null;
  name: string;
  position: number;
}

export interface Status {
  id: string;
  listId: string;
  name: string;
  type: StatusType;
  color: string;
  position: number;
}

export interface Task {
  id: string;
  listId: string;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  statusId: string;
  priority: Priority;
  position: number;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
}

export interface CustomField {
  id: string;
  listId: string;
  name: string;
  type: CustomFieldType;
  config: unknown | null;
  required: boolean;
  position: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  locale: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface ApiError {
  error: string;
  details?: unknown;
}

export * from './jalaali';
