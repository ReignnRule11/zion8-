import { Global, Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module';
import { SecretBoxService } from './secret-box.service';

@Global()
@Module({
  imports: [AppConfigModule],
  providers: [SecretBoxService],
  exports: [SecretBoxService],
})
export class CryptoModule {}
