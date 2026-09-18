import { describe, expect, it } from 'vitest';
import {
  backoffMs,
  blockedReasonFor,
  campaignStatusFromCounts,
  renderTemplate,
  varsFromMember,
} from './notification.utils';

describe('renderTemplate', () => {
  it('substitutes known placeholders and blanks unknown ones', () => {
    const vars = varsFromMember(
      { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '+15551212' },
      'Zion Chapel',
    );
    expect(renderTemplate('Hello {{firstName}} of {{churchName}}', vars)).toBe(
      'Hello Ada of Zion Chapel',
    );
    expect(renderTemplate('{{unknown}}', vars)).toBe('');
  });
});

describe('blockedReasonFor', () => {
  it('blocks missing contact and production providers', () => {
    expect(
      blockedReasonFor('EMAIL', null, {
        email: true,
        sms: true,
        whatsapp: true,
        push: true,
        production: true,
      }),
    ).toBe('MISSING_CONTACT');
    expect(
      blockedReasonFor('SMS', '+15551212', {
        email: true,
        sms: false,
        whatsapp: true,
        push: true,
        production: true,
      }),
    ).toBe('SMS_NOT_CONFIGURED');
    expect(
      blockedReasonFor('SMS', '+15551212', {
        email: false,
        sms: false,
        whatsapp: false,
        push: false,
        production: false,
      }),
    ).toBeNull();
    expect(
      blockedReasonFor('IN_APP', null, {
        email: false,
        sms: false,
        whatsapp: false,
        push: false,
        production: true,
      }),
    ).toBeNull();
  });
});

describe('campaignStatusFromCounts', () => {
  it('stays sending while work remains and fails only when every row is failed or blocked', () => {
    expect(
      campaignStatusFromCounts({ total: 3, pending: 1, failed: 1, blocked: 0, cancelled: 0 }),
    ).toBe('SENDING');
    expect(
      campaignStatusFromCounts({ total: 2, pending: 0, failed: 1, blocked: 1, cancelled: 0 }),
    ).toBe('FAILED');
    expect(
      campaignStatusFromCounts({ total: 2, pending: 0, failed: 0, blocked: 0, cancelled: 0 }),
    ).toBe('SENT');
  });
});

describe('backoffMs', () => {
  it('grows then caps', () => {
    expect(backoffMs(1)).toBe(5_000);
    expect(backoffMs(2)).toBe(10_000);
    expect(backoffMs(20)).toBe(300_000);
  });
});
