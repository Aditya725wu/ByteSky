const REGION_CURRENCY_MAP = {
  us: { code: 'usd', locale: 'en-US' },
  gb: { code: 'gbp', locale: 'en-GB' },
  in: { code: 'inr', locale: 'en-IN' },
  de: { code: 'eur', locale: 'de-DE' },
  'us-east-1': { code: 'usd', locale: 'en-US' },
  'us-west-2': { code: 'usd', locale: 'en-US' },
  'eu-west-1': { code: 'eur', locale: 'en-IE' },
  'eu-central-1': { code: 'eur', locale: 'de-DE' },
  'ap-south-1': { code: 'inr', locale: 'en-IN' },
  'ap-southeast-1': { code: 'sgd', locale: 'en-SG' },
  'ap-northeast-1': { code: 'jpy', locale: 'ja-JP' },
  'ap-southeast-2': { code: 'aud', locale: 'en-AU' },
  'ca-central-1': { code: 'cad', locale: 'en-CA' },
  'sa-east-1': { code: 'brl', locale: 'pt-BR' }
};

const DEFAULT_CURRENCY_META = REGION_CURRENCY_MAP.us;

function normalizeCurrencyKey(value = '') {
  return String(value || '').trim().toLowerCase();
}

function resolveCurrencyMeta(value = '') {
  const key = normalizeCurrencyKey(value);
  if (!key) {
    return DEFAULT_CURRENCY_META;
  }

  return REGION_CURRENCY_MAP[key] || DEFAULT_CURRENCY_META;
}

function resolveCurrencyCode(value = '', fallback = DEFAULT_CURRENCY_META.code) {
  const meta = resolveCurrencyMeta(value);
  return meta.code || fallback;
}

function resolveCurrencyLocale(value = '', fallback = DEFAULT_CURRENCY_META.locale) {
  const meta = resolveCurrencyMeta(value);
  return meta.locale || fallback;
}

function formatCurrencyAmount(amount, value = '', options = {}) {
  const meta = resolveCurrencyMeta(value);
  const numericAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  const locale = options.locale || meta.locale || DEFAULT_CURRENCY_META.locale;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: meta.code.toUpperCase(),
    minimumFractionDigits: options.minimumFractionDigits ?? 2,
    maximumFractionDigits: options.maximumFractionDigits ?? 2
  }).format(numericAmount);
}

module.exports = {
  formatCurrencyAmount,
  resolveCurrencyCode,
  resolveCurrencyLocale
};
