import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PlatformSettings {
  platformName: string;
  platformLogo: string; // image URL, or a short letter/emoji used as the mark
  platformBrandColor: string; // hex; tints the logo mark when no image is set
  defaultAiProvider: string; // anthropic | openai | azure-openai | auto
  defaultAiModel: string;
  defaultVisibility: 'private' | 'org' | 'public';
}

const DEFAULTS: PlatformSettings = {
  platformName: process.env.PLATFORM_NAME || 'UIFactory',
  platformLogo: '',
  platformBrandColor: '',
  defaultAiProvider: 'auto',
  defaultAiModel: '',
  defaultVisibility: 'private',
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<PlatformSettings> {
    const rows = await this.prisma.setting.findMany();
    const map = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]));
    return { ...DEFAULTS, ...map };
  }

  async update(patch: Partial<PlatformSettings>): Promise<PlatformSettings> {
    const allowed: (keyof PlatformSettings)[] = ['platformName', 'platformLogo', 'platformBrandColor', 'defaultAiProvider', 'defaultAiModel', 'defaultVisibility'];
    for (const key of allowed) {
      if (patch[key] !== undefined) {
        await this.prisma.setting.upsert({
          where: { key },
          create: { key, value: JSON.stringify(patch[key]) },
          update: { value: JSON.stringify(patch[key]) },
        });
      }
    }
    return this.get();
  }
}
