import { addDays, type IsoDate } from '../../../shared/time/fleet-time.ts'

// A driver can be sent on a trip only with a valid driving licence and medical certificate.
// Both carry an expiry date, and the earlier of the two decides the state of the documents.
// A document stays valid through its expiry day, by the fleet's (Kyiv) calendar.

/** Documents that run out within this many days are flagged, so there is time to renew them */
export const EXPIRY_WARNING_DAYS = 30

export const DOCUMENT_STATES = ['valid', 'expiring', 'expired'] as const
export type DocumentState = (typeof DOCUMENT_STATES)[number]

/** Expiry dates between `from` and `to` (both inclusive); a missing end is open */
export type ExpiryRange = { from?: IsoDate; to?: IsoDate }

/** The day the first of the driver's documents expires. */
export function documentsExpireOn(driver: {
  licenseExpiresOn: IsoDate
  medicalExpiresOn: IsoDate
}): IsoDate {
  return driver.licenseExpiresOn < driver.medicalExpiresOn
    ? driver.licenseExpiresOn
    : driver.medicalExpiresOn
}

/** Documents are valid through their expiry day, and flagged in the warning period before it. */
export function documentState(expiresOn: IsoDate, today: IsoDate): DocumentState {
  if (expiresOn < today) return 'expired'
  if (expiresOn <= addDays(today, EXPIRY_WARNING_DAYS)) return 'expiring'
  return 'valid'
}

/** The expiry dates that put documents in `state`, so the database can filter by the same rule. */
export function expiryRange(state: DocumentState, today: IsoDate): ExpiryRange {
  switch (state) {
    case 'expired':
      return { to: addDays(today, -1) }
    case 'expiring':
      return { from: today, to: addDays(today, EXPIRY_WARNING_DAYS) }
    case 'valid':
      return { from: addDays(today, EXPIRY_WARNING_DAYS + 1) }
  }
}
