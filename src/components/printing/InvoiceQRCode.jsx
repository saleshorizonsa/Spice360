import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function InvoiceQRCode({ payload = "", label }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    if (!payload) {
      setQrDataUrl("");
      setError("QR payload is missing.");
      return () => {
        active = false;
      };
    }

    QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 180,
      color: {
        dark: "#020617",
        light: "#ffffff"
      }
    })
      .then((dataUrl) => {
        if (!active) return;
        setQrDataUrl(dataUrl);
        setError("");
      })
      .catch((generationError) => {
        if (!active) return;
        setQrDataUrl("");
        setError(generationError.message || "Unable to generate QR code.");
      });

    return () => {
      active = false;
    };
  }, [payload]);

  return (
    <div className="inline-flex flex-col items-center gap-2 rounded-md border border-slate-300 bg-white p-3">
      {label && <p className="text-[10px] font-medium text-slate-600">{label}</p>}
      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt="ZATCA QR code"
          className="h-36 w-36"
          title={payload}
        />
      ) : (
        <div className="flex h-36 w-36 items-center justify-center border border-dashed border-slate-300 p-3 text-center text-xs text-slate-500">
          {error || "Generating QR..."}
        </div>
      )}
    </div>
  );
}
