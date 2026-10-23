// ═══════════════════════════════════════════════════════════
// Currency & Number Formatting Utilities
// ═══════════════════════════════════════════════════════════

/**
 * Format a number in Indian numbering system (₹1,23,456.00)
 */
export function formatINR(amount) {
  if (amount === null || amount === undefined) return '₹0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (isNaN(num)) return '₹0.00';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format currency based on settings
 */
export function formatCurrency(amount, currency = 'INR') {
  if (amount === null || amount === undefined) return formatINR(0);
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (isNaN(num)) return formatINR(0);

  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}
