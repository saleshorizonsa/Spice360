export const PRINT_LANGUAGES = {
  en: "English",
  ar: "Arabic",
  bilingual: "Bilingual"
};

export const REQUIRED_ZATCA_FIELDS = [
  "sellerDetails",
  "buyerDetails",
  "vatNumbers",
  "address",
  "qrCode"
];

export const DEFAULT_PRINTING_PREFERENCES = {
  default_template_style: "zatca_standard",
  default_language: "bilingual",
  paper_size: "a4",
  orientation: "portrait",
  font_size: "normal",
  show_header: true,
  show_footer: true,
  footer_text: "Thank you for your business.",
  terms_and_conditions:
    "Payment is due according to the agreed payment terms. Goods remain subject to company policy and applicable Saudi VAT regulations.",
  bank_details: "",
  footer_message: "",
  fields: {
    logo: true,
    sellerDetails: true,
    buyerDetails: true,
    vatNumbers: true,
    commercialRegistrationNumber: true,
    address: true,
    qrCode: true,
    paymentTerms: true,
    notes: true,
    discountColumn: true,
    unitColumn: true,
    signatureSection: true,
    stampSection: true,
    termsAndConditions: true,
    bankDetails: true,
    footerMessage: true
  }
};

export const PRINT_FIELD_LABELS = [
  ["logo", "Logo"],
  ["sellerDetails", "Seller details"],
  ["buyerDetails", "Buyer details"],
  ["vatNumbers", "VAT numbers"],
  ["commercialRegistrationNumber", "Commercial registration number"],
  ["address", "Address"],
  ["qrCode", "QR code"],
  ["paymentTerms", "Payment terms"],
  ["notes", "Notes"],
  ["discountColumn", "Discount column"],
  ["unitColumn", "Unit column"],
  ["signatureSection", "Signature section"],
  ["stampSection", "Stamp section"],
  ["termsAndConditions", "Terms and conditions"],
  ["bankDetails", "Bank details"],
  ["footerMessage", "Footer message"]
];

export const labelText = {
  invoiceTitle: ["Tax Invoice", "فاتورة ضريبية"],
  sellerName: ["Seller name", "اسم البائع"],
  sellerVat: ["Seller VAT number", "الرقم الضريبي للبائع"],
  sellerAddress: ["Seller address", "عنوان البائع"],
  sellerCr: ["Commercial registration number", "رقم السجل التجاري"],
  buyerName: ["Buyer name", "اسم المشتري"],
  buyerVat: ["Buyer VAT number", "الرقم الضريبي للمشتري"],
  buyerAddress: ["Buyer address", "عنوان المشتري"],
  invoiceNumber: ["Invoice number", "رقم الفاتورة"],
  invoiceDate: ["Invoice date", "تاريخ الفاتورة"],
  supplyDate: ["Supply date", "تاريخ التوريد"],
  invoiceType: ["Invoice type", "نوع الفاتورة"],
  lineItems: ["Line items", "البنود"],
  itemName: ["Item name", "اسم الصنف"],
  quantity: ["Quantity", "الكمية"],
  unit: ["Unit", "الوحدة"],
  unitPrice: ["Unit price", "سعر الوحدة"],
  discount: ["Discount", "الخصم"],
  taxableAmount: ["Taxable amount", "المبلغ الخاضع للضريبة"],
  vatRate: ["VAT rate", "نسبة الضريبة"],
  vatAmount: ["VAT amount", "مبلغ الضريبة"],
  totalExVat: ["Total excluding VAT", "الإجمالي بدون ضريبة"],
  totalVat: ["Total VAT", "إجمالي الضريبة"],
  totalIncVat: ["Total including VAT", "الإجمالي شامل الضريبة"],
  zatcaQr: ["ZATCA QR code", "رمز الاستجابة السريعة"],
  paymentTerms: ["Payment terms", "شروط الدفع"],
  notes: ["Notes", "ملاحظات"],
  terms: ["Terms and conditions", "الشروط والأحكام"],
  bankDetails: ["Bank details", "بيانات البنك"],
  signature: ["Authorized signature", "التوقيع المعتمد"],
  stamp: ["Company stamp", "ختم الشركة"]
};

export const mergePrintingPreferences = (preferences = {}) => ({
  ...DEFAULT_PRINTING_PREFERENCES,
  ...preferences,
  fields: {
    ...DEFAULT_PRINTING_PREFERENCES.fields,
    ...(preferences?.fields || {})
  }
});

export const getLabel = (key, language = "bilingual") => {
  const [en, ar] = labelText[key] || [key, key];
  if (language === "ar") return ar;
  if (language === "en") return en;
  return `${en} / ${ar}`;
};

export const getPrintDirection = (language = "bilingual") =>
  language === "ar" ? "rtl" : "ltr";

