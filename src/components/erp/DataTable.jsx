import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, Printer, ChevronLeft, ChevronRight, ArrowUpDown, CheckCircle2, XCircle } from "lucide-react";
import SearchFilter from "../shared/SearchFilter";

export default function DataTable({ 
    data, 
    columns, 
    onEdit, 
    onDelete, 
    onPrint,
    onBulkDelete,
    onBulkStatusChange,
    getBadgeColor,
    searchFields = [],
    filterOptions = [],
    itemsPerPage = 20,
    showSearch = true,
    enableBulkActions = false,
    enableSorting = true
}) {
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
            setSelectedRows(currentData.map(row => row.id));
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

    return (
        <div className="space-y-4">
            {showSearch && (
                <SearchFilter
                    data={data || []}
                    onFilteredData={handleFilteredData}
                    searchFields={searchFields}
                    filterOptions={filterOptions}
                    placeholder="Search by any field..."
                />
            )}

            {enableBulkActions && selectedRows.length > 0 && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <span className="text-sm font-medium text-blue-900">
                        {selectedRows.length} item{selectedRows.length > 1 ? 's' : ''} selected
                    </span>
                    <div className="flex gap-2 ml-auto">
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

            <div className="rounded-lg border bg-white overflow-hidden">
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
                                                {col.isBadge ? (
                                                    <Badge className={getBadgeColor ? getBadgeColor(row[col.key]) : ""}>
                                                        {row[col.key]}
                                                    </Badge>
                                                ) : col.render ? (
                                                    col.render(row[col.key], row)
                                                ) : (
                                                    row[col.key]
                                                )}
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
                                                            title="Print"
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
        </div>
    );
}