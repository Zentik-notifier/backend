import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { UserSetting } from '../entities/user-setting.entity';
import { UserSettingType } from '../entities/user-setting.types';

export interface ExternalNotifyCredentialPayload {
  authUser?: string | null;
  authPassword?: string | null;
  authToken?: string | null;
}

type CredentialsMap = Record<string, ExternalNotifyCredentialPayload>;

@Injectable()
export class ExternalNotifyCredentialsStore {
  constructor(
    @InjectRepository(UserSetting)
    private readonly userSettingsRepo: Repository<UserSetting>,
  ) {}

  private key(systemId: string, channel?: string | null): string {
    return channel != null && channel !== '' ? `${systemId}:${channel}` : systemId;
  }

  async get(
    userId: string,
    systemId: string,
    channel?: string | null,
  ): Promise<ExternalNotifyCredentialPayload | null> {
    const row = await this.userSettingsRepo.findOne({
      where: { userId, configType: UserSettingType.ExternalNotifyCredentials, deviceId: IsNull() },
    });
    if (!row?.valueText) return null;
    try {
      const map = JSON.parse(row.valueText) as CredentialsMap;
      return map[this.key(systemId, channel)] ?? null;
    } catch {
      return null;
    }
  }

  async set(
    userId: string,
    systemId: string,
    payload: ExternalNotifyCredentialPayload,
    channel?: string | null,
  ): Promise<void> {
    const row = await this.userSettingsRepo.findOne({
      where: { userId, configType: UserSettingType.ExternalNotifyCredentials, deviceId: IsNull() },
    });
    const map: CredentialsMap = row?.valueText ? (JSON.parse(row.valueText) as CredentialsMap) : {};
    map[this.key(systemId, channel)] = {
      authUser: payload.authUser ?? null,
      authPassword: payload.authPassword ?? null,
      authToken: payload.authToken ?? null,
    };
    const valueText = JSON.stringify(map);
    if (row) {
      row.valueText = valueText;
      await this.userSettingsRepo.save(row);
    } else {
      await this.userSettingsRepo.save(
        this.userSettingsRepo.create({
          userId,
          configType: UserSettingType.ExternalNotifyCredentials,
          deviceId: null,
          valueText,
        }),
      );
    }
  }

  async delete(userId: string, systemId: string, channel?: string | null): Promise<void> {
    const row = await this.userSettingsRepo.findOne({
      where: { userId, configType: UserSettingType.ExternalNotifyCredentials, deviceId: IsNull() },
    });
    if (!row?.valueText) return;
    try {
      const map = JSON.parse(row.valueText) as CredentialsMap;
      delete map[this.key(systemId, channel)];
      row.valueText = JSON.stringify(map);
      await this.userSettingsRepo.save(row);
    } catch {
      // ignore
    }
  }
}
