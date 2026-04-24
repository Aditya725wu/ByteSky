const { convertCurrencyAmount, resolveCurrencyCode } = require('./currency');

const VM_BASE_MONTHLY_USD = {
  micro: 4.99,
  small: 12.99,
  large: 39.99
};

const VM_REGION_PRICE_MULTIPLIERS = {
  'us-east-1': 1.0,
  'us-west-2': 1.1,
  'eu-west-1': 1.15,
  'eu-central-1': 1.18,
  'ap-south-1': 1.2,
  'ap-southeast-1': 1.22,
  'ap-northeast-1': 1.25,
  'ap-southeast-2': 1.24,
  'ca-central-1': 1.14,
  'sa-east-1': 1.28,
  us: 1.0,
  gb: 1.08,
  in: 1.2,
  de: 1.18
};

function normalizePricingKey(value = '') {
  return String(value || '').trim().toLowerCase();
}

function getVmBaseMonthlyUsd(size = 'micro') {
  return VM_BASE_MONTHLY_USD[normalizePricingKey(size)] || VM_BASE_MONTHLY_USD.micro;
}

function getVmRegionMultiplier(region = 'us-east-1') {
  return VM_REGION_PRICE_MULTIPLIERS[normalizePricingKey(region)] || 1;
}

function getVmPricing(size = 'micro', region = 'us-east-1', options = {}) {
  const normalizedSize = normalizePricingKey(size) || 'micro';
  const normalizedRegion = normalizePricingKey(region) || 'us-east-1';
  const regionMultiplier = Number.isFinite(Number(options.regionMultiplier))
    ? Number(options.regionMultiplier)
    : getVmRegionMultiplier(normalizedRegion);
  const currency = options.currency || resolveCurrencyCode(normalizedRegion);
  const baseMonthlyUsd = getVmBaseMonthlyUsd(normalizedSize);
  const regionalMonthlyUsd = baseMonthlyUsd * regionMultiplier;
  const monthlyCost = convertCurrencyAmount(regionalMonthlyUsd, 'usd', currency);
  const hourlyRate = monthlyCost / 730;

  return {
    size: normalizedSize,
    region: normalizedRegion,
    currency,
    baseMonthlyUsd,
    regionMultiplier,
    monthlyCost,
    hourlyRate
  };
}

module.exports = {
  getVmBaseMonthlyUsd,
  getVmPricing,
  getVmRegionMultiplier,
  VM_BASE_MONTHLY_USD,
  VM_REGION_PRICE_MULTIPLIERS
};
