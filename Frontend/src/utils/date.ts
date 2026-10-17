/**
 * Formats an ISO or date string into a user-friendly format (e.g. "Nov 15, 2024")
 */
export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Calculates remaining days from current date to the target expiry date
 */
export const getDaysRemaining = (expiryDate: string): number => {
  if (!expiryDate) return 0;
  const expiry = new Date(expiryDate);
  if (isNaN(expiry.getTime())) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(expiry);
  target.setHours(0, 0, 0, 0);

  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

/**
 * Formats a remaining days integer into a relative human-readable string (e.g. "64d left", "2mo ago")
 */
export const formatDaysRemaining = (days: number): string => {
  if (days < 0) {
    const abs = Math.abs(days);
    if (abs === 1) return '1d ago';
    if (abs < 30) return `${abs}d ago`;
    if (abs < 365) return `${Math.floor(abs / 30)}mo ago`;
    const y = Math.floor(abs / 365);
    return `${y}y ago`;
  }
  if (days === 0) return 'Today';
  if (days === 1) return '1d left';
  if (days < 30) return `${days}d left`;
  if (days < 365) return `${Math.floor(days / 30)}mo left`;
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  return months > 0 ? `${years}y ${months}mo left` : `${years}y left`;
};