export const formatMoney = (value, currency = "SAR") =>
  `${currency} ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

export const normalizeInvoiceForPrint = (invoice = {}, organization = {}, preferences = {}) => {
  const mergedPreferences = mergePrintingPreferences(preferences);
  const quantity = Number(invoice.quantity || 0);
  const unitPrice = Number(invoice.unit_price || 0);
  const discount = Number(invoice.discount_amount || invoice.discount || 0);
  const taxableAmount = Number(invoice.subtotal ?? Math.max(quantity * unitPrice - discount, 0));
  const vatRate = Number(invoice.tax_percent ?? invoice.vat_percent ?? 15);
  const vatAmount = Number(invoice.tax_amount ?? invoice.vat_amount ?? taxableAmount * (vatRate / 100));
  const totalAmount = Number(invoice.total_amount ?? taxableAmount + vatAmount);
  const currency = invoice.currency || "SAR";
  const serviceItems = Array.isArray(invoice.service_lines)
    ? invoice.service_lines.map((line) => ({
      name: line.service_description || line.description || "IT Services",
      description: invoice.contract_number ? `Contract ${invoice.contract_number}` : line.description || "",
      quantity: Number(line.quantity || 1),
      unit: line.unit || line.unit_of_measure || invoice.unit_of_measure || "month",
      unit_price: Number(line.unit_price || 0),
      discount: Number(line.discount_amount || line.discount || 0),
      taxable_amount: Number(line.taxable_amount || 0),
      vat_rate: Number(line.vat_rate ?? invoice.tax_percent ?? 15),
      vat_amount: Number(line.vat_amount || 0),
      total_amount: Number(line.line_total ?? line.total_amount ?? 0)
    }))
    : null;

  return {
    invoice_number: invoice.invoice_number || invoice.document_number || invoice.id || "DRAFT",
    invoice_date: invoice.invoice_date || invoice.document_date || new Date().toISOString().slice(0, 10),
    supply_date: invoice.supply_date || invoice.delivery_date || invoice.invoice_date,
    invoice_type: invoice.invoice_type || "standard_tax_invoice",
    seller: {
      name: organization.organization_name || organization.company_name || organization.trade_name || invoice.seller_name || "MatrixSales",
      vat_number: organization.vat_registration_number || organization.vat_number || invoice.seller_vat_number || "",
      cr_number: organization.cr_number || organization.commercial_registration_number || "",
      address: organization.address || organization.registered_address || organization.city || invoice.seller_address || ""
    },
    buyer: {
      name: invoice.customer_name || invoice.buyer_name || "",
      vat_number: invoice.customer_vat_number || invoice.buyer_vat_number || "",
      address: invoice.billing_address || invoice.customer_address || invoice.delivery_address || ""
    },
    items: invoice.items || serviceItems || [
      {
        name: invoice.service_description || invoice.product_name || invoice.product_code || "Item",
        description: invoice.invoice_mode === "service" ? (invoice.contract_number || invoice.product_code || "") : (invoice.product_code || ""),
        quantity,
        unit: invoice.unit || invoice.uom || invoice.unit_of_measure || "EA",
        unit_price: unitPrice,
        discount,
        taxable_amount: taxableAmount,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        total_amount: totalAmount
      }
    ],
    totals: {
      currency,
      discount,
      taxable_amount: taxableAmount,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      total_amount: totalAmount
    },
    payment_terms: invoice.payment_terms || "",
    notes: invoice.notes || "",
    preferences: mergedPreferences
  };
};

export const validateZatcaPrintPreferences = (preferences = {}, invoice = {}) => {
  const merged = mergePrintingPreferences(preferences);
  const warnings = [];
  const errors = [];
  const invoiceType = invoice.invoice_type || "standard_tax_invoice";
  const fields = merged.fields || {};

  REQUIRED_ZATCA_FIELDS.forEach((field) => {
    if (fields[field] === false) {
      errors.push(`${field} cannot be hidden for ${invoiceType} invoices.`);
    }
  });

  if (!fields.commercialRegistrationNumber) {
    warnings.push("Commercial registration number is commonly required on Saudi commercial documents.");
  }

  if (Number(invoice.tax_percent ?? invoice.vat_percent ?? 15) > 0 && !fields.vatNumbers) {
    errors.push("VAT numbers must remain visible on taxable invoices.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

export const buildBilingualEmailMessage = (invoice = {}) => {
  const number = invoice.invoice_number || invoice.document_number || invoice.id || "";
  return [
    `Dear customer,`,
    `Please find attached invoice ${number}.`,
    ``,
    `عميلنا العزيز،`,
    `مرفق لكم الفاتورة رقم ${number}.`,
    ``,
    `Thank you / شكرا لكم`
  ].join("\n");
};

export const createSecureShareToken = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `share-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};
