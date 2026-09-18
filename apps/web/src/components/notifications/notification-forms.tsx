'use client';

import { useActionState } from 'react';
import {
  MemberGender,
  MemberStatus,
  NotificationChannel,
  NotificationTemplateStatus,
  type NotificationAudience,
  type NotificationCampaign,
  type NotificationTemplate,
} from '@zion8/contracts';
import {
  cancelNotificationCampaignAction,
  createNotificationAudienceAction,
  createNotificationCampaignAction,
  createNotificationTemplateAction,
  markNotificationReadAction,
  scheduleNotificationCampaignAction,
  sendNotificationCampaignAction,
  updateNotificationAudienceAction,
  updateNotificationCampaignAction,
  updateNotificationTemplateAction,
} from '@/app/(dashboard)/notifications/actions';
import { initialFormState } from '@/lib/form-state';
import { humanize } from '@/lib/format';
import { Field, FormFeedback, inputClass } from '@/components/membership/ui';
import { SubmitButton } from '@/components/membership/submit-button';

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function ChannelSelect({
  id,
  name,
  defaultValue,
}: {
  id: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <select id={id} name={name} defaultValue={defaultValue ?? NotificationChannel.EMAIL} className={inputClass}>
      {Object.values(NotificationChannel).map((value) => (
        <option key={value} value={value}>
          {humanize(value)}
        </option>
      ))}
    </select>
  );
}

