import { describe, expect, it } from 'vitest';
import { notificationAudienceCreateSchema } from './audience.schemas';
import {
  notificationCampaignCreateSchema,
  notificationCampaignScheduleSchema,
} from './campaign.schemas';
import { NotificationChannel, TERMINAL_MESSAGE_STATUSES } from './enums';
import { notificationTemplateCreateSchema } from './template.schemas';

describe('notification template contract', () => {
  it('requires a subject on email templates', () => {
    expect(
      notificationTemplateCreateSchema.safeParse({
        name: 'Welcome',
        channel: NotificationChannel.EMAIL,
        body: 'Hello {{firstName}}',
      }).success,
    ).toBe(false);
  });

  it('accepts an email template with a subject', () => {
    const parsed = notificationTemplateCreateSchema.parse({
      name: 'Welcome',
      channel: NotificationChannel.EMAIL,
      subject: 'Welcome to Zion8',
      body: 'Hello {{firstName}}',
    });
    expect(parsed.channel).toBe(NotificationChannel.EMAIL);
  });

  it('rejects HTML on SMS templates', () => {
    expect(
      notificationTemplateCreateSchema.safeParse({
        name: 'Alert',
        channel: NotificationChannel.SMS,
        body: 'Hello',
        html: '<p>Hello</p>',
      }).success,
    ).toBe(false);
  });
});

describe('notification campaign contract', () => {
  it('requires a template or an inline body', () => {
    expect(
      notificationCampaignCreateSchema.safeParse({
        name: 'Sunday',
        channel: NotificationChannel.IN_APP,
      }).success,
    ).toBe(false);
  });

  it('accepts an in-app campaign with inline copy', () => {
    const parsed = notificationCampaignCreateSchema.parse({
      name: 'Sunday reminder',
      channel: NotificationChannel.IN_APP,
      body: 'See you at 10.',
    });
    expect(parsed.body).toBe('See you at 10.');
  });

  it('requires a datetime to schedule', () => {
    expect(notificationCampaignScheduleSchema.safeParse({}).success).toBe(false);
    const parsed = notificationCampaignScheduleSchema.parse({
      scheduledAt: '2026-09-20T09:00:00.000Z',
    });
    expect(parsed.scheduledAt).toBe('2026-09-20T09:00:00.000Z');
  });
});

describe('notification audience contract', () => {
  it('defaults an empty filter', () => {
    const parsed = notificationAudienceCreateSchema.parse({ name: 'Active members' });
    expect(parsed.filter).toEqual({});
  });
});

describe('terminal message statuses', () => {
  it('does not include pending or sending', () => {
    expect(TERMINAL_MESSAGE_STATUSES).not.toContain('PENDING');
    expect(TERMINAL_MESSAGE_STATUSES).not.toContain('SENDING');
  });
});
