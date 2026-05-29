import React from "react";

export default function PrintableDocument({
    title,
    documentNumber,
    documentDate,
    companyInfo,
    customerInfo,
    items = [],
    totals,
    footer,
    children,
    language = "en"
}) {
    const isRTL = language === "ar";
    const company = companyInfo || {};
    const companyName = company.organization_name || company.company_legal_name || company.name || "HORIZON ERP";
    const companyNameAr = company.organization_name_ar || "";
    const vatNo = company.vat_number || company.vat_registration_number || "";
    const crNo = company.cr_number || company.commercial_registration_number || "";
    const phone = company.phone || company.contact_phone || "";
    const email = company.email || company.contact_email || "";
    const address = [company.address, company.city, company.country].filter(Boolean).join(", ");

    const renderHeader = () => (
        <div style={{ textAlign: "center", marginBottom: "24px", paddingBottom: "16px", borderBottom: "2px solid #059669" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginBottom: "8px" }}>
                {company.logo_url ? (
                    <img src={company.logo_url} alt={companyName} style={{ height: "48px", objectFit: "contain" }} />
                ) : (
                    <div style={{ width: "44px", height: "44px", background: "linear-gradient(135deg,#1d4ed8,#2563eb)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ color: "#fff", fontSize: "18px", fontWeight: "700" }}>{companyName.charAt(0)}</span>
                    </div>
                )}
                <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: "22px", fontWeight: "700", color: "#0f172a" }}>{companyName}</div>
                    {companyNameAr && <div style={{ fontSize: "14px", color: "#475569", direction: "rtl" }}>{companyNameAr}</div>}
                </div>
            </div>
            <div style={{ fontSize: "12px", color: "#64748b", lineHeight: "1.8" }}>
                {address && <div>{address}</div>}
                {(phone || email) && <div>{[phone, email].filter(Boolean).join(" | ")}</div>}
                {(vatNo || crNo) && (
                    <div>
                        {vatNo && <span>VAT: {vatNo}</span>}
                        {vatNo && crNo && " | "}
                        {crNo && <span>CR: {crNo}</span>}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="print-document bg-white p-8" dir={isRTL ? "rtl" : "ltr"}>
            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    .print-document, .print-document * { visibility: visible !important; }
                    .print-document {
                        position: fixed !important;
                        inset: 0 !important;
                        margin: 0 !important;
                        padding: 15mm !important;
                        box-shadow: none !important;
                    }
                    @page { size: A4; margin: 0; }
                }
            `}</style>

            {renderHeader()}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #e2e8f0", paddingBottom: "16px", marginBottom: "20px" }}>
                <div />
                <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "20px", fontWeight: "700", color: "#059669" }}>{title}</div>
                    <div style={{ fontSize: "16px", fontWeight: "600", color: "#334155", marginTop: "4px" }}>{documentNumber}</div>
                    <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                        {isRTL ? "التاريخ" : "Date"}: {documentDate}
                    </div>
                </div>
            </div>

            {customerInfo && (
                <div style={{ background: "#f8fafc", borderRadius: "6px", padding: "14px 16px", marginBottom: "20px", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                        {isRTL ? "بيانات العميل" : "Bill To"}
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: "600", color: "#0f172a" }}>{customerInfo.name}</div>
                    {customerInfo.vat_number && (
                        <div style={{ fontSize: "13px", color: "#475569", marginTop: "2px" }}>
                            VAT: {customerInfo.vat_number}
                        </div>
                    )}
                    {customerInfo.address && (
                        <div style={{ fontSize: "13px", color: "#475569", marginTop: "2px" }}>{customerInfo.address}</div>
                    )}
                </div>
            )}

            {items.length > 0 && (
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
                    <thead>
                        <tr style={{ background: "#f1f5f9" }}>
                            <th style={{ padding: "10px 12px", textAlign: "left", fontSize: "12px", fontWeight: "700", color: "#475569", borderBottom: "2px solid #cbd5e1" }}>
                                {isRTL ? "م" : "#"}
                            </th>
                            <th style={{ padding: "10px 12px", textAlign: "left", fontSize: "12px", fontWeight: "700", color: "#475569", borderBottom: "2px solid #cbd5e1" }}>
                                {isRTL ? "الصنف / الخدمة" : "Item / Description"}
                            </th>
                            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: "12px", fontWeight: "700", color: "#475569", borderBottom: "2px solid #cbd5e1" }}>
                                {isRTL ? "الكمية" : "Qty"}
                            </th>
                            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: "12px", fontWeight: "700", color: "#475569", borderBottom: "2px solid #cbd5e1" }}>
                                {isRTL ? "سعر الوحدة" : "Unit Price"}
                            </th>
                            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: "12px", fontWeight: "700", color: "#475569", borderBottom: "2px solid #cbd5e1" }}>
                                {isRTL ? "الإجمالي" : "Total"}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                                <td style={{ padding: "10px 12px", fontSize: "13px", color: "#475569" }}>{idx + 1}</td>
                                <td style={{ padding: "10px 12px", fontSize: "13px", color: "#0f172a" }}>{item.name || item.product_name || item.description}</td>
                                <td style={{ padding: "10px 12px", fontSize: "13px", textAlign: "right" }}>{Number(item.quantity).toLocaleString()}</td>
                                <td style={{ padding: "10px 12px", fontSize: "13px", textAlign: "right" }}>
                                    {Number(item.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td style={{ padding: "10px 12px", fontSize: "13px", textAlign: "right", fontWeight: "600" }}>
                                    {(Number(item.quantity) * Number(item.unit_price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {children}

            {totals && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                    <div style={{ width: "260px" }}>
                        {totals.subtotal != null && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "5px 0", color: "#475569" }}>
                                <span>{isRTL ? "المجموع الفرعي" : "Subtotal"}</span>
                                <span>{totals.currency || "SAR"} {Number(totals.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        )}
                        {totals.discount > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "5px 0", color: "#dc2626" }}>
                                <span>{isRTL ? "الخصم" : "Discount"}</span>
                                <span>- {totals.currency || "SAR"} {Number(totals.discount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        )}
                        {totals.vat_amount != null && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "5px 0", color: "#475569" }}>
                                <span>{isRTL ? "ضريبة القيمة المضافة" : "VAT"} ({totals.vat_percent || 15}%)</span>
                                <span>{totals.currency || "SAR"} {Number(totals.vat_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px", fontWeight: "700", borderTop: "2px solid #0f172a", paddingTop: "8px", marginTop: "6px", color: "#0f172a" }}>
                            <span>{isRTL ? "الإجمالي" : "Total"}</span>
                            <span style={{ color: "#059669" }}>
                                {totals.currency || "SAR"} {Number(totals.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {footer && (
                <div style={{ marginTop: "32px", paddingTop: "16px", borderTop: "1px solid #e2e8f0", fontSize: "12px", color: "#64748b" }}>
                    {footer}
                </div>
            )}

            <div style={{ marginTop: "48px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px" }}>
                <div style={{ borderTop: "1px solid #94a3b8", paddingTop: "6px", textAlign: "center", fontSize: "12px", color: "#64748b" }}>
                    {isRTL ? "توقيع المصدر" : "Authorized Signature"}
                </div>
                <div style={{ borderTop: "1px solid #94a3b8", paddingTop: "6px", textAlign: "center", fontSize: "12px", color: "#64748b" }}>
                    {isRTL ? "توقيع المستلم" : "Received By"}
                </div>
            </div>

            {totals?.qr_code && (
                <div style={{ marginTop: "24px", display: "flex", justifyContent: "center" }}>
                    <div style={{ border: "1px solid #e2e8f0", padding: "12px", textAlign: "center", borderRadius: "6px" }}>
                        <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "6px" }}>ZATCA QR Code</div>
                        <div style={{ width: "96px", height: "96px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ fontSize: "10px", color: "#94a3b8" }}>QR</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
