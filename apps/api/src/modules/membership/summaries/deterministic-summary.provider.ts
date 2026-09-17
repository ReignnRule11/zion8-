import { Injectable } from '@nestjs/common';
import type { SummaryContext, SummaryDraft, SummaryProvider } from './summary.provider';

/**
 * The default provider. It writes the summary from the facts the domain already
 * recorded, with no network call and no model. That makes every workspace
 * functional out of the box, gives deterministic output that can be asserted in
 * tests, and leaves the LLM provider as a pure upgrade.
 */
@Injectable()
export class DeterministicSummaryProvider implements SummaryProvider {
  async generate(context: SummaryContext): Promise<SummaryDraft> {
    const { member, facts } = context;
    const sentences: string[] = [];
    const highlights: string[] = [];

    sentences.push(
      `${member.fullName} has been part of this church for ${describeTenure(facts.tenureDays)}.`,
    );

    if (facts.sessionsRecorded > 0) {
      const rate = Math.round(facts.attendanceRate * 100);
      sentences.push(
        `They have been recorded at ${facts.sessionsAttended} of ${facts.sessionsRecorded} services (${rate}% attendance)${
          facts.currentStreak >= 2 ? `, and are on a ${facts.currentStreak}-session streak` : ''
        }.`,
      );
      if (facts.attendanceRate >= 0.8) {
        highlights.push('Consistently present');
      } else if (facts.attendanceRate < 0.4) {
        highlights.push('Attendance has lapsed recently');
      }
    } else {
      sentences.push('No attendance has been recorded yet.');
    }

    if (facts.familyCount > 0) {
      sentences.push(
        `They belong to ${facts.familyCount} household${facts.familyCount === 1 ? '' : 's'}, with ${facts.relationshipCount} recorded relationship${
          facts.relationshipCount === 1 ? '' : 's'
        }.`,
      );
    } else if (facts.relationshipCount > 0) {
      sentences.push(
        `They have ${facts.relationshipCount} recorded relationship${
          facts.relationshipCount === 1 ? '' : 's'
        } in the congregation.`,
      );
    }

    if (facts.departmentCount > 0 || facts.volunteerRoleCount > 0) {
      const parts: string[] = [];
      if (facts.departmentCount > 0) {
        parts.push(`${facts.departmentCount} department${facts.departmentCount === 1 ? '' : 's'}`);
      }
      if (facts.volunteerRoleCount > 0) {
        parts.push(
          `${facts.volunteerRoleCount} volunteer role${facts.volunteerRoleCount === 1 ? '' : 's'}`,
        );
      }
      sentences.push(`They serve in ${parts.join(' and ')}.`);
      highlights.push('Actively serving');
    }

    if (facts.openFollowUps > 0) {
      sentences.push(
        `${facts.openFollowUps} follow-up${facts.openFollowUps === 1 ? '' : 's'} ${
          facts.openFollowUps === 1 ? 'is' : 'are'
        } still open.`,
      );
      highlights.push('Follow-up needed');
    }

    if (facts.documentCount > 0) {
      sentences.push(
        `${facts.documentCount} document${facts.documentCount === 1 ? '' : 's'} are on file.`,
      );
    }

    if (facts.tags.length > 0) {
      highlights.push(...facts.tags.slice(0, 5));
    }

    const focus = context.focus ? ` Focus requested: ${context.focus}.` : '';

    return {
      content: `${sentences.join(' ')}${focus}`.trim(),
      highlights: dedupe(highlights),
      model: null,
      provider: 'DETERMINISTIC',
    };
  }
}

function describeTenure(days: number): string {
  if (days <= 0) return 'a short time';
  if (days < 45) return `${days} day${days === 1 ? '' : 's'}`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  const years = (days / 365).toFixed(1).replace(/\.0$/, '');
  return `${years} years`;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)].slice(0, 8);
}
