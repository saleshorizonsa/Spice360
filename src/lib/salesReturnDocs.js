/**
 * The documents a credit note has to put right, beyond the money.
 *
 * A sales return reverses the customer's invoice and the stock, but on its own it
 * leaves the shipping documents still claiming the goods are with the customer:
 * the sales order reads fully delivered, so nothing can be re-shipped against it,
 * and no document records that the goods came back.
 *
 * Pure and dependency-free so the rules can be tested without a database — the
 * form just persists what these return.
 */

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * The sales order's delivered quantity and status once `returnedQty` comes back.
 *
 * Deliberately the same rule the delivery reversal uses, so a return and a
 * reversal leave an order in the same state. Dropping to nothing delivered puts
 * the order back to 'confirmed' rather than leaving it 'delivered', which is what
 * makes a replacement shipment possible.
 */
export const salesOrderAfterReturn = (salesOrder = {}, returnedQty = 0) => {
  const delivered = Math.max(0, num(salesOrder.quantity_delivered) - Math.max(0, num(returnedQty)));
  const ordered = num(salesOrder.quantity);
  const status = delivered >= ordered && ordered > 0
    ? 'delivered'
    : delivered > 0
      ? 'partially_delivered'
      : 'confirmed';
  return { quantity_delivered: delivered, status };
};

/**
 * The return delivery raised by a credit note — the document that says the goods
 * physically came back, and the counterpart of the outbound delivery note.
 *
 * `pgi_done` stays false on purpose. The stock movement belongs to the credit
 * note, which has already made it; marking this document posted would invite the
 * delivery-reversal flow to "put back" a goods issue that never happened here,
 * returning the same goods to stock a second time. `delivery_type: 'return'` is
 * what the reversal dialog refuses on.
 */
export const buildReturnDelivery = ({ salesReturn = {}, deliveryNumber, orgId = null } = {}) => {
  const quantity = Math.max(0, num(salesReturn.quantity_returned));
  const line = {
    product_code: salesReturn.product_code || '',
    product_name: salesReturn.product_name || '',
    quantity_delivered: quantity,
    unit_of_measure: salesReturn.unit_of_measure || '',
  };

  return {
    delivery_number: deliveryNumber,
    delivery_type: 'return',
    sales_order_number: salesReturn.sales_order_number || '',
    customer_code: salesReturn.customer_code || '',
    customer_name: salesReturn.customer_name || '',
    delivery_date: salesReturn.return_date || new Date().toISOString().split('T')[0],
    product_code: line.product_code,
    product_name: line.product_name,
    quantity_delivered: quantity,
    unit_of_measure: line.unit_of_measure,
    delivery_lines: [line],
    // Back-references, so the chain can be traced from either end.
    sales_return_number: salesReturn.return_number || '',
    return_of_invoice: salesReturn.invoice_number || '',
    status: 'returned',
    pgi_done: false,
    notes: `Goods returned under credit note ${salesReturn.return_number || ''}`.trim(),
    ...(orgId ? { organization_id: orgId } : {}),
  };
};

/** A delivery raised by a credit note — the reversal flow must not touch it. */
export const isReturnDelivery = (delivery = {}) =>
  String(delivery?.delivery_type || '').trim().toLowerCase() === 'return';
