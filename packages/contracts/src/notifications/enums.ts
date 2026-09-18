import { z } from 'zod';

export const NotificationChannel = {
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  WHATSAPP: 'WHATSAPP',
  PUSH: 'PUSH',
  IN_APP: 'IN_APP',
} as const;

export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const notificationChannelSchema = z.enum(
  Object.values(NotificationChannel) as [NotificationChannel, ...NotificationChannel[]],
);

export const NotificationTemplateStatus = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;

export type NotificationTemplateStatus =
  (typeof NotificationTemplateStatus)[keyof typeof NotificationTemplateStatus];

export const notificationTemplateStatusSchema = z.enum(
  Object.values(NotificationTemplateStatus) as [
    NotificationTemplateStatus,
    ...NotificationTemplateStatus[],
  ],
);

export const NotificationCampaignStatus = {
  DRAFT: 'DRAFT',
  SCHEDULED: 'SCHEDULED',
  SENDING: 'SENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export type NotificationCampaignStatus =
  (typeof NotificationCampaignStatus)[keyof typeof NotificationCampaignStatus];

export const notificationCampaignStatusSchema = z.enum(
  Object.values(NotificationCampaignStatus) as [
    NotificationCampaignStatus,
    ...NotificationCampaignStatus[],
  ],
);

export const NotificationMessageStatus = {
  PENDING: 'PENDING',
  SENDING: 'SENDING',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  BLOCKED: 'BLOCKED',
  CANCELLED: 'CANCELLED',
} as const;

export type NotificationMessageStatus =
  (typeof NotificationMessageStatus)[keyof typeof NotificationMessageStatus];

export const notificationMessageStatusSchema = z.enum(
  Object.values(NotificationMessageStatus) as [
    NotificationMessageStatus,
    ...NotificationMessageStatus[],
  ],
);

export const NotificationDevicePlatform = {
  WEB: 'WEB',
  IOS: 'IOS',
  ANDROID: 'ANDROID',
} as const;

export type NotificationDevicePlatform =
  (typeof NotificationDevicePlatform)[keyof typeof NotificationDevicePlatform];

export const notificationDevicePlatformSchema = z.enum(
  Object.values(NotificationDevicePlatform) as [
    NotificationDevicePlatform,
    ...NotificationDevicePlatform[],
  ],
);

/** Message statuses that will never be claimed again. */
export const TERMINAL_MESSAGE_STATUSES: readonly NotificationMessageStatus[] = [
  NotificationMessageStatus.SENT,
  NotificationMessageStatus.DELIVERED,
  NotificationMessageStatus.FAILED,
  NotificationMessageStatus.BLOCKED,
  NotificationMessageStatus.CANCELLED,
];
