import React, { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Printer, Download } from "lucide-react";
import PrintableDocument from "./PrintableDocument";
import { useOrganization } from "@/components/utils/OrganizationContext";

const fmtAmt = (v) =>
    v != null && v !== 0
        ? Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "—";

function JournalEntryBody({ document }) {
    const lines = document.journal_lines || [];
    const totalDebit = Number(document.total_debit || 0);
    const totalCredit = Number(document.total_credit || 0);
    const currency = document.currency || "LKR";

    const cell = (style = {}) => ({
        padding: "8px 12px",
        fontSize: "13px",
        borderBottom: "1px solid #e2e8f0",
        ...style,
    });
    const hd = (style = {}) => ({
        padding: "9px 12px",
        fontSize: "11px",
        fontWeight: "700",
        color: "#475569",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        borderBottom: "2px solid #cbd5e1",
        background: "#f1f5f9",
        ...style,
    });

    return (
        <div>
            {/* Entry metadata */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "12px 16px" }}>
                {[
                    ["Type", document.entry_type],
                    ["Period", document.period],
                    ["Reference Type", document.reference_type],
                    ["Reference ID", document.reference_id],
                ].map(([label, val]) => val ? (
                    <div key={label}>
                        <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "600", letterSpacing: "0.04em" }}>{label}</div>
                        <div style={{ fontSize: "13px", color: "#0f172a", marginTop: "2px", fontWeight: "500", textTransform: "capitalize" }}>{val}</div>
                    </div>
                ) : null)}
            </div>
            {document.description && (
                <div style={{ marginBottom: "16px", fontSize: "13px", color: "#334155" }}>
                    <strong>Description:</strong> {document.description}
                </div>
            )}

            {/* Lines table */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px" }}>
                <thead>
                    <tr>
                        <th style={hd({ width: "36px" })}>#</th>
                        <th style={hd({ width: "120px" })}>Account Code</th>
                        <th style={hd()}>Account Name</th>
                        <th style={hd()}>Description</th>
                        <th style={hd({ textAlign: "right", width: "130px" })}>Debit ({currency})</th>
                        <th style={hd({ textAlign: "right", width: "130px" })}>Credit ({currency})</th>
                    </tr>
                </thead>
                <tbody>
                    {lines.length > 0 ? lines.map((line, idx) => (
                        <tr key={line.id || idx} style={{ background: idx % 2 === 0 ? "#fff" : "#f8fafc" }}>
                            <td style={cell({ color: "#94a3b8" })}>{line.line_number || idx + 1}</td>
                            <td style={cell({ fontFamily: "monospace", color: "#1e40af" })}>{line.account_code}</td>
                            <td style={cell({ fontWeight: "500" })}>{line.account_name}</td>
                            <td style={cell({ color: "#475569" })}>{line.description || "—"}</td>
                            <td style={cell({ textAlign: "right", fontFamily: "monospace", color: line.debit > 0 ? "#0f172a" : "#94a3b8" })}>
                                {fmtAmt(line.debit > 0 ? line.debit : null)}
                            </td>
                            <td style={cell({ textAlign: "right", fontFamily: "monospace", color: line.credit > 0 ? "#0f172a" : "#94a3b8" })}>
                                {fmtAmt(line.credit > 0 ? line.credit : null)}
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={6} style={cell({ textAlign: "center", color: "#94a3b8" })}>No lines available</td>
                        </tr>
                    )}
                </tbody>
                <tfoot>
                    <tr style={{ background: "#f1f5f9" }}>
                        <td colSpan={4} style={{ padding: "10px 12px", fontSize: "13px", fontWeight: "700", color: "#0f172a", borderTop: "2px solid #cbd5e1" }}>
                            Totals
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", fontSize: "14px", fontWeight: "700", color: "#1e40af", borderTop: "2px solid #cbd5e1" }}>
                            {fmtAmt(totalDebit)}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", fontSize: "14px", fontWeight: "700", color: "#1e40af", borderTop: "2px solid #cbd5e1" }}>
                            {fmtAmt(totalCredit)}
                        </td>
                    </tr>
                    {Math.abs(totalDebit - totalCredit) < 0.01 && (
                        <tr>
                            <td colSpan={6} style={{ padding: "6px 12px", fontSize: "11px", textAlign: "right", color: "#059669", fontWeight: "600" }}>
                                ✓ Balanced
                            </td>
                        </tr>
                    )}
                </tfoot>
            </table>

            <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>
                <strong>Status:</strong>{" "}
                <span style={{ textTransform: "uppercase", fontWeight: "600", color: document.status === "posted" ? "#059669" : document.status === "reversed" ? "#dc2626" : "#f59e0b" }}>
                    {document.status}
                </span>
            </div>
        </div>
    );
}

