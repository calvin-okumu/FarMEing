const CURRENCY_META = {
  USD: { symbol: '$', locale: 'en-US' },
  TZS: { symbol: 'TSh', locale: 'sw-TZ' },
  KES: { symbol: 'KSh', locale: 'en-KE' },
};

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_META);

export function formatCurrency(amount, currency = 'USD') {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const meta = CURRENCY_META[currency] || CURRENCY_META.USD;

  try {
    return new Intl.NumberFormat(meta.locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(safeAmount);
  } catch {
    return `${meta.symbol}${safeAmount.toLocaleString()}`;
  }
}
