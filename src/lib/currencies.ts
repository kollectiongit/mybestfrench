export const CURRENCIES = [
  { code: "EUR", label: "Euro (€)" },
  { code: "TWD", label: "Dollar taïwanais (NT$)" },
  { code: "USD", label: "Dollar US ($)" },
  { code: "GBP", label: "Livre sterling (£)" },
  { code: "CHF", label: "Franc suisse" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as readonly string[];

export function isValidCurrency(code: unknown): code is CurrencyCode {
  return typeof code === "string" && CURRENCY_CODES.includes(code);
}

export function formatMoney(amount: number, currency: string | null): string {
  if (!isValidCurrency(currency)) {
    return amount.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(amount);
}

// Like formatMoney but rounded to whole numbers (no decimals).
export function formatMoneyInteger(
  amount: number,
  currency: string | null
): string {
  if (!isValidCurrency(currency)) {
    return Math.round(amount).toLocaleString("fr-FR", {
      maximumFractionDigits: 0,
    });
  }
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
