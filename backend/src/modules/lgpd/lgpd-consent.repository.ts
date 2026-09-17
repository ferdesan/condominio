import { BaseRepository } from '@/shared/repositories/base.repository';
import { LgpdConsent } from './lgpd-consent.entity';

export class LgpdConsentRepository extends BaseRepository<LgpdConsent> {
  constructor() {
    super(LgpdConsent, {
      alias: 'lgpd_consent',
      searchableFields: ['consentType', 'description'],
      filterableFields: ['residentId', 'consentType', 'granted'],
      relations: ['resident'],
      defaultSort: { field: 'createdAt', order: 'DESC' },
    });
  }
}

export const lgpdConsentRepository = new LgpdConsentRepository();
