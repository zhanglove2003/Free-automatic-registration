const SMS_PRICE_DECIMALS = 4;
const SMS_PRICE_SCALE = 10 ** SMS_PRICE_DECIMALS;

export function parseSmsPriceInput(value: string): number | undefined {
  const raw = value.trim();
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return undefined;
  return normalizeSmsPrice(parsed);
}

export function formatSmsPriceInput(value: number | undefined): string {
  const normalized = normalizeSmsPrice(value);
  return normalized === undefined ? '' : normalized.toFixed(SMS_PRICE_DECIMALS);
}

export function formatSmsPriceParam(value: number | undefined): string | undefined {
  const normalized = normalizeSmsPrice(value);
  return normalized === undefined ? undefined : normalized.toFixed(SMS_PRICE_DECIMALS);
}

export function normalizeSmsPrice(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.round(value * SMS_PRICE_SCALE) / SMS_PRICE_SCALE;
}
