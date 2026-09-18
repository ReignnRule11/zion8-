export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SmsMessage {
  to: string;
  body: string;
}

export interface WhatsAppMessage {
  to: string;
  body: string;
}

export interface PushMessage {
  token: string;
  title: string;
  body: string;
  platform?: string;
}

/**
 * Delivery port for out-of-band messages. Auth flows depend on this
 * abstraction rather than a concrete provider so that tests can capture
 * messages and production can swap transports without touching domain logic.
 * Campaigns use the same port; they never call a provider inside a transaction.
 */
export abstract class NotificationService {
  abstract sendEmail(message: EmailMessage): Promise<void>;
  abstract sendSms(message: SmsMessage): Promise<void>;
  abstract sendWhatsApp(message: WhatsAppMessage): Promise<void>;
  abstract sendPush(message: PushMessage): Promise<void>;
}
