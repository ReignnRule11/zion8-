import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  type NotificationAudience,
  type NotificationAudienceCreateRequest,
  type NotificationAudienceFilter,
  type NotificationAudienceListQuery,
  type NotificationAudiencePage,
  type NotificationAudiencePreview,
  type NotificationAudienceUpdateRequest,
  type NotificationTemplate,
  type NotificationTemplateCreateRequest,
  type NotificationTemplateListQuery,
  type NotificationTemplatePage,
  type NotificationTemplateUpdateRequest,
} from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  fullName,
  memberWhere,
  pageArgs,
  parseAudienceFilter,
  toAudience,
  toTemplate,
} from './notification.utils';

@Injectable()
export class NotificationTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async createTemplate(
    tenantId: string,
    input: NotificationTemplateCreateRequest,
  ): Promise<NotificationTemplate> {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.notificationTemplate.create({
        data: {
          tenantId,
          name: input.name,
          channel: input.channel,
          subject: input.subject ?? null,
          body: input.body,
          html: input.html ?? null,
        },
      }),
    );
    return toTemplate(row);
  }

  async listTemplates(
    tenantId: string,
    query: NotificationTemplateListQuery,
  ): Promise<NotificationTemplatePage> {
    const where: Prisma.NotificationTemplateWhereInput = {
      tenantId,
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.includeArchived ? {} : { status: 'ACTIVE' }),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
    const { skip, take } = pageArgs(query);
    const [rows, total] = await this.prisma.withTenant(tenantId, (tx) =>
      Promise.all([
        tx.notificationTemplate.findMany({
          where,
          orderBy: [{ name: 'asc' }],
          skip,
          take,
        }),
        tx.notificationTemplate.count({ where }),
      ]),
    );
    return { items: rows.map(toTemplate), total, limit: query.limit, offset: query.offset };
  }

  async getTemplate(tenantId: string, templateId: string): Promise<NotificationTemplate> {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.notificationTemplate.findFirst({ where: { id: templateId, tenantId } }),
    );
    if (!row) {
      throw new DomainError('NOTIFICATION_TEMPLATE_NOT_FOUND', 'That template could not be found');
    }
    return toTemplate(row);
  }

  async updateTemplate(
    tenantId: string,
    templateId: string,
    input: NotificationTemplateUpdateRequest,
  ): Promise<NotificationTemplate> {
    await this.getTemplate(tenantId, templateId);
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.notificationTemplate.update({
        where: { id: templateId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.subject !== undefined ? { subject: input.subject } : {}),
          ...(input.body !== undefined ? { body: input.body } : {}),
          ...(input.html !== undefined ? { html: input.html } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
      }),
    );
    return toTemplate(row);
  }

  async createAudience(
    tenantId: string,
    input: NotificationAudienceCreateRequest,
  ): Promise<NotificationAudience> {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.notificationAudience.create({
        data: {
          tenantId,
          name: input.name,
          description: input.description ?? null,
          filter: input.filter as Prisma.InputJsonValue,
        },
      }),
    );
    return toAudience(row);
  }

  async listAudiences(
    tenantId: string,
    query: NotificationAudienceListQuery,
  ): Promise<NotificationAudiencePage> {
    const where: Prisma.NotificationAudienceWhereInput = {
      tenantId,
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const { skip, take } = pageArgs(query);
    const [rows, total] = await this.prisma.withTenant(tenantId, (tx) =>
      Promise.all([
        tx.notificationAudience.findMany({ where, orderBy: [{ name: 'asc' }], skip, take }),
        tx.notificationAudience.count({ where }),
      ]),
    );
    return { items: rows.map(toAudience), total, limit: query.limit, offset: query.offset };
  }

  async getAudience(tenantId: string, audienceId: string): Promise<NotificationAudience> {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.notificationAudience.findFirst({ where: { id: audienceId, tenantId } }),
    );
    if (!row) {
      throw new DomainError('NOTIFICATION_AUDIENCE_NOT_FOUND', 'That audience could not be found');
    }
    return toAudience(row);
  }

  async updateAudience(
    tenantId: string,
    audienceId: string,
    input: NotificationAudienceUpdateRequest,
  ): Promise<NotificationAudience> {
    await this.getAudience(tenantId, audienceId);
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.notificationAudience.update({
        where: { id: audienceId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.filter !== undefined ? { filter: input.filter as Prisma.InputJsonValue } : {}),
        },
      }),
    );
    return toAudience(row);
  }

  async previewAudience(
    tenantId: string,
    audienceId: string | null,
    filter?: NotificationAudienceFilter,
  ): Promise<NotificationAudiencePreview> {
    const resolved = audienceId
      ? parseAudienceFilter((await this.getAudience(tenantId, audienceId)).filter)
      : (filter ?? {});
    const where = memberWhere(tenantId, resolved);
    const [total, sample] = await this.prisma.withTenant(tenantId, (tx) =>
      Promise.all([
        tx.member.count({ where }),
        tx.member.findMany({
          where,
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          take: 25,
          select: { id: true, firstName: true, lastName: true, preferredName: true, email: true, phone: true },
        }),
      ]),
    );
    return {
      audienceId,
      total,
      sample: sample.map((member) => ({
        id: member.id,
        fullName: fullName(member),
        email: member.email,
        phone: member.phone,
      })),
    };
  }
}
