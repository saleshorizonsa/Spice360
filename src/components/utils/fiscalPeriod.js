// April-March fiscal year helpers.
// Period 1 = April, Period 2 = May, … Period 12 = March.
// Special periods 13-16 are year-end adjustment slots (no calendar date).

export const FISCAL_AREAS = [
    { key: "gl",        label: "G/L — General Ledger" },
    { key: "ar",        label: "AR — Accounts Receivable" },
    { key: "ap",        label: "AP — Accounts Payable" },
    { key: "inventory", label: "Inventory" },
    { key: "assets",    label: "Fixed Assets" },
];

const PERIOD_MONTH_NAMES = [
    "Apr", "May", "Jun", "Jul", "Aug", "Sep",
    "Oct", "Nov", "Dec", "Jan", "Feb", "Mar",
];

// Convert a calendar date string (YYYY-MM-DD or YYYY-MM) to fiscal period info.
export function dateToFiscalPeriod(dateStr) {
    const s = String(dateStr || "").slice(0, 10);
    const month = parseInt(s.slice(5, 7), 10); // 1-12
    const year  = parseInt(s.slice(0, 4), 10);
    // April (4) = period 1; March (3) = period 12 of prior fiscal year
    const period   = month >= 4 ? month - 3 : month + 9;
    const fyStart  = month >= 4 ? year : year - 1;
    const fiscalYear = `${fyStart}-${String(fyStart + 1).slice(-2)}`;
    return { year: fiscalYear, period, fyStart };
}

// Human-readable label for a fiscal period number (1-16).
export function fiscalPeriodLabel(period) {
    if (period >= 13) return `Special ${period}`;
    return PERIOD_MONTH_NAMES[period - 1] ?? `Period ${period}`;
}

// Get the current fiscal year string (e.g. "2025-26").
export function currentFiscalYear() {
    return dateToFiscalPeriod(new Date().toISOString().slice(0, 10)).year;
}

// Start/end calendar dates for a given fiscal period within a fiscal year.
// Returns null for special periods 13-16 (no calendar mapping).
export function fiscalPeriodDateRange(fiscalYear, period) {
    if (period >= 13) return null;
    const fyStart   = parseInt(fiscalYear.split("-")[0], 10);
    // period 1 = April of fyStart; period 9 = December of fyStart; period 10 = January of fyStart+1
    const calMonth  = period <= 9 ? period + 3 : period - 9;
    const calYear   = period <= 9 ? fyStart : fyStart + 1;
    const start = new Date(Date.UTC(calYear, calMonth - 1, 1));
    const end   = new Date(Date.UTC(calYear, calMonth, 0));
    return {
        start: start.toISOString().slice(0, 10),
        end:   end.toISOString().slice(0, 10),
    };
}

// Options array for period number selects (1-16).
export function periodSelectOptions(includeSpecial = true) {
    const opts = [];
    for (let i = 1; i <= 12; i++) {
        opts.push({ value: i, label: `${i} — ${PERIOD_MONTH_NAMES[i - 1]}` });
    }
    if (includeSpecial) {
        for (let i = 13; i <= 16; i++) {
            opts.push({ value: i, label: `${i} — Special ${i}` });
        }
    }
    return opts;
}

// Generate a list of fiscal year strings, e.g. last 3 + next 1 from a base year.
export function fiscalYearOptions(centreYear) {
    const fy = centreYear ?? new Date().getUTCFullYear();
    const years = [];
    for (let y = fy - 2; y <= fy + 1; y++) {
        years.push(`${y}-${String(y + 1).slice(-2)}`);
    }
    return years;
}
