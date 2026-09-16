import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Permission,
  documentListQuerySchema,
  documentUpdateSchema,
  type DocumentDownload,
  type DocumentListQuery,
  type DocumentPage,
  type DocumentResponse,
  type DocumentUpdateRequest,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentPrincipal, RequirePermissions } from '../../../common/security/decorators';
import type { AuthenticatedPrincipal } from '../../../common/security/principal';
import { DocumentService } from '../documents/document.service';
import { tenantOf } from '../membership.utils';
import { DocumentListInput, DocumentUpdateInput } from './inputs';
import { DocumentDownloadType, DocumentPageType, DocumentType } from './types';

/**
 * Document metadata over GraphQL. Uploading bytes and streaming a download stay
 * on REST: GraphQL responses are JSON documents, and a church's scanned records
 * are better moved as a stream than as a base64 string.
 */
@Resolver(() => DocumentType)
export class DocumentsResolver {
  constructor(private readonly documents: DocumentService) {}

  @Query(() => DocumentPageType, { name: 'memberDocuments' })
  @RequirePermissions(Permission.DOCUMENT_READ)
  list(
    @Args('memberId', { type: () => ID }) memberId: string,
    @Args('filter', { type: () => DocumentListInput, nullable: true }, new ZodValidationPipe(documentListQuerySchema.default({})))
    filter: DocumentListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<DocumentPage> {
    return this.documents.list(tenantOf(principal), memberId, filter);
  }

  @Query(() => DocumentDownloadType, { name: 'documentDownloadUrl' })
  @RequirePermissions(Permission.DOCUMENT_READ)
  downloadUrl(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<DocumentDownload> {
    return this.documents.download(tenantOf(principal), id);
  }

  @Mutation(() => DocumentType, { name: 'updateDocument' })
  @RequirePermissions(Permission.DOCUMENT_MANAGE)
  update(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => DocumentUpdateInput }, new ZodValidationPipe(documentUpdateSchema))
    input: DocumentUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<DocumentResponse> {
    return this.documents.update(tenantOf(principal), id, input);
  }

  @Mutation(() => DocumentType, { name: 'archiveDocument' })
  @RequirePermissions(Permission.DOCUMENT_MANAGE)
  archive(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<DocumentResponse> {
    return this.documents.archive(tenantOf(principal), id);
  }
}
