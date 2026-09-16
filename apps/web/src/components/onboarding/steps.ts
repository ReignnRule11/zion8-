import type { OnboardingStep } from '@zion8/contracts';

export const STEP_LABEL: Record<OnboardingStep, string> = {
  REGISTRATION: 'Create the workspace',
  EMAIL_VERIFICATION: 'Verify your email',
  TENANT_PROVISIONING: 'Provision the church',
  WORKSPACE_CREATION: 'Describe your church',
  ADMINISTRATOR_INVITATION: 'Invite administrators',
  SUBSCRIPTION_SELECTION: 'Choose a plan',
  BRAND_CUSTOMIZATION: 'Customize your brand',
  FIRST_MEMBER_IMPORT: 'Import your first members',
  DASHBOARD_READY: 'Open the dashboard',
};

export const STEP_DESCRIPTION: Record<OnboardingStep, string> = {
  REGISTRATION: 'Your Zion8 account and isolated church workspace exist.',
  EMAIL_VERIFICATION: 'We confirm the email address that owns this workspace.',
  TENANT_PROVISIONING: 'Your workspace is prepared with a default plan and settings.',
  WORKSPACE_CREATION: 'Location, contact details, service times, and how you worship.',
  ADMINISTRATOR_INVITATION: 'Bring the people who will help run the workspace.',
  SUBSCRIPTION_SELECTION: 'Pick the plan that matches the size of your congregation.',
  BRAND_CUSTOMIZATION: 'Colours, logo, and the welcome your members will see.',
  FIRST_MEMBER_IMPORT: 'Bring your existing member list across in one step.',
  DASHBOARD_READY: 'Everything is in place. Enter your church operating system.',
};
