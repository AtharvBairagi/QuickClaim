export type WarrantyStatus = 'active' | 'expiring' | 'expired';

/**
 * Calculates warranty status based on the current date and warranty expiry date.
 * - expired: warranty expiry is before today
 * - expiring: warranty expires within 180 days (including today)
 * - active: warranty expires more than 180 days away
 *
 * @param warrantyExpiry Date or date string representing warranty expiration
 * @param referenceDate Optional reference date for testing (defaults to actual current date)
 */
export const calculateWarrantyStatus = (
  warrantyExpiry: Date | string,
  referenceDate: Date = new Date()
): WarrantyStatus => {
  const expiryDate = new Date(warrantyExpiry);
  
  // Normalize both dates to midnight start of day for exact day comparison
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);

  const timeDiff = expiry.getTime() - today.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  if (daysDiff < 0) {
    return 'expired';
  }

  if (daysDiff <= 180) {
    return 'expiring';
  }

  return 'active';
};
