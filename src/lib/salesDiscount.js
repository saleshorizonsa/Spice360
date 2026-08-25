const number = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const lineDiscount = (line = {}) => {
  const quantity = Math.max(0, number(line.quantity));
  const unitPrice = Math.max(0, number(line.unit_price));
  const gross = quantity * unitPrice;
  const legacyPercent = number(line.discount_percent);
  const hasLegacyPercent = legacyPercent > 0 && number(line.discount_amount) === 0;
  const amount = hasLegacyPercent
    ? gross * (legacyPercent / 100)
    : line.discount_amount != null && line.discount_amount !== ''
    ? number(line.discount_amount)
    : gross * (legacyPercent / 100);
  const discountAmount = Math.min(gross, Math.max(0, amount));

  return {
    gross,
    discountAmount,
    lineTotal: gross - discountAmount,
  };
};

export const normalizeSalesLine = (line = {}) => {
  const totals = lineDiscount(line);
  return {
    ...line,
    discount_percent: 0,
    discount_amount: totals.discountAmount,
    line_total: totals.lineTotal,
  };
};

export const documentDiscount = (subtotal, discountAmount) =>
  Math.min(Math.max(0, number(subtotal)), Math.max(0, number(discountAmount)));
