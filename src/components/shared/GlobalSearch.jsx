import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
import { matrixSales } from "@/api/matrixSalesClient";
import { Input } from "@/components/ui/input";
import { createPageUrl } from "@/utils";

const SEARCH_ENTITIES = [
    {
        entity: "Customer",
        label: "Customer",
        page: "MasterDataManagement",
        fields: ["customer_code", "customer_name", "company_name", "email"]
    },
    {
        entity: "Vendor",
        label: "Vendor",
        page: "MasterDataManagement",
        fields: ["vendor_code", "vendor_name", "company_name", "email"]
    },
    {
        entity: "Material",
        label: "Material",
        page: "MasterDataManagement",
        fields: ["material_code", "material_name", "description"]
    },
    {
        entity: "Product",
        label: "Product",
        page: "MasterDataManagement",
        fields: ["product_code", "product_name", "description"]
    },
    {
        entity: "SalesOrder",
        label: "Sales Order",
        page: "Sales",
        fields: ["order_number", "sales_order_number", "customer_name", "product_name"]
    },
    {
        entity: "PurchaseOrder",
        label: "Purchase Order",
        page: "Purchasing",
        fields: ["po_number", "purchase_order_number", "vendor_name"]
    },
    {
        entity: "Invoice",
        label: "Invoice",
        page: "Sales",
        fields: ["invoice_number", "customer_name", "sales_order_number"]
    },
    {
        entity: "Employee",
        label: "Employee",
        page: "HR",
        fields: ["employee_number", "employee_name", "department", "email"]
    },
    {
        entity: "FixedAsset",
        label: "Fixed Asset",
        page: "FixedAssets",
        fields: ["asset_number", "asset_name", "asset_tag", "serial_number"]
    },
    {
        entity: "Project",
        label: "Project",
        page: "Projects",
        fields: ["project_number", "project_name", "customer_name"]
    }
];

const recordMatches = (record, fields, query) => fields.some((field) =>
    String(record?.[field] || "").toLowerCase().includes(query)
);

const getTitle = (record, fields) => {
    const titleField = fields.find((field) => record?.[field]);
    return titleField ? record[titleField] : record?.id || "Record";
};

const getSubtitle = (record, fields) => fields
    .slice(1)
    .map((field) => record?.[field])
    .filter(Boolean)
    .slice(0, 2)
    .join(" - ");

export default function GlobalSearch() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef(null);

    const normalizedQuery = useMemo(() => query.trim().toLowerCase(), [query]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (normalizedQuery.length < 2) {
            setResults([]);
            setLoading(false);
            return;
        }

        let active = true;
        const timer = window.setTimeout(async () => {
            setLoading(true);
            try {
                const batches = await Promise.all(
                    SEARCH_ENTITIES.map(async (config) => {
                        try {
                            const rows = await matrixSales.entities[config.entity].list("-created_at", 25);
                            return rows
                                .filter((record) => recordMatches(record, config.fields, normalizedQuery))
                                .slice(0, 4)
                                .map((record) => ({
                                    id: `${config.entity}-${record.id}`,
                                    title: getTitle(record, config.fields),
                                    subtitle: getSubtitle(record, config.fields),
                                    label: config.label,
                                    page: config.page
                                }));
                        } catch {
                            return [];
                        }
                    })
                );

                if (active) {
                    setResults(batches.flat().slice(0, 12));
                    setOpen(true);
                }
            } finally {
                if (active) setLoading(false);
            }
        }, 300);

        return () => {
            active = false;
            window.clearTimeout(timer);
        };
    }, [normalizedQuery]);

    return (
        <div ref={wrapperRef} className="relative hidden w-full max-w-md lg:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => normalizedQuery.length >= 2 && setOpen(true)}
                placeholder="Search customers, orders, invoices, assets..."
                className="h-9 border-slate-200 bg-white pl-9"
            />
            {loading && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
            )}

            {open && normalizedQuery.length >= 2 && (
                <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                    {results.length === 0 && !loading ? (
                        <div className="px-4 py-3 text-sm text-slate-500">No matching records</div>
                    ) : (
                        <div className="max-h-96 overflow-y-auto py-2">
                            {results.map((result) => (
                                <Link
                                    key={result.id}
                                    to={createPageUrl(result.page)}
                                    onClick={() => setOpen(false)}
                                    className="block px-4 py-3 hover:bg-slate-50"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-slate-900">{result.title}</p>
                                            {result.subtitle && (
                                                <p className="truncate text-xs text-slate-500">{result.subtitle}</p>
                                            )}
                                        </div>
                                        <span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                                            {result.label}
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
