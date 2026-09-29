export const VAT_RATE_BP = 700;
const BP_DENOMINATOR = 10_000;

export function divRoundHalfUp(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

export function lineAmount(quantityHundredths: number, unitPriceSatang: number): number {
  return divRoundHalfUp(quantityHundredths * unitPriceSatang, 100);
}

export function hourlyUnitPrice(hoursHundredths: number, hourlyRateSatang: number): number {
  return divRoundHalfUp(hoursHundredths * hourlyRateSatang, 100);
}

export function priceItem<T extends { hoursHundredths: number; unitPriceSatang: number }>(
  item: T,
  hourlyRateSatang: number,
): T {
  if (item.hoursHundredths <= 0) return item;
  return { ...item, unitPriceSatang: hourlyUnitPrice(item.hoursHundredths, hourlyRateSatang) };
}

function applyRateBp(amount: number, rateBp: number): number {
  return divRoundHalfUp(amount * rateBp, BP_DENOMINATOR);
}

export type TotalsInput = {
  items: { quantityHundredths: number; unitPriceSatang: number }[];
  vatEnabled: boolean;
  withholdingEnabled: boolean;
  withholdingRateBp: number;
};

export type Totals = {
  subtotal: number;
  vatAmount: number;
  total: number;
  withholdingAmount: number;
  netPayable: number;
};

export function computeTotals(input: TotalsInput): Totals {
  const subtotal = input.items.reduce(
    (sum, item) => sum + lineAmount(item.quantityHundredths, item.unitPriceSatang),
    0,
  );
  const vatAmount = input.vatEnabled ? applyRateBp(subtotal, VAT_RATE_BP) : 0;
  const total = subtotal + vatAmount;
  const withholdingAmount = input.withholdingEnabled ? applyRateBp(subtotal, input.withholdingRateBp) : 0;
  return { subtotal, vatAmount, total, withholdingAmount, netPayable: total - withholdingAmount };
}

const DECIMAL_2 = /^(\d+)?(?:\.(\d{1,2}))?$/;

export function parseDecimal2(text: string): number | null {
  const cleaned = text.trim().replaceAll(',', '');
  const match = DECIMAL_2.exec(cleaned);
  if (!cleaned || !match || (match[1] === undefined && match[2] === undefined)) return null;
  const whole = Number(match[1] ?? '0');
  const fraction = Number((match[2] ?? '').padEnd(2, '0'));
  return whole * 100 + fraction;
}

export function formatDecimal2(value: number): string {
  return (value / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function toInputString(value: number): string {
  return (value / 100).toFixed(2);
}

export function formatQuantity(hundredths: number): string {
  return (hundredths / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
}
