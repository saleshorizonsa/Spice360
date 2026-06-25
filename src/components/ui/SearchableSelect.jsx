import React, { useState, useRef, useEffect, useMemo } from "react";
import { Check, ChevronDown, X, Loader2, Plus } from "lucide-react";
import {
    Command, CommandEmpty, CommandGroup,
    CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";

/**
 * SearchableSelect — drop-in replacement for shadcn/ui Select.
 *
 * CLIENT mode (default):  filter a provided `options` array in-browser.
 * ASYNC  mode:            debounced (~300 ms) server search via `fetchOptions(query)`.
 *
 * Options shape:  { value: string, label: string, group?: string }
 *   group  — optional; items sharing the same group string are nested under a
 *            bold header in the list (e.g. all accounts under "Cash & Bank").
 *
 * Props
 * ─────
 * value            string                current selected value
 * onChange         (value) => void       change callback (alias: onValueChange)
 * options          Option[]              CLIENT mode list
 * fetchOptions     async (q) => Option[] ASYNC mode fetch
 * mode             "client" | "async"    default "client"
 * placeholder      string
 * searchPlaceholder string
 * displayLabel     string               label to show in trigger for current value
 *                                       (needed for async mode when options are empty)
 * label            string               optional form label rendered above trigger
 * disabled         boolean
 * clearable        boolean              show × to clear selection
 * className        string               extra classes on the trigger button
 * emptyText        string               no-results message
 * showCreateOption boolean
 * onCreateOption   (query) => void
 * createOptionLabel string
 *
 * Backward-compat aliases accepted:
 *   onValueChange, emptyMessage, noResultsMessage
 */
export default function SearchableSelect({
    value = "",
    onChange,
    onValueChange,
    options = [],
    fetchOptions,
    mode = "client",
    placeholder = "Select…",
    searchPlaceholder = "Search…",
    displayLabel,
    label,
    disabled = false,
    clearable = false,
    className = "",
    emptyText,
    emptyMessage,
    noResultsMessage,
    showCreateOption = false,
    onCreateOption,
    createOptionLabel = "Create new",
}) {
    const handleChange = onChange || onValueChange || (() => {});
    const emptyMsg = emptyText || noResultsMessage || emptyMessage || "No results found.";

    const [open, setOpen]               = useState(false);
    const [query, setQuery]             = useState("");
    const [asyncOpts, setAsyncOpts]     = useState([]);
    const [loading, setLoading]         = useState(false);
    const [dropStyle, setDropStyle]     = useState({});

    const triggerRef  = useRef(null);
    const debounceRef = useRef(null);

    // ── position the fixed dropdown below the trigger ──────────────────
    useEffect(() => {
        if (!open) return;
        const reposition = () => {
            const el = triggerRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            const spaceBelow = window.innerHeight - r.bottom - 8;
            setDropStyle({
                top:       r.bottom + 4,
                left:      r.left,
                width:     r.width,
                maxHeight: Math.max(120, Math.min(340, spaceBelow)),
            });
        };
        reposition();
        window.addEventListener("scroll", reposition, true);
        window.addEventListener("resize", reposition);
        return () => {
            window.removeEventListener("scroll", reposition, true);
            window.removeEventListener("resize", reposition);
        };
    }, [open]);

    // ── ASYNC: initial load on open + debounced refetch on query ───────
    useEffect(() => {
        if (mode !== "async" || !fetchOptions || !open) return;
        clearTimeout(debounceRef.current);
        setLoading(true);
        debounceRef.current = setTimeout(async () => {
            try {
                const res = await fetchOptions(query);
                setAsyncOpts(Array.isArray(res) ? res : []);
            } catch (_) {
                setAsyncOpts([]);
            } finally {
                setLoading(false);
            }
        }, query ? 300 : 0);
        return () => clearTimeout(debounceRef.current);
    }, [open, query, mode, fetchOptions]);

    // ── build filtered + grouped list ──────────────────────────────────
    const groups = useMemo(() => {
        const src = mode === "async" ? asyncOpts : options;
        const q   = query.trim().toLowerCase();
        const filtered = q
            ? src.filter(o =>
                o.label.toLowerCase().includes(q) ||
                String(o.value).toLowerCase().includes(q)
              )
            : src;

        const map = {};
        const bare = [];
        for (const opt of filtered) {
            if (opt.group) {
                (map[opt.group] = map[opt.group] || []).push(opt);
            } else {
                bare.push(opt);
            }
        }
        const result = Object.entries(map).map(([g, items]) => ({ label: g, items }));
        if (bare.length) result.push({ label: null, items: bare });
        return result;
    }, [options, asyncOpts, query, mode]);

    const totalMatches = groups.reduce((n, g) => n + g.items.length, 0);

    // label to show in closed trigger
    const triggerLabel = useMemo(() => {
        if (!value) return null;
        if (displayLabel) return displayLabel;
        const src = mode === "async" ? asyncOpts : options;
        return src.find(o => o.value === value)?.label ?? value;
    }, [value, displayLabel, options, asyncOpts, mode]);

    const close   = ()  => { setOpen(false); setQuery(""); };
    const pick    = (v) => { handleChange(v); close(); };
    const onClear = (e) => { e.stopPropagation(); handleChange(""); };

    return (
        <div className="relative w-full">
            {label && (
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    {label}
                </label>
            )}

            {/* ── Trigger ── */}
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                onClick={() => { if (!disabled) setOpen(o => !o); }}
                aria-expanded={open}
                aria-haspopup="listbox"
                className={[
                    "flex h-10 w-full items-center justify-between",
                    "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
                    "ring-offset-background transition-colors",
                    "hover:border-gray-400",
                    "focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    !triggerLabel && "text-gray-400",
                    className,
                ].filter(Boolean).join(" ")}
            >
                <span className="truncate">
                    {triggerLabel ?? placeholder}
                </span>
                <span className="ml-2 flex shrink-0 items-center gap-1">
                    {clearable && value && (
                        <span
                            role="button"
                            tabIndex={-1}
                            onClick={onClear}
                            className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            aria-label="Clear selection"
                        >
                            <X className="h-3.5 w-3.5" />
                        </span>
                    )}
                    <ChevronDown
                        className={`h-4 w-4 text-gray-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
                    />
                </span>
            </button>

            {open && (
                <>
                    {/* backdrop — closes on outside click */}
                    <div
                        className="fixed inset-0"
                        style={{ zIndex: 9998 }}
                        onClick={close}
                    />

                    {/* ── Dropdown ── */}
                    <div
                        style={{ ...dropStyle, position: "fixed", zIndex: 9999 }}
                        className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg"
                    >
                        <Command>
                            <CommandInput
                                placeholder={searchPlaceholder}
                                value={query}
                                onInput={e => setQuery(e.target.value)}
                                autoFocus
                            />

                            <CommandList
                                style={{ maxHeight: (dropStyle.maxHeight || 340) - 52 }}
                            >
                                {loading ? (
                                    <div className="flex items-center justify-center py-6 text-sm text-gray-400">
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Searching…
                                    </div>
                                ) : totalMatches === 0 ? (
                                    <CommandEmpty>
                                        <div className="space-y-2 py-1">
                                            <p className="text-sm text-slate-500">{emptyMsg}</p>
                                            {showCreateOption && onCreateOption && (
                                                <button
                                                    type="button"
                                                    className="mx-auto flex items-center gap-1 rounded px-2 py-1 text-sm text-emerald-700 hover:bg-emerald-50"
                                                    onClick={() => { onCreateOption(query); close(); }}
                                                >
                                                    <Plus className="h-4 w-4" />
                                                    {createOptionLabel}
                                                </button>
                                            )}
                                        </div>
                                    </CommandEmpty>
                                ) : (
                                    <>
                                        {groups.map((group, gi) =>
                                            group.items.length === 0 ? null : (
                                                <CommandGroup key={group.label ?? `__ug_${gi}`}>
                                                    {group.label && (
                                                        <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                                            {group.label}
                                                        </div>
                                                    )}
                                                    {group.items.map(opt => (
                                                        <CommandItem
                                                            key={opt.value}
                                                            onSelect={() => pick(opt.value)}
                                                            className={value === opt.value ? "bg-slate-50 font-medium" : ""}
                                                        >
                                                            <Check
                                                                className={`mr-2 h-4 w-4 shrink-0 ${
                                                                    value === opt.value
                                                                        ? "text-slate-700 opacity-100"
                                                                        : "opacity-0"
                                                                }`}
                                                            />
                                                            {opt.label}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            )
                                        )}
                                        {showCreateOption && onCreateOption && (
                                            <CommandGroup>
                                                <CommandItem
                                                    onSelect={() => { onCreateOption(query); close(); }}
                                                    className="text-emerald-700"
                                                >
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    {createOptionLabel}
                                                </CommandItem>
                                            </CommandGroup>
                                        )}
                                    </>
                                )}
                            </CommandList>

                            {/* result count footer — only when list is long */}
                            {totalMatches > 6 && (
                                <div className="border-t px-3 py-1 text-right text-xs text-gray-400">
                                    {totalMatches} result{totalMatches !== 1 ? "s" : ""}
                                </div>
                            )}
                        </Command>
                    </div>
                </>
            )}
        </div>
    );
}
