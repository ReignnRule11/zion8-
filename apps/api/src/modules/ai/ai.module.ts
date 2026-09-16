import { Module } from '@nestjs/common';
import { AppConfigService } from '../../common/config/app-config.service';
import { CHAT_PROVIDER, type ChatProvider } from './ports/chat.provider';
import { EMBEDDING_PROVIDER, type EmbeddingProvider } from './ports/embedding.provider';
import { DeterministicEmbeddingProvider } from './providers/deterministic-embedding.provider';
import { ExtractiveChatProvider } from './providers/extractive-chat.provider';
import { HttpChatProvider } from './providers/http-chat.provider';
import { HttpEmbeddingProvider } from './providers/http-embedding.provider';

/**
 * The Zion AI bounded context.
 *
 * The two ports below are the seam between the domain and whatever runtime a
 * workspace chooses. Both default to a local, deterministic implementation, so
 * indexing, retrieval and grounded answers are fully functional with no external
 * service; an HTTP provider is only selected when the workspace configures one.
 * The selection happens here and nowhere else, which keeps every service that
 * depends on the ports free of provider branching.
 */
@Module({
  providers: [
    DeterministicEmbeddingProvider,
    HttpEmbeddingProvider,
    ExtractiveChatProvider,
    HttpChatProvider,
    {
      provide: EMBEDDING_PROVIDER,
      useFactory: (
        config: AppConfigService,
        deterministic: DeterministicEmbeddingProvider,
        http: HttpEmbeddingProvider,
      ): EmbeddingProvider => (config.aiCapabilities.embeddingHttp ? http : deterministic),
      inject: [AppConfigService, DeterministicEmbeddingProvider, HttpEmbeddingProvider],
    },
    {
      provide: CHAT_PROVIDER,
      useFactory: (
        config: AppConfigService,
        extractive: ExtractiveChatProvider,
        http: HttpChatProvider,
      ): ChatProvider => (config.aiCapabilities.chat ? http : extractive),
      inject: [AppConfigService, ExtractiveChatProvider, HttpChatProvider],
    },
  ],
  exports: [EMBEDDING_PROVIDER, CHAT_PROVIDER],
})
export class AiModule {}
