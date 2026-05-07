import React from "react";

const hashText = (value = "") => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

export default function InvoiceQRCode({ payload = "", label }) {
  const seed = hashText(payload);
  const cells = Array.from({ length: 21 * 21 }, (_, index) => {
    const row = Math.floor(index / 21);
    const col = index % 21;
    const finder =
      (row < 7 && col < 7) ||
      (row < 7 && col > 13) ||
      (row > 13 && col < 7);
    if (finder) {
      const localRow = row < 7 ? row : row - 14;
      const localCol = col < 7 ? col : col - 14;
      return (
        localRow === 0 ||
        localRow === 6 ||
        localCol === 0 ||
        localCol === 6 ||
        (localRow >= 2 && localRow <= 4 && localCol >= 2 && localCol <= 4)
      );
    }
    return ((seed + row * 17 + col * 31 + row * col) % 5) < 2;
  });

  return (
    <div className="inline-flex flex-col items-center gap-2 rounded-md border border-slate-300 bg-white p-3">
      {label && <p className="text-[10px] font-medium text-slate-600">{label}</p>}
      <div
        className="grid h-32 w-32 bg-white"
        style={{ gridTemplateColumns: "repeat(21, minmax(0, 1fr))" }}
        aria-label="ZATCA QR code"
        title={payload}
      >
        {cells.map((filled, index) => (
          <span key={index} className={filled ? "bg-slate-950" : "bg-white"} />
        ))}
      </div>
    </div>
  );
}

