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

const CURRENCY_EXCHANGE_RATE_MAP = {
  usd: 1,
  gbp: 0.79,
  eur: 0.92,
  inr: 83.5,
  sgd: 1.35,
  jpy: 149,
  aud: 1.52,
  cad: 1.36,
  brl: 5.08
};

const CURRENCY_FRACTION_DIGITS_MAP = {
  jpy: 0
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

function resolveCurrencyRate(value = '', fallback = 1) {
  const meta = resolveCurrencyMeta(value);
  return CURRENCY_EXCHANGE_RATE_MAP[meta.code] || fallback;
}

function getCurrencyFractionDigits(value = '') {
  const meta = resolveCurrencyMeta(value);
  return CURRENCY_FRACTION_DIGITS_MAP[meta.code] ?? 2;
}

function roundCurrencyAmount(amount, value = '') {
  const numericAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  const digits = getCurrencyFractionDigits(value);
  const factor = 10 ** digits;
  return Math.round(numericAmount * factor) / factor;
}

function convertCurrencyAmount(amount, fromValue = 'usd', toValue = 'usd') {
  const numericAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  const sourceRate = resolveCurrencyRate(fromValue);
  const targetRate = resolveCurrencyRate(toValue);

  if (!sourceRate || !targetRate) {
    return numericAmount;
  }

  return numericAmount * (targetRate / sourceRate);
}

function toCurrencyMinorUnits(amount, value = '') {
  const numericAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  const digits = getCurrencyFractionDigits(value);
  const factor = 10 ** digits;
  return Math.round(numericAmount * factor);
}

function formatCurrencyAmount(amount, value = '', options = {}) {
  const meta = resolveCurrencyMeta(value);
  const numericAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  const locale = options.locale || meta.locale || DEFAULT_CURRENCY_META.locale;
  const defaultFractionDigits = getCurrencyFractionDigits(meta.code);
  const minimumFractionDigits = options.minimumFractionDigits ?? defaultFractionDigits;
  const maximumFractionDigits = options.maximumFractionDigits ?? Math.max(defaultFractionDigits, minimumFractionDigits);

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: meta.code.toUpperCase(),
    minimumFractionDigits,
    maximumFractionDigits
  }).format(numericAmount);
}

module.exports = {
  convertCurrencyAmount,
  formatCurrencyAmount,
  getCurrencyFractionDigits,
  resolveCurrencyCode,
  resolveCurrencyLocale,
  resolveCurrencyRate,
  roundCurrencyAmount,
  toCurrencyMinorUnits
};