export default function DocumentPrintPreview({
    document,
    documentType,
    onClose,
    language = "en"
}) {
    const printRef = useRef();
    const { currentOrg } = useOrganization();

    const companyInfo = currentOrg ? {
        organization_name: currentOrg.organization_name || currentOrg.company_legal_name || currentOrg.name,
        vat_number: currentOrg.vat_number || currentOrg.vat_registration_number || "",
        cr_number: currentOrg.cr_number || currentOrg.commercial_registration_number || "",
        address: currentOrg.address || "",
        city: currentOrg.city || "",
        country: currentOrg.country || "Saudi Arabia",
        contact_phone: currentOrg.contact_phone || currentOrg.phone || "",
        contact_email: currentOrg.contact_email || currentOrg.email || "",
        logo_url: currentOrg.logo_url || ""
    } : {};

    const isJournalEntry = documentType === 'Journal Entry' || !!document.journal_number;

    const getPrintableData = () => {
        const items = isJournalEntry ? [] :
            document.items ||
            (document.product_name ? [{
                name: document.product_name,
                quantity: document.quantity || 1,
                unit_price: document.unit_price || 0
            }] :
            document.material_name ? [{
                name: `${document.material_name}${document.material_code ? ` (${document.material_code})` : ''}`,
                quantity: document.quantity || document.quantity_required || document.quantity_requested ||
                          document.received_quantity || document.invoiced_quantity || 1,
                unit_price: document.unit_price || 0
            }] :
            document.asset_name ? [{
                name: document.asset_name,
                quantity: 1,
                unit_price: document.acquisition_cost || 0
            }] :
            document.account_name ? [{
                name: `${document.account_code ? document.account_code + ' — ' : ''}${document.account_name}`,
                quantity: 1,
                unit_price: document.debit_amount || document.credit_amount || 0
            }] :
            []);

        const totals = isJournalEntry ? null :
            document.total_amount != null ? {
                subtotal: document.subtotal ?? document.total_amount,
                discount: document.discount_amount || 0,
                vat_amount: document.tax_amount || document.vat_amount || null,
                vat_percent: document.tax_percent || document.vat_percent || 18,
                total: document.total_amount,
                currency: document.currency || "LKR",
                qr_code: document.zatca_qr_code
            } : document.invoice_amount != null ? {
                subtotal: document.invoice_amount,
                total: document.outstanding_amount ?? document.invoice_amount,
                currency: "LKR"
            } : document.amount != null ? {
                total: document.amount,
                currency: "LKR"
            } : document.acquisition_cost != null ? {
                subtotal: document.acquisition_cost,
                total: document.net_book_value ?? document.acquisition_cost,
                currency: "LKR"
            } : null;

        const partyName = document.customer_name || document.vendor_name || document.party_name;
        const customerInfo = partyName ? {
            name: partyName,
            vat_number: document.customer_vat_number || document.vendor_vat_number,
            address: document.billing_address || document.customer_address ||
                     document.delivery_address || document.vendor_address
        } : null;

        return {
            title: documentType,
            documentNumber:
                document.invoice_number || document.quotation_number ||
                document.order_number || document.delivery_number ||
                document.return_number || document.service_order_number ||
                document.pr_number || document.rfq_number || document.po_number ||
                document.grn_number || document.vendor_invoice_number ||
                document.movement_number || document.count_number || document.sto_number ||
                document.journal_number || document.ar_number || document.ap_number ||
                document.payment_number || document.asset_number ||
                document.id,
            documentDate:
                document.entry_date ||
                document.invoice_date || document.quotation_date ||
                document.order_date || document.delivery_date ||
                document.return_date ||
                document.pr_date || document.rfq_date || document.po_date ||
                document.grn_date || document.movement_date || document.count_date ||
                document.sto_date || document.posting_date || document.payment_date ||
                document.acquisition_date || document.date,
            customerInfo,
            items,
            totals,
            footer: isJournalEntry ? null :
                    document.notes || document.purpose || document.description ||
                    document.specifications || "Thank you for your business!"
        };
    };

    const printableData = getPrintableData();

    const handlePrint = () => {
        const content = printRef.current?.innerHTML;
        if (!content) return;

        const win = window.open("", "_blank", "width=900,height=700");
        win.document.write(`<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <title>${documentType} - ${printableData.documentNumber || ""}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    @page { size: A4; margin: 0; }
    @media print {
      body { padding: 0; }
      .print-document { padding: 15mm !important; }
    }
  </style>
</head>
<body>${content}</body>
</html>`);
        win.document.close();
        win.focus();
        setTimeout(() => {
            win.print();
            win.close();
        }, 400);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle>Print Preview — {documentType}</DialogTitle>
                        <div className="flex items-center gap-2">
                            <Button onClick={handlePrint} className="bg-blue-700 hover:bg-blue-800 text-white gap-2">
                                <Printer className="h-4 w-4" />
                                Print / Save PDF
                            </Button>
                            <Button variant="ghost" size="icon" onClick={onClose}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div ref={printRef} className="mt-2 rounded-lg border border-slate-200 overflow-hidden">
                    <PrintableDocument
                        {...printableData}
                        companyInfo={companyInfo}
                        language={language}
                    >
                        {isJournalEntry && (
                            <JournalEntryBody document={document} />
                        )}
                    </PrintableDocument>
                </div>
            </DialogContent>
        </Dialog>
    );
}
