export const formatCurrency = (
  amountInCents: number | string,
  currency: string,
): string => {
  const cents =
    typeof amountInCents === 'string'
      ? Number.parseInt(amountInCents, 10)
      : amountInCents;

  const major = (cents / 100).toFixed(2);
  return `${major} ${(currency ?? '').toUpperCase()}`.trim();
};
