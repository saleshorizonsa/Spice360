import React, { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Printer, Download } from "lucide-react";
import PrintableDocument from "./PrintableDocument";
import { useOrganization } from "@/components/utils/OrganizationContext";

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
        organization_name_ar: currentOrg.organization_name_ar || "",
        vat_number: currentOrg.vat_number || currentOrg.vat_registration_number || "",
        cr_number: currentOrg.cr_number || currentOrg.commercial_registration_number || "",
        address: currentOrg.address || "",
        city: currentOrg.city || "",
        country: currentOrg.country || "Saudi Arabia",
        contact_phone: currentOrg.contact_phone || currentOrg.phone || "",
        contact_email: currentOrg.contact_email || currentOrg.email || "",
        logo_url: currentOrg.logo_url || ""
    } : {};

    const getPrintableData = () => {
        const items = document.items || (document.product_name ? [{
            name: document.product_name,
            quantity: document.quantity || 1,
            unit_price: document.unit_price || 0
        }] : []);

        const totals = document.total_amount != null ? {
            subtotal: document.subtotal ?? document.total_amount,
            discount: document.discount_amount || 0,
            vat_amount: document.tax_amount || document.vat_amount || null,
            vat_percent: document.tax_percent || document.vat_percent || 15,
            total: document.total_amount,
            currency: document.currency || "SAR",
            qr_code: document.zatca_qr_code
        } : null;

        const customerInfo = document.customer_name ? {
            name: document.customer_name,
            vat_number: document.customer_vat_number,
            address: document.billing_address || document.customer_address || document.delivery_address
        } : null;

        return {
            title: documentType,
            documentNumber:
                document.invoice_number || document.quotation_number ||
                document.order_number || document.delivery_number ||
                document.return_number || document.service_order_number || document.id,
            documentDate:
                document.invoice_date || document.quotation_date ||
                document.order_date || document.delivery_date ||
                document.return_date || document.date,
            customerInfo,
            items,
            totals,
            footer: document.notes || "Thank you for your business!"
        };
    };

    const printableData = getPrintableData();

    const handlePrint = () => {
        const content = printRef.current?.innerHTML;
        if (!content) return;

        const win = window.open("", "_blank", "width=900,height=700");
        win.document.write(`<!DOCTYPE html>
<html lang="${language}" dir="${language === "ar" ? "rtl" : "ltr"}">
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
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
