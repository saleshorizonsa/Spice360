const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const serviceBillingCycles = {
  monthly: { months: 1, label: "Monthly" },
  quarterly: { months: 3, label: "Quarterly" },
  annual: { months: 12, label: "Annual" },
  custom: { months: 1, label: "Custom" }
};

export const isServiceInvoice = (invoice = {}) =>
  invoice.invoice_mode === "service" || invoice.invoice_category === "service";

export const isMissingRecurringBillingRunTableError = (error) =>
  error?.code === "PGRST205" ||
  error?.code === "42P01" ||
  /schema cache|relation .* does not exist|could not find the table/i.test(error?.message || "");

export const addMonths = (dateInput, months = 1) => {
  const date = new Date(dateInput);
  const day = date.getDate();
  const next = new Date(date);
  next.setMonth(next.getMonth() + Number(months || 1));
  if (next.getDate() < day) next.setDate(0);
  return next;
};

export const toDateOnly = (dateInput) => {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export const getCycleMonths = (contract = {}) => {
  if (contract.billing_cycle === "custom") return Number(contract.custom_billing_months || 1) || 1;
  return serviceBillingCycles[contract.billing_cycle]?.months || 1;
};

export const calculateNextBillingDate = (contract = {}, fromDate = contract.next_billing_date || contract.start_date) =>
  toDateOnly(addMonths(fromDate, getCycleMonths(contract)));

export const getServiceContractLines = (contract = {}) => {
  const lines = Array.isArray(contract.service_lines) && contract.service_lines.length > 0
    ? contract.service_lines
    : [{
      service_description: contract.service_description || contract.service_type || "IT Services",
      quantity: 1,
      unit: "month",
      unit_price: Number(contract.monthly_amount || contract.contract_amount || 0),
      vat_rate: Number(contract.vat_rate ?? 15),
      discount_percent: 0
    }];

  return lines.map((line, index) => {
    const quantity = Number(line.quantity || 1);
    const unitPrice = Number(line.unit_price || 0);
    const discountPercent = Number(line.discount_percent || 0);
    const taxableAmount = quantity * unitPrice * (1 - discountPercent / 100);
    const vatRate = Number(line.vat_rate ?? contract.vat_rate ?? 15);
    const vatAmount = taxableAmount * (vatRate / 100);
    return {
      line_number: index + 1,
      service_description: line.service_description || line.description || "IT Services",
      description: line.service_description || line.description || "IT Services",
      quantity,
      unit: line.unit || line.unit_of_measure || "month",
      unit_of_measure: line.unit || line.unit_of_measure || "month",
      unit_price: unitPrice,
      discount_percent: discountPercent,
      taxable_amount: taxableAmount,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      line_total: taxableAmount + vatAmount
    };
  });
};

export const buildServiceInvoiceFromContract = (contract = {}, billingDateInput = new Date()) => {
  const billingDate = toDateOnly(billingDateInput);
  const lines = getServiceContractLines(contract);
  const subtotal = lines.reduce((sum, line) => sum + line.taxable_amount, 0);
  const taxAmount = lines.reduce((sum, line) => sum + line.vat_amount, 0);
  const totalAmount = subtotal + taxAmount;
  const firstLine = lines[0] || {};
  const dueDate = new Date(billingDate);
  const days = contract.payment_terms === "net_45" ? 45 : contract.payment_terms === "net_60" ? 60 : 30;
  dueDate.setDate(dueDate.getDate() + days);

  return {
    tenant_id: contract.tenant_id,
    organization_id: contract.organization_id,
    invoice_mode: "service",
    invoice_category: "service",
    invoice_type: contract.invoice_type || "standard_tax_invoice",
    service_contract_id: contract.id,
    contract_number: contract.contract_number,
    service_type: contract.service_type,
    customer_code: contract.customer_code,
    customer_name: contract.customer_name,
    customer_email: contract.customer_email,
    customer_vat_number: contract.customer_vat_number,
    billing_address: contract.billing_address || contract.customer_address || "",
    preferred_language: contract.preferred_language || "bilingual",
    preferred_delivery_method: contract.preferred_delivery_method || "email",
    invoice_date: billingDate,
    due_date: toDateOnly(dueDate),
    service_period_start: billingDate,
    service_period_end: toDateOnly(addMonths(billingDate, getCycleMonths(contract))),
    product_code: contract.contract_number,
    product_name: firstLine.service_description || contract.service_type || "IT Services",
    service_description: firstLine.service_description || contract.service_type || "IT Services",
    quantity: firstLine.quantity || 1,
    unit_price: firstLine.unit_price || 0,
    unit_of_measure: firstLine.unit || "month",
    subtotal,
    tax_percent: Number(contract.vat_rate ?? firstLine.vat_rate ?? 15),
    tax_amount: taxAmount,
    total_amount: totalAmount,
    payment_terms: contract.payment_terms || "net_30",
    payment_status: "unpaid",
    zatca_status: "pending",
    zatca_submitted: false,
    service_lines: lines,
    notes: `Recurring service invoice for contract ${contract.contract_number || ""}`.trim(),
    auto_send_invoice: Boolean(contract.auto_send_invoice),
    auto_generated: true
  };
};

export const shouldGenerateInvoiceForContract = (contract = {}, asOfDateInput = new Date(), existingInvoices = []) => {
  if (!["active", "running"].includes(String(contract.status || "active"))) return false;
  if (contract.paused) return false;

  const nextBillingDate = toDateOnly(contract.next_billing_date || contract.start_date);
  if (!nextBillingDate) return false;
  if (nextBillingDate > toDateOnly(asOfDateInput)) return false;
  if (contract.end_date && nextBillingDate > contract.end_date && !contract.auto_renew) return false;

  return !existingInvoices.some((invoice) =>
    invoice.service_contract_id === contract.id &&
    invoice.invoice_date === nextBillingDate &&
    isServiceInvoice(invoice)
  );
};

export const generateRecurringInvoices = async ({
  contracts = [],
  existingInvoices = [],
  asOfDate = new Date(),
  createInvoice,
  updateContract,
  createNotification
}) => {
  const generated = [];

  for (const contract of contracts) {
    if (!shouldGenerateInvoiceForContract(contract, asOfDate, existingInvoices)) continue;

    const billingDate = contract.next_billing_date || contract.start_date;
    const invoice = buildServiceInvoiceFromContract(contract, billingDate);
    const savedInvoice = createInvoice ? await createInvoice(invoice, contract) : invoice;
    generated.push(savedInvoice);

    const nextBillingDate = calculateNextBillingDate(contract, billingDate);
    if (updateContract) {
      await updateContract(contract, {
        ...contract,
        last_billing_date: toDateOnly(billingDate),
        next_billing_date: nextBillingDate
      });
    }

    if (createNotification && contract.owner_email) {
      await createNotification({
        userEmail: contract.owner_email,
        notificationType: "service_invoice_generated",
        priority: "medium",
        title: "Recurring invoice generated",
        message: `Invoice generated for ${contract.contract_number}`,
        relatedEntity: "invoice",
        relatedEntityId: savedInvoice.id,
        relatedDocumentNumber: savedInvoice.invoice_number,
        actionUrl: "/Sales"
      });
    }
  }

  return generated;
};

export const calculateServiceBusinessKpis = (contracts = [], invoices = [], asOfDateInput = new Date()) => {
  const asOfDate = new Date(asOfDateInput);
  const activeContracts = contracts.filter((contract) => ["active", "running"].includes(String(contract.status || "active")) && !contract.paused);
  const monthlyRecurringRevenue = activeContracts.reduce((sum, contract) => {
    const amount = Number(contract.monthly_amount || contract.contract_amount || 0);
    const months = getCycleMonths(contract);
    return sum + (months > 0 ? amount / months : amount);
  }, 0);

  const next30 = new Date(asOfDate);
  next30.setDate(next30.getDate() + 30);
  const upcomingRenewals = activeContracts.filter((contract) =>
    contract.end_date &&
    new Date(contract.end_date).getTime() >= asOfDate.getTime() &&
    new Date(contract.end_date).getTime() <= next30.getTime()
  );

  return {
    monthlyRecurringRevenue,
    annualRecurringRevenue: monthlyRecurringRevenue * 12,
    activeContracts: activeContracts.length,
    upcomingRenewals: upcomingRenewals.length,
    overdueInvoices: invoices.filter((invoice) =>
      invoice.payment_status !== "paid" &&
      invoice.due_date &&
      new Date(invoice.due_date).getTime() < asOfDate.getTime()
    ).length,
    serviceInvoices: invoices.filter(isServiceInvoice).length
  };
};
