import type { FieldIssue } from '@zion8/contracts';

/**
 * Shared shape for every membership form. A form either succeeded, failed with a
 * message, or failed with per-field issues the API produced from the same zod
 * contract the browser-side form mirrors.
 */
export interface FormState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  issues?: FieldIssue[];
}

export const initialFormState: FormState = { status: 'idle' };