function AudienceFilterFields({ audience }: { audience?: NotificationAudience }) {
  const filter = audience?.filter ?? {};
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Member search" htmlFor="filter-search">
        <input
          id="filter-search"
          name="filterSearch"
          defaultValue={filter.search ?? ''}
          className={inputClass}
        />
      </Field>
      <Field label="Member status" htmlFor="filter-status">
        <select
          id="filter-status"
          name="filterStatus"
          defaultValue={filter.status ?? ''}
          className={inputClass}
        >
          <option value="">Any status</option>
          {Object.values(MemberStatus).map((value) => (
            <option key={value} value={value}>
              {humanize(value)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Gender" htmlFor="filter-gender">
        <select
          id="filter-gender"
          name="filterGender"
          defaultValue={filter.gender ?? ''}
          className={inputClass}
        >
          <option value="">Any gender</option>
          {Object.values(MemberGender).map((value) => (
            <option key={value} value={value}>
              {humanize(value)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tag" htmlFor="filter-tag">
        <input id="filter-tag" name="filterTag" defaultValue={filter.tag ?? ''} className={inputClass} />
      </Field>
      <Field label="Department id" htmlFor="filter-department">
        <input
          id="filter-department"
          name="filterDepartmentId"
          defaultValue={filter.departmentId ?? ''}
          className={inputClass}
        />
      </Field>
      <Field label="Family id" htmlFor="filter-family">
        <input
          id="filter-family"
          name="filterFamilyId"
          defaultValue={filter.familyId ?? ''}
          className={inputClass}
        />
      </Field>
      <Field label="Volunteer role id" htmlFor="filter-volunteer">
        <input
          id="filter-volunteer"
          name="filterVolunteerRoleId"
          defaultValue={filter.volunteerRoleId ?? ''}
          className={inputClass}
        />
      </Field>
    </div>
  );
}

export function NotificationTemplateForm({ template }: { template?: NotificationTemplate }) {
  const action = template ? updateNotificationTemplateAction : createNotificationTemplateAction;
  const [state, formAction] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      {template ? <input type="hidden" name="templateId" value={template.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="template-name">
          <input
            id="template-name"
            name="name"
            required
            defaultValue={template?.name ?? ''}
            className={inputClass}
          />
        </Field>
        {template ? (
          <Field label="Status" htmlFor="template-status">
            <select
              id="template-status"
              name="status"
              defaultValue={template.status}
              className={inputClass}
            >
              {Object.values(NotificationTemplateStatus).map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Channel" htmlFor="template-channel">
            <ChannelSelect id="template-channel" name="channel" />
          </Field>
        )}
      </div>
      <Field label="Subject" htmlFor="template-subject" hint="Required for email.">
        <input
          id="template-subject"
          name="subject"
          defaultValue={template?.subject ?? ''}
          className={inputClass}
        />
      </Field>
      <Field
        label="Body"
        htmlFor="template-body"
        hint="Placeholders: {{firstName}} {{lastName}} {{fullName}} {{preferredName}} {{email}} {{phone}} {{churchName}}"
      >
        <textarea
          id="template-body"
          name="body"
          required
          rows={8}
          defaultValue={template?.body ?? ''}
          className={inputClass}
        />
      </Field>
      <Field label="HTML" htmlFor="template-html" hint="Email only.">
        <textarea
          id="template-html"
          name="html"
          rows={6}
          defaultValue={template?.html ?? ''}
          className={inputClass}
        />
      </Field>
      <SubmitButton pendingLabel={template ? 'Saving...' : 'Creating...'}>
        {template ? 'Save template' : 'Create template'}
      </SubmitButton>
    </form>
  );
}

export function NotificationAudienceForm({ audience }: { audience?: NotificationAudience }) {
  const action = audience ? updateNotificationAudienceAction : createNotificationAudienceAction;
  const [state, formAction] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      {audience ? <input type="hidden" name="audienceId" value={audience.id} /> : null}
      <Field label="Name" htmlFor="audience-name">
        <input
          id="audience-name"
          name="name"
          required
          defaultValue={audience?.name ?? ''}
          className={inputClass}
        />
      </Field>
      <Field label="Description" htmlFor="audience-description">
        <textarea
          id="audience-description"
          name="description"
          rows={3}
          defaultValue={audience?.description ?? ''}
          className={inputClass}
        />
      </Field>
      <AudienceFilterFields audience={audience} />
      <SubmitButton pendingLabel={audience ? 'Saving...' : 'Creating...'}>
        {audience ? 'Save audience' : 'Create audience'}
      </SubmitButton>
    </form>
  );
}

export function NotificationCampaignForm({
  campaign,
  templates,
  audiences,
}: {
  campaign?: NotificationCampaign;
  templates: NotificationTemplate[];
  audiences: NotificationAudience[];
}) {
  const action = campaign ? updateNotificationCampaignAction : createNotificationCampaignAction;
  const [state, formAction] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      {campaign ? <input type="hidden" name="campaignId" value={campaign.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="campaign-name">
          <input
            id="campaign-name"
            name="name"
            required
            defaultValue={campaign?.name ?? ''}
            className={inputClass}
          />
        </Field>
        {campaign ? null : (
          <Field label="Channel" htmlFor="campaign-channel">
            <ChannelSelect id="campaign-channel" name="channel" />
          </Field>
        )}
        <Field label="Template" htmlFor="campaign-template">
          <select
            id="campaign-template"
            name="templateId"
            defaultValue={campaign?.templateId ?? ''}
            className={inputClass}
            disabled={Boolean(campaign)}
          >
            <option value="">Inline body</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({humanize(template.channel)})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Audience" htmlFor="campaign-audience">
          <select
            id="campaign-audience"
            name="audienceId"
            defaultValue={campaign?.audienceId ?? ''}
            className={inputClass}
          >
            <option value="">Filter below</option>
            {audiences.map((audience) => (
              <option key={audience.id} value={audience.id}>
                {audience.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Subject" htmlFor="campaign-subject" hint="Required for email without a template.">
        <input
          id="campaign-subject"
          name="subject"
          defaultValue={campaign?.subject ?? ''}
          className={inputClass}
        />
      </Field>
      <Field label="Body" htmlFor="campaign-body" hint="Leave blank to use the template body.">
        <textarea
          id="campaign-body"
          name="body"
          rows={8}
          defaultValue={campaign?.body ?? ''}
          className={inputClass}
        />
      </Field>
      <Field label="HTML" htmlFor="campaign-html" hint="Email only.">
        <textarea
          id="campaign-html"
          name="html"
          rows={5}
          defaultValue={campaign?.html ?? ''}
          className={inputClass}
        />
      </Field>
      {campaign ? null : <AudienceFilterFields />}
      <Field label="Schedule" htmlFor="campaign-scheduled" hint="Optional. Leave empty to keep as a draft.">
        <input
          id="campaign-scheduled"
          name="scheduledAt"
          type="datetime-local"
          defaultValue={toLocalInput(campaign?.scheduledAt)}
          className={inputClass}
        />
      </Field>
      <SubmitButton pendingLabel={campaign ? 'Saving...' : 'Creating...'}>
        {campaign ? 'Save campaign' : 'Create campaign'}
      </SubmitButton>
    </form>
  );
}

export function SendCampaignForm({ campaignId }: { campaignId: string }) {
  const [state, formAction] = useActionState(sendNotificationCampaignAction, initialFormState);
  return (
    <form action={formAction} className="space-y-3">
      <FormFeedback state={state} />
      <input type="hidden" name="campaignId" value={campaignId} />
      <SubmitButton pendingLabel="Queuing...">Send now</SubmitButton>
    </form>
  );
}

export function ScheduleCampaignForm({
  campaignId,
  scheduledAt,
}: {
  campaignId: string;
  scheduledAt: string | null;
}) {
  const [state, formAction] = useActionState(scheduleNotificationCampaignAction, initialFormState);
  return (
    <form action={formAction} className="space-y-3">
      <FormFeedback state={state} />
      <input type="hidden" name="campaignId" value={campaignId} />
      <Field label="Send at" htmlFor="schedule-at">
        <input
          id="schedule-at"
          name="scheduledAt"
          type="datetime-local"
          required
          defaultValue={toLocalInput(scheduledAt)}
          className={inputClass}
        />
      </Field>
      <SubmitButton pendingLabel="Scheduling...">Schedule</SubmitButton>
    </form>
  );
}

export function CancelCampaignForm({ campaignId }: { campaignId: string }) {
  const [state, formAction] = useActionState(cancelNotificationCampaignAction, initialFormState);
  return (
    <form action={formAction} className="space-y-3">
      <FormFeedback state={state} />
      <input type="hidden" name="campaignId" value={campaignId} />
      <SubmitButton pendingLabel="Cancelling..." variant="danger">
        Cancel pending
      </SubmitButton>
    </form>
  );
}

export function MarkReadForm({ messageId }: { messageId: string }) {
  const [state, formAction] = useActionState(markNotificationReadAction, initialFormState);
  return (
    <form action={formAction}>
      <input type="hidden" name="messageId" value={messageId} />
      <SubmitButton pendingLabel="Saving..." variant="secondary">
        Mark read
      </SubmitButton>
      {state.status === 'error' ? <p className="mt-2 text-xs text-red-300">{state.message}</p> : null}
    </form>
  );
}
