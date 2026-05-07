import React from "react";
import { generateZatcaQrPayload } from "@/components/utils/zatcaCompliance";
import InvoiceQRCode from "./InvoiceQRCode";
import {
  formatMoney,
  getLabel,
  getPrintDirection,
  normalizeInvoiceForPrint,
  validateZatcaPrintPreferences
} from "./invoicePrintUtils";

export default function ZatcaInvoiceTemplate({
  invoice,
  organization,
  preferences,
  logoAsset,
  language
}) {
  const doc = normalizeInvoiceForPrint(invoice, organization, preferences);
  const activeLanguage = language || doc.preferences.default_language;
  const dir = getPrintDirection(activeLanguage);
  const fields = doc.preferences.fields;
  const validation = validateZatcaPrintPreferences(doc.preferences, invoice);
  const qrPayload = generateZatcaQrPayload(
    {
      ...invoice,
      seller_name: doc.seller.name,
      seller_vat_number: doc.seller.vat_number,
      total_amount: doc.totals.total_amount,
      tax_amount: doc.totals.vat_amount
    },
    {
      organization_name: doc.seller.name,
      vat_registration_number: doc.seller.vat_number
    }
  );
  const templateClass = doc.preferences.default_template_style === "compact"
    ? "text-[12px]"
    : doc.preferences.font_size === "large"
      ? "text-[15px]"
      : doc.preferences.font_size === "small"
        ? "text-[12px]"
        : "text-[13px]";

  return (
    <article
      dir={dir}
      className={`zatca-invoice-template mx-auto bg-white text-slate-950 ${templateClass}`}
      data-paper-size={doc.preferences.paper_size}
      data-orientation={doc.preferences.orientation}
    >
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .zatca-invoice-template, .zatca-invoice-template * { visibility: visible; }
          .zatca-invoice-template {
            position: absolute;
            inset: 0;
            width: 100%;
            margin: 0;
            box-shadow: none !important;
          }
          @page {
            size: ${doc.preferences.paper_size === "thermal" ? "80mm auto" : `A4 ${doc.preferences.orientation}`};
            margin: ${doc.preferences.paper_size === "thermal" ? "4mm" : "10mm"};
          }
        }
      `}</style>

      {!validation.valid && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-red-700 print:hidden">
          <p className="font-semibold">ZATCA visibility warnings</p>
          <ul className="mt-1 list-disc pl-5">
            {validation.errors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        </div>
      )}

      <section className="rounded-lg border border-slate-200 shadow-sm print:rounded-none print:border-0 print:shadow-none">
        {doc.preferences.show_header && (
          <header className="flex items-start justify-between gap-6 border-b border-slate-200 p-6">
            <div className="flex items-start gap-4">
              {fields.logo && logoAsset?.data_url && (
                <img src={logoAsset.data_url} alt="Company logo" className="h-16 max-w-32 object-contain" />
              )}
              <div>
                <h1 className="text-2xl font-bold tracking-wide">{getLabel("invoiceTitle", activeLanguage)}</h1>
                <p className="mt-1 text-slate-500">{doc.invoice_type.replace(/_/g, " ")}</p>
              </div>
            </div>
            <div className="grid min-w-64 gap-1 text-sm">
              <div className="flex justify-between gap-4"><span>{getLabel("invoiceNumber", activeLanguage)}</span><strong>{doc.invoice_number}</strong></div>
              <div className="flex justify-between gap-4"><span>{getLabel("invoiceDate", activeLanguage)}</span><strong>{doc.invoice_date}</strong></div>
              {doc.supply_date && <div className="flex justify-between gap-4"><span>{getLabel("supplyDate", activeLanguage)}</span><strong>{doc.supply_date}</strong></div>}
            </div>
          </header>
        )}

        <main className="space-y-6 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            {fields.sellerDetails && (
              <section className="rounded border border-slate-200 p-4">
                <h2 className="mb-3 font-semibold">{getLabel("sellerName", activeLanguage)}</h2>
                <p className="font-medium">{doc.seller.name}</p>
                {fields.vatNumbers && <p>{getLabel("sellerVat", activeLanguage)}: {doc.seller.vat_number || "-"}</p>}
                {fields.commercialRegistrationNumber && <p>{getLabel("sellerCr", activeLanguage)}: {doc.seller.cr_number || "-"}</p>}
                {fields.address && <p>{getLabel("sellerAddress", activeLanguage)}: {doc.seller.address || "-"}</p>}
              </section>
            )}
            {fields.buyerDetails && (
              <section className="rounded border border-slate-200 p-4">
                <h2 className="mb-3 font-semibold">{getLabel("buyerName", activeLanguage)}</h2>
                <p className="font-medium">{doc.buyer.name || "-"}</p>
                {fields.vatNumbers && <p>{getLabel("buyerVat", activeLanguage)}: {doc.buyer.vat_number || "-"}</p>}
                {fields.address && <p>{getLabel("buyerAddress", activeLanguage)}: {doc.buyer.address || "-"}</p>}
              </section>
            )}
          </div>

          <section>
            <h2 className="mb-3 font-semibold">{getLabel("lineItems", activeLanguage)}</h2>
            <div className="overflow-hidden rounded border border-slate-200">
              <table className="w-full border-collapse">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-2 text-start">#</th>
                    <th className="p-2 text-start">{getLabel("itemName", activeLanguage)}</th>
                    <th className="p-2 text-end">{getLabel("quantity", activeLanguage)}</th>
                    {fields.unitColumn && <th className="p-2 text-end">{getLabel("unit", activeLanguage)}</th>}
                    <th className="p-2 text-end">{getLabel("unitPrice", activeLanguage)}</th>
                    {fields.discountColumn && <th className="p-2 text-end">{getLabel("discount", activeLanguage)}</th>}
                    <th className="p-2 text-end">{getLabel("taxableAmount", activeLanguage)}</th>
                    <th className="p-2 text-end">{getLabel("vatRate", activeLanguage)}</th>
                    <th className="p-2 text-end">{getLabel("vatAmount", activeLanguage)}</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.items.map((item, index) => (
                    <tr key={`${item.name}-${index}`} className="border-t border-slate-200">
                      <td className="p-2">{index + 1}</td>
                      <td className="p-2">{item.name}</td>
                      <td className="p-2 text-end">{item.quantity}</td>
                      {fields.unitColumn && <td className="p-2 text-end">{item.unit || "-"}</td>}
                      <td className="p-2 text-end">{formatMoney(item.unit_price, doc.totals.currency)}</td>
                      {fields.discountColumn && <td className="p-2 text-end">{formatMoney(item.discount, doc.totals.currency)}</td>}
                      <td className="p-2 text-end">{formatMoney(item.taxable_amount, doc.totals.currency)}</td>
                      <td className="p-2 text-end">{Number(item.vat_rate || 0).toFixed(2)}%</td>
                      <td className="p-2 text-end">{formatMoney(item.vat_amount, doc.totals.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-6 md:grid-cols-[1fr_320px]">
            <div className="space-y-3">
              {fields.paymentTerms && doc.payment_terms && <p><strong>{getLabel("paymentTerms", activeLanguage)}:</strong> {doc.payment_terms}</p>}
              {fields.notes && doc.notes && <p><strong>{getLabel("notes", activeLanguage)}:</strong> {doc.notes}</p>}
              {fields.termsAndConditions && doc.preferences.terms_and_conditions && <p><strong>{getLabel("terms", activeLanguage)}:</strong> {doc.preferences.terms_and_conditions}</p>}
              {fields.bankDetails && doc.preferences.bank_details && <p><strong>{getLabel("bankDetails", activeLanguage)}:</strong> {doc.preferences.bank_details}</p>}
            </div>
            <aside className="space-y-2 rounded border border-slate-200 p-4">
              <div className="flex justify-between gap-4"><span>{getLabel("totalExVat", activeLanguage)}</span><strong>{formatMoney(doc.totals.taxable_amount, doc.totals.currency)}</strong></div>
              <div className="flex justify-between gap-4"><span>{getLabel("totalVat", activeLanguage)}</span><strong>{formatMoney(doc.totals.vat_amount, doc.totals.currency)}</strong></div>
              <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 text-base"><span>{getLabel("totalIncVat", activeLanguage)}</span><strong>{formatMoney(doc.totals.total_amount, doc.totals.currency)}</strong></div>
            </aside>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {fields.qrCode && (
              <div>
                <InvoiceQRCode payload={qrPayload} label={getLabel("zatcaQr", activeLanguage)} />
              </div>
            )}
            {fields.signatureSection && <div className="flex items-end"><div className="w-full border-t border-slate-400 pt-2 text-center">{getLabel("signature", activeLanguage)}</div></div>}
            {fields.stampSection && <div className="flex items-end"><div className="w-full rounded border border-dashed border-slate-400 p-8 text-center text-slate-500">{getLabel("stamp", activeLanguage)}</div></div>}
          </div>
        </main>

        {doc.preferences.show_footer && (
          <footer className="border-t border-slate-200 p-4 text-center text-xs text-slate-500">
            {fields.footerMessage ? doc.preferences.footer_message || doc.preferences.footer_text : doc.preferences.footer_text}
          </footer>
        )}
      </section>
    </article>
  );
}

