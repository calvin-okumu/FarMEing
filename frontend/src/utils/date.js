import i18n from '../i18n';

export function formatAppDate(value) {
  if (!value) return '';

  const locale = i18n.language === 'sw' ? 'sw-TZ' : 'en-GB';
  return new Date(value).toLocaleDateString(locale);
}
