import type { MemberImportJob, MemberImportRow } from '@zion8/contracts';

export interface OnboardingFormState {
  status: 'idle' | 'error' | 'success';
  message?: string;
  issues?: Array<{ path: string; message: string }>;
  job?: MemberImportJob;
  preview?: Array<Partial<MemberImportRow>>;
}

export const initialOnboardingState: OnboardingFormState = { status: 'idle' };
