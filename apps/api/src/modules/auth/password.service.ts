import { Injectable, type OnModuleInit } from '@nestjs/common';
import argon2 from 'argon2';
import { AppConfigService } from '../../common/config/app-config.service';

@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash = '';

  constructor(private readonly config: AppConfigService) {}

  private get options(): argon2.Options {
    const { memoryCost, timeCost, parallelism } = this.config.argon2Options;
    return {
      type: argon2.argon2id,
      memoryCost,
      timeCost,
      parallelism,
    };
  }

  async onModuleInit(): Promise<void> {
    this.dummyHash = await argon2.hash(`not-a-real-password-${Date.now()}`, this.options);
  }

  async hash(plainText: string): Promise<string> {
    return argon2.hash(plainText, this.options);
  }

  async verify(hash: string, plainText: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plainText);
    } catch {
      return false;
    }
  }

  async verifyAgainstDummy(plainText: string): Promise<void> {
    await this.verify(this.dummyHash, plainText);
  }
}
