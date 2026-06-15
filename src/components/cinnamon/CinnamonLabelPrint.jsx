import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Download, Tag } from "lucide-react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";

const LABEL_PRESETS = [
    { label: "100×50mm (Thermal)", value: "100x50mm", w: "100mm", h: "50mm" },
    { label: '4"×2" (Standard)',   value: "4x2in",    w: "4in",   h: "2in"  },
    { label: '3"×2" (Compact)',    value: "3x2in",    w: "3in",   h: "2in"  },
    { label: "Custom",             value: "custom",   w: "",      h: ""     },
];

export default function CinnamonLabelPrint({ packages, onClose }) {
    const packagesArray = Array.isArray(packages) ? packages : [packages];

    const [opts, setOpts] = useState({
        shelfLifeMonths: 24,
        countryOfOrigin: "Sri Lanka",
        labelPreset: "100x50mm",
        customWidth: "100mm",
        customHeight: "50mm",
        copies: 1,
        showQR: true,
        showBarcode: true,
        showLogo: true,
    });
    const [qrDataUrls, setQrDataUrls] = useState({});

    const set = (key, val) => setOpts((prev) => ({ ...prev, [key]: val }));

    const { data: orgs = [] } = useQuery({
        queryKey: ["organizations"],
        queryFn: () => matrixSales.entities.Organization.list(),
        select: (d) => (Array.isArray(d) ? d : []),
    });
    const org = orgs[0] || {};

    const { data: batches = [] } = useQuery({
        queryKey: ["cinnamonBatches"],
        queryFn: () => matrixSales.entities.CinnamonBatch.list(),
        select: (d) => (Array.isArray(d) ? d : []),
    });

    useEffect(() => {
        if (!packagesArray.length) return;
        (async () => {
            const urls = {};
            for (const pkg of packagesArray) {
                const batch = batches.find((b) => b.batch_number === pkg.batch_number) || {};
                const payload = JSON.stringify({
                    packaging_no: pkg.packaging_number,
                    batch: pkg.batch_number,
                    grade: pkg.grade_code,
                    sku: pkg.finished_sku,
                    pack_size: pkg.pack_size,
                    qty_packs: pkg.qty_packs,
                    packed: (pkg.created_at || "").slice(0, 10),
                    origin: batch.origin || opts.countryOfOrigin,
                });
                try {
                    urls[pkg.packaging_number] = await QRCode.toDataURL(payload, {
                        errorCorrectionLevel: "M",
                        width: 120,
                        margin: 1,
                    });
                } catch {
                    urls[pkg.packaging_number] = "";
                }
            }
            setQrDataUrls(urls);
        })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [packagesArray.length, batches.length]);

    const getLabelDims = () => {
        if (opts.labelPreset === "custom") {
            return { w: opts.customWidth || "100mm", h: opts.customHeight || "50mm" };
        }
        const p = LABEL_PRESETS.find((x) => x.value === opts.labelPreset);
        return { w: p?.w || "100mm", h: p?.h || "50mm" };
    };

    const getBBD = (createdAt) => {
        const d = new Date(createdAt || Date.now());
        d.setMonth(d.getMonth() + Math.max(1, parseInt(opts.shelfLifeMonths) || 24));
        return d.toISOString().slice(0, 10);
    };

    const buildLabelHtml = (pkg, idx) => {
        const batch = batches.find((b) => b.batch_number === pkg.batch_number) || {};
        const packDate = (pkg.created_at || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
        const bbd = getBBD(pkg.created_at);
        const qrSrc = qrDataUrls[pkg.packaging_number] || "";
        const orgName = org.organization_name || org.name || "Spice360 Ltd";
        const logoSrc = opts.showLogo && org.logo_url ? org.logo_url : "";
        const sku = pkg.finished_sku || `${pkg.grade_code}-${pkg.pack_size}`;
        const bcId = `bc${idx}`;

        return `
<div class="label">
  <div class="header">
    ${logoSrc
        ? `<img src="${logoSrc}" class="logo" alt="logo" />`
        : `<span class="leaf">&#127807;</span>`}
    <div class="brand">
      <div class="brand-name">CEYLON CINNAMON</div>
      <div class="brand-grade">Grade: ${pkg.grade_code}</div>
    </div>
    ${opts.showQR && qrSrc ? `<img src="${qrSrc}" class="qr" alt="QR" />` : ""}
  </div>
  <div class="info-grid">
    <div class="info-cell"><span class="lbl">SKU</span> <strong>${sku}</strong></div>
    <div class="info-cell"><span class="lbl">Net Wt</span> <strong>${pkg.pack_size}</strong></div>
    <div class="info-cell"><span class="lbl">Batch</span> ${pkg.batch_number}</div>
    <div class="info-cell"><span class="lbl">Qty</span> ${pkg.qty_packs} packs</div>
    <div class="info-cell"><span class="lbl">Packed</span> ${packDate}</div>
    <div class="info-cell"><span class="lbl">BBD</span> <strong>${bbd}</strong></div>
  </div>
  ${opts.showBarcode ? `<div class="bc-wrap"><svg id="${bcId}" data-bc="${sku}"></svg></div>` : ""}
  <div class="footer">
    <span>Product of ${batch.origin || opts.countryOfOrigin}</span>
    <span>${orgName}</span>
  </div>
</div>`;
    };

    const buildPrintHtml = () => {
        const { w, h } = getLabelDims();
        const copies = Math.max(1, parseInt(opts.copies) || 1);
        const singleSet = packagesArray.map((pkg, i) => buildLabelHtml(pkg, i));
        const allLabels = Array.from({ length: copies }, () => singleSet).flat().join("\n");

        return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Cinnamon Labels</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js" onload="initBc()"></script>
  <style>
    @page { size: ${w} ${h}; margin: 0; }
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    .label {
      width: ${w}; height: ${h};
      border: 0.3mm solid #000;
      padding: 2.5mm;
      display: flex; flex-direction: column; justify-content: space-between;
      page-break-after: always;
    }
    .header { display: flex; align-items: center; gap: 2mm; border-bottom: 0.3mm solid #444; padding-bottom: 1.5mm; margin-bottom: 1.5mm; }
    .logo { height: 8mm; width: auto; object-fit: contain; }
    .leaf { font-size: 12pt; }
    .brand { flex: 1; text-align: center; }
    .brand-name { font-size: 9pt; font-weight: 900; color: #1a6b3a; letter-spacing: 0.5px; }
    .brand-grade { font-size: 6.5pt; color: #555; }
    .qr { height: 13mm; width: 13mm; object-fit: contain; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4mm 2mm; font-size: 7pt; flex: 1; }
    .info-cell { display: flex; gap: 1mm; align-items: baseline; white-space: nowrap; }
    .lbl { color: #888; }
    .bc-wrap { text-align: center; }
    .bc-wrap svg { max-width: 100%; height: 14mm; }
    .footer { display: flex; justify-content: space-between; font-size: 6pt; color: #666; border-top: 0.3mm solid #ccc; padding-top: 1mm; margin-top: 0.5mm; }
  </style>
</head>
<body>
  ${allLabels}
  <script>
    function initBc() {
      document.querySelectorAll('svg[data-bc]').forEach(function(svg) {
        try {
          JsBarcode(svg, svg.getAttribute('data-bc'), {
            format: 'CODE128', width: 1.2, height: 18,
            displayValue: true, fontSize: 7, margin: 1, lineColor: '#000'
          });
        } catch(e) {}
      });
      setTimeout(function() { window.print(); }, 800);
    }
  </script>
</body>
</html>`;
    };

    const handlePrint = () => {
        const pw = window.open("", "_blank");
        if (!pw) return;
        pw.document.write(buildPrintHtml());
        pw.document.close();
    };

    const handleDownload = () => {
        const html = buildPrintHtml();
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const sku = packagesArray[0]?.finished_sku || "label";
        a.download = `cinnamon-labels-${sku}-${Date.now()}.html`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const firstPkg = packagesArray[0] || {};
    const previewBbd = getBBD(firstPkg.created_at);
    const previewQr = qrDataUrls[firstPkg.packaging_number];

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Tag className="w-5 h-5 text-emerald-600" />
                        Print Cinnamon Labels
                        {packagesArray.length > 1 && (
                            <span className="text-sm font-normal text-gray-500">
                                ({packagesArray.length} labels)
                            </span>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-[1fr_220px] gap-6">
                    {/* ─── Options ─── */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Shelf Life (months)</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="120"
                                    value={opts.shelfLifeMonths}
                                    onChange={(e) => set("shelfLifeMonths", e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Copies</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="999"
                                    value={opts.copies}
                                    onChange={(e) => set("copies", e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                        </div>

                        <div>
                            <Label>Country of Origin</Label>
                            <Input
                                value={opts.countryOfOrigin}
                                onChange={(e) => set("countryOfOrigin", e.target.value)}
                                placeholder="e.g. Sri Lanka"
                                className="mt-1"
                            />
                        </div>

                        <div>
                            <Label>Label Size</Label>
                            <Select value={opts.labelPreset} onValueChange={(v) => set("labelPreset", v)}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {LABEL_PRESETS.map((p) => (
                                        <SelectItem key={p.value} value={p.value}>
                                            {p.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {opts.labelPreset === "custom" && (
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <div>
                                        <Label className="text-xs text-gray-500">Width</Label>
                                        <Input
                                            value={opts.customWidth}
                                            onChange={(e) => set("customWidth", e.target.value)}
                                            placeholder="100mm"
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-500">Height</Label>
                                        <Input
                                            value={opts.customHeight}
                                            onChange={(e) => set("customHeight", e.target.value)}
                                            placeholder="50mm"
                                            className="mt-1"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-3 pt-2 border-t">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="sw-qr" className="cursor-pointer">Include QR Code</Label>
                                <Switch
                                    id="sw-qr"
                                    checked={opts.showQR}
                                    onCheckedChange={(v) => set("showQR", v)}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="sw-bc" className="cursor-pointer">Include Barcode (Code128)</Label>
                                <Switch
                                    id="sw-bc"
                                    checked={opts.showBarcode}
                                    onCheckedChange={(v) => set("showBarcode", v)}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="sw-logo" className="cursor-pointer">Include Company Logo</Label>
                                <Switch
                                    id="sw-logo"
                                    checked={opts.showLogo}
                                    onCheckedChange={(v) => set("showLogo", v)}
                                />
                            </div>
                        </div>

                        {packagesArray.length > 1 && (
                            <div>
                                <Label className="text-sm font-semibold">
                                    Selected Packages ({packagesArray.length})
                                </Label>
                                <div className="mt-1 max-h-32 overflow-y-auto border rounded p-2 bg-gray-50 space-y-1">
                                    {packagesArray.map((pkg, i) => (
                                        <div key={i} className="text-xs flex gap-2 items-center">
                                            <span className="font-mono text-gray-400">{pkg.packaging_number}</span>
                                            <span className="font-medium">{pkg.finished_sku}</span>
                                            <span className="text-gray-400">×{pkg.qty_packs} packs</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ─── Preview ─── */}
                    <div>
                        <Label className="text-sm font-semibold block mb-2">Preview</Label>
                        <div className="border-2 border-dashed border-gray-200 rounded bg-gray-50 p-2">
                            {packagesArray.length === 1 ? (
                                <div
                                    className="border border-gray-400 bg-white p-2"
                                    style={{ fontSize: "8px", fontFamily: "Arial, sans-serif", lineHeight: 1.4 }}
                                >
                                    {/* Header */}
                                    <div
                                        className="flex justify-between items-start pb-1 mb-1"
                                        style={{ borderBottom: "0.5px solid #444" }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 900, color: "#1a6b3a", fontSize: "9px" }}>
                                                CEYLON CINNAMON
                                            </div>
                                            <div style={{ color: "#555" }}>Grade: {firstPkg.grade_code}</div>
                                        </div>
                                        {opts.showQR && previewQr && (
                                            <img
                                                src={previewQr}
                                                alt="QR"
                                                style={{ width: "32px", height: "32px" }}
                                            />
                                        )}
                                    </div>
                                    {/* Info */}
                                    <div
                                        className="grid gap-x-2 mb-1"
                                        style={{ gridTemplateColumns: "1fr 1fr" }}
                                    >
                                        <div>
                                            <span style={{ color: "#888" }}>SKU </span>
                                            <strong>{firstPkg.finished_sku}</strong>
                                        </div>
                                        <div>
                                            <span style={{ color: "#888" }}>Wt </span>
                                            {firstPkg.pack_size}
                                        </div>
                                        <div>
                                            <span style={{ color: "#888" }}>Batch </span>
                                            {(firstPkg.batch_number || "").slice(0, 14)}
                                        </div>
                                        <div>
                                            <span style={{ color: "#888" }}>Qty </span>
                                            {firstPkg.qty_packs}
                                        </div>
                                        <div>
                                            <span style={{ color: "#888" }}>BBD </span>
                                            <strong>{previewBbd}</strong>
                                        </div>
                                    </div>
                                    {/* Barcode placeholder */}
                                    {opts.showBarcode && (
                                        <div
                                            className="text-center pt-1"
                                            style={{
                                                borderTop: "0.5px solid #ccc",
                                                fontFamily: "monospace",
                                                fontSize: "11px",
                                                letterSpacing: "1px",
                                            }}
                                        >
                                            <div>&#x2590;&#x2588;&#x258c;&#x2588;&#x2590;&#x2588;&#x258c;&#x2588;&#x2590;&#x2588;</div>
                                            <div style={{ fontSize: "7px", letterSpacing: 0 }}>
                                                {firstPkg.finished_sku}
                                            </div>
                                        </div>
                                    )}
                                    {/* Footer */}
                                    <div
                                        className="flex justify-between pt-1 mt-1"
                                        style={{
                                            borderTop: "0.5px solid #ccc",
                                            fontSize: "7px",
                                            color: "#666",
                                        }}
                                    >
                                        <span>Product of {opts.countryOfOrigin}</span>
                                        <span>{org.organization_name || "Spice360 Ltd"}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-gray-500 text-sm py-6">
                                    {packagesArray.length} labels ready
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1 text-center">
                            Real barcode rendered on print
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="outline" onClick={handleDownload} className="gap-2">
                        <Download className="w-4 h-4" />
                        Download HTML
                    </Button>
                    <Button
                        onClick={handlePrint}
                        className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                    >
                        <Printer className="w-4 h-4" />
                        {packagesArray.length > 1
                            ? `Print ${packagesArray.length} Labels`
                            : "Print Label"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
