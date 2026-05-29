import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, Printer, ChevronLeft, ChevronRight, ArrowUpDown, CheckCircle2, XCircle, Download } from "lucide-react";
import SearchFilter from "../shared/SearchFilter";
import { useLanguage } from "@/components/utils/languageContext";

function exportToCsv(filename, columns, rows) {
    const headers = columns.map((c) => `"${String(c.header || c.label || c.key).replace(/"/g, '""')}"`).join(",");
    const lines = rows.map((row) =>
        columns
            .map((c) => {
                const raw = row[c.key];
                const val = raw === null || raw === undefined ? "" : String(raw);
                return `"${val.replace(/"/g, '""')}"`;
            })
            .join(",")
    );
    const csv = [headers, ...lines].join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

export default function DataTable({
    data,
    columns,
    onEdit,
    onDelete,
    onPrint,
    getPrintTitle,
    onBulkDelete,
    onBulkStatusChange,
    getBadgeColor,
    searchFields = [],
    filterOptions = [],
    itemsPerPage = 20,
    showSearch = true,
    enableBulkActions = false,
    enableSorting = true,
    exportFileName
}) {
    const { t } = useLanguage();
    const [filteredData, setFilteredData] = useState(data || []);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedRows, setSelectedRows] = useState([]);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    // Update filtered data when source data changes
    React.useEffect(() => {
        setFilteredData(data || []);
        setCurrentPage(1);
        setSelectedRows([]);
    }, [data]);

    // Apply sorting
    const sortedData = React.useMemo(() => {
        if (!sortConfig.key) return filteredData;
        
        const sorted = [...(filteredData || [])].sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];
            
            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;
            
            if (typeof aVal === 'string') {
                return sortConfig.direction === 'asc' 
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            }
            
            return sortConfig.direction === 'asc' 
                ? aVal > bVal ? 1 : -1
                : bVal > aVal ? 1 : -1;
        });
        
        return sorted;
    }, [filteredData, sortConfig]);

    // Pagination
    const totalPages = Math.ceil((sortedData?.length || 0) / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentData = sortedData?.slice(startIndex, endIndex) || [];

    const handleFilteredData = (filtered) => {
        setFilteredData(filtered);
        setCurrentPage(1);
        setSelectedRows([]);
    };

    const goToPage = (page) => {
        setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    };

    const handleSort = (key) => {
        if (!enableSorting) return;
        
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleSelectAll = (checked) => {
        if (checked) {
            setSelectedRows(currentData.filter(Boolean).map(row => row.id).filter(Boolean));
        } else {
            setSelectedRows([]);
        }
    };

    const handleSelectRow = (rowId, checked) => {
        if (checked) {
            setSelectedRows(prev => [...prev, rowId]);
        } else {
            setSelectedRows(prev => prev.filter(id => id !== rowId));
        }
    };

    const handleBulkDelete = () => {
        if (onBulkDelete && selectedRows.length > 0) {
            onBulkDelete(selectedRows);
            setSelectedRows([]);
        }
    };

    const handleBulkStatusChange = (status) => {
        if (onBulkStatusChange && selectedRows.length > 0) {
            onBulkStatusChange(selectedRows, status);
            setSelectedRows([]);
        }
    };

    const allSelected = currentData.length > 0 && selectedRows.length === currentData.length;
    const someSelected = selectedRows.length > 0 && selectedRows.length < currentData.length;
    const renderCellValue = (row, col) => {
        if (col.isBadge) {
            return (
                <Badge className={getBadgeColor ? getBadgeColor(row[col.key]) : ""}>
                    {row[col.key]}
                </Badge>
            );
        }
        return col.render ? col.render(row[col.key], row) : row[col.key];
    };
    const renderWithFallback = (value) =>
        value === null || value === undefined || value === "" ? "-" : value;
    const actionButtonClass = "min-h-10 flex-1 gap-2";

    return (
        <div className="space-y-4">
            {showSearch && (
                <div className="flex items-center gap-2">
                    <div className="flex-1">
                        <SearchFilter
                            data={data || []}
                            onFilteredData={handleFilteredData}
                            searchFields={searchFields}
                            filterOptions={filterOptions}
                            placeholder="Search by any field..."
                        />
                    </div>
                    {exportFileName && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0 gap-1.5"
                            onClick={() => exportToCsv(exportFileName, columns, filteredData)}
                        >
                            <Download className="h-4 w-4" />
                            {t('exportCSV') || 'Export CSV'}
                        </Button>
                    )}
                </div>
            )}

            {enableBulkActions && selectedRows.length > 0 && (
                <div className="flex flex-col gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg sm:flex-row sm:items-center">
                    <span className="text-sm font-medium text-blue-900">
                        {selectedRows.length} item{selectedRows.length > 1 ? 's' : ''} selected
                    </span>
                    <div className="grid gap-2 sm:ml-auto sm:flex">
                        {onBulkStatusChange && (
                            <>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleBulkStatusChange('active')}
                                    className="gap-1"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    Activate
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleBulkStatusChange('inactive')}
                                    className="gap-1"
                                >
                                    <XCircle className="w-4 h-4" />
                                    Deactivate
                                </Button>
                            </>
                        )}
                        {onBulkDelete && (
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={handleBulkDelete}
                                className="gap-1"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete Selected
                            </Button>
                        )}
                    </div>
                </div>
            )}

            <div className="hidden rounded-lg border bg-white overflow-hidden md:block">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50">
                                {enableBulkActions && (
                                    <TableHead className="w-12">
                                        <Checkbox
                                            checked={allSelected}
                                            onCheckedChange={handleSelectAll}
                                            aria-label="Select all"
                                        />
                                    </TableHead>
                                )}
                                {columns.map((col, idx) => (
                                    <TableHead 
                                        key={idx} 
                                        className={`font-semibold text-gray-700 whitespace-nowrap ${enableSorting && col.sortable !== false ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                                        onClick={() => col.sortable !== false && handleSort(col.key)}
                                    >
                                        <div className="flex items-center gap-1">
                                            {col.header}
                                            {enableSorting && col.sortable !== false && (
                                                <ArrowUpDown className={`w-4 h-4 ${sortConfig.key === col.key ? 'text-emerald-600' : 'text-gray-400'}`} />
                                            )}
                                        </div>
                                    </TableHead>
                                ))}
                                {(onEdit || onDelete || onPrint) && (
                                    <TableHead className="font-semibold text-gray-700">Actions</TableHead>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {currentData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={columns.length + (enableBulkActions ? 2 : 1)} className="text-center py-8 text-gray-500">
                                        {filteredData?.length === 0 && data?.length > 0 
                                            ? "No matching records found" 
                                            : "No data available"}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                currentData.map((row, idx) => (
                                    <TableRow key={row.id || idx} className="hover:bg-gray-50">
                                        {enableBulkActions && (
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedRows.includes(row.id)}
                                                    onCheckedChange={(checked) => handleSelectRow(row.id, checked)}
                                                    aria-label={`Select row ${idx + 1}`}
                                                />
                                            </TableCell>
                                        )}
                                        {columns.map((col, colIdx) => (
                                            <TableCell key={colIdx} className="whitespace-nowrap">
                                                {renderCellValue(row, col)}
                                            </TableCell>
                                        ))}
                                        {(onEdit || onDelete || onPrint) && (
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    {onPrint && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => onPrint(row)}
                                                            title={getPrintTitle ? getPrintTitle(row) : "Print"}
                                                        >
                                                            <Printer className="w-4 h-4 text-blue-600" />
                                                        </Button>
                                                    )}
                                                    {onEdit && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => onEdit(row)}
                                                            title="Edit"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                    {onDelete && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => onDelete(row)}
                                                            className="text-red-600 hover:text-red-700"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                        <div className="text-sm text-gray-600">
                            Showing {startIndex + 1} to {Math.min(endIndex, sortedData?.length || 0)} of {sortedData?.length || 0} results
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => goToPage(currentPage - 1)}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Previous
                            </Button>
                            
                            <div className="flex gap-1">
                                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                    let pageNum;
                                    if (totalPages <= 5) {
                                        pageNum = i + 1;
                                    } else if (currentPage <= 3) {
                                        pageNum = i + 1;
                                    } else if (currentPage >= totalPages - 2) {
                                        pageNum = totalPages - 4 + i;
                                    } else {
                                        pageNum = currentPage - 2 + i;
                                    }

                                    return (
                                        <Button
                                            key={i}
                                            variant={currentPage === pageNum ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => goToPage(pageNum)}
                                            className={currentPage === pageNum ? "bg-emerald-600" : ""}
                                        >
                                            {pageNum}
                                        </Button>
                                    );
                                })}
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => goToPage(currentPage + 1)}
                                disabled={currentPage === totalPages}
                            >
                                Next
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-3 md:hidden">
                {currentData.length === 0 ? (
                    <div className="rounded-lg border bg-white p-6 text-center text-sm text-gray-500">
                        {filteredData?.length === 0 && data?.length > 0
                            ? "No matching records found"
                            : "No data available"}
                    </div>
                ) : (
                    currentData.map((row, idx) => {
                        const primaryColumn = columns[0];
                        const secondaryColumn = columns[1];
                        const detailColumns = columns.slice(2);

                        return (
                            <div key={row.id || idx} className="rounded-lg border bg-white p-4 shadow-sm">
                                <div className="flex items-start gap-3">
                                    {enableBulkActions && (
                                        <Checkbox
                                            checked={selectedRows.includes(row.id)}
                                            onCheckedChange={(checked) => handleSelectRow(row.id, checked)}
                                            aria-label={`Select row ${idx + 1}`}
                                            className="mt-1 shrink-0"
                                        />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        {primaryColumn && (
                                            <div className="text-sm font-semibold text-gray-950">
                                                {renderWithFallback(renderCellValue(row, primaryColumn))}
                                            </div>
                                        )}
                                        {secondaryColumn && (
                                            <div className="mt-1 text-sm text-gray-600">
                                                {renderWithFallback(renderCellValue(row, secondaryColumn))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {detailColumns.length > 0 && (
                                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                        {detailColumns.map((col, colIdx) => (
                                            <div key={colIdx} className="min-w-0">
                                                <p className="text-xs font-medium text-gray-500">{col.header}</p>
                                                <div className="mt-1 break-words text-gray-900">
                                                    {renderWithFallback(renderCellValue(row, col))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {(onEdit || onDelete || onPrint) && (
                                    <div className="mt-4 flex gap-2">
                                        {onPrint && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className={actionButtonClass}
                                                onClick={() => onPrint(row)}
                                                title={getPrintTitle ? getPrintTitle(row) : "Print"}
                                            >
                                                <Printer className="h-4 w-4 text-blue-600" />
                                                Print
                                            </Button>
                                        )}
                                        {onEdit && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className={actionButtonClass}
                                                onClick={() => onEdit(row)}
                                                title="Edit"
                                            >
                                                <Pencil className="h-4 w-4" />
                                                Edit
                                            </Button>
                                        )}
                                        {onDelete && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className={`${actionButtonClass} text-red-600 hover:text-red-700`}
                                                onClick={() => onDelete(row)}
                                                title="Delete"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                Delete
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}

                {totalPages > 1 && (
                    <div className="grid grid-cols-2 gap-2 rounded-lg border bg-gray-50 p-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => goToPage(currentPage - 1)}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => goToPage(currentPage + 1)}
                            disabled={currentPage === totalPages}
                        >
                            Next
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                        <div className="col-span-2 text-center text-xs text-gray-600">
                            Page {currentPage} of {totalPages}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
