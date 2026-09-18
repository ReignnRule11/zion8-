import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  type NotificationDevice,
  type NotificationDeviceRegisterRequest,
  type NotificationInboxListQuery,
  type NotificationMessage,
  type NotificationMessagePage,
} from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { pageArgs, toDevice, toMessage } from './notification.utils';

@Injectable()
export class NotificationInboxService {
  constructor(private readonly prisma: PrismaService) {}

  async listInbox(
    tenantId: string,
    userId: string,
    query: NotificationInboxListQuery,
  ): Promise<NotificationMessagePage> {
    const member = await this.linkedMember(tenantId, userId);
    const where: Prisma.NotificationMessageWhereInput = {
      tenantId,
      channel: 'IN_APP',
      status: { in: ['SENT', 'DELIVERED'] },
      OR: [{ userId }, ...(member ? [{ memberId: member.id }] : [])],
      ...(query.unreadOnly ? { readAt: null } : {}),
    };
    const { skip, take } = pageArgs(query);
    const [rows, total] = await this.prisma.withTenant(tenantId, (tx) =>
      Promise.all([
        tx.notificationMessage.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }],
          skip,
          take,
        }),
        tx.notificationMessage.count({ where }),
      ]),
    );
    return { items: rows.map(toMessage), total, limit: query.limit, offset: query.offset };
  }

  async markRead(tenantId: string, userId: string, messageId: string): Promise<NotificationMessage> {
    const member = await this.linkedMember(tenantId, userId);
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.notificationMessage.findFirst({
        where: {
          id: messageId,
          tenantId,
          channel: 'IN_APP',
          OR: [{ userId }, ...(member ? [{ memberId: member.id }] : [])],
        },
      }),
    );
    if (!row) {
      throw new DomainError('NOTIFICATION_MESSAGE_NOT_FOUND', 'That message could not be found');
    }
    if (row.readAt) return toMessage(row);
    const updated = await this.prisma.withTenant(tenantId, (tx) =>
      tx.notificationMessage.update({
        where: { id: messageId },
        data: { readAt: new Date() },
      }),
    );
    return toMessage(updated);
  }

  async registerDevice(
    tenantId: string,
    userId: string,
    input: NotificationDeviceRegisterRequest,
  ): Promise<NotificationDevice> {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.notificationDevice.upsert({
        where: { tenantId_token: { tenantId, token: input.token } },
        create: {
          tenantId,
          userId,
          platform: input.platform,
          token: input.token,
          lastSeenAt: new Date(),
        },
        update: {
          userId,
          platform: input.platform,
          lastSeenAt: new Date(),
        },
      }),
    );
    return toDevice(row);
  }

  private async linkedMember(tenantId: string, userId: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.member.findFirst({
        where: { tenantId, userId },
        select: { id: true },
      }),
    );
  }
}
