
import React, { useState, useRef, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, Mail, AlertTriangle, Filter, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ARAgingReport() {
    const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
    const [fromCustomer, setFromCustomer] = useState("ALL");
    const [toCustomer, setToCustomer] = useState("ALL");
    const [selectionMode, setSelectionMode] = useState("dropdown"); // "dropdown" or "manual" or "search"
    const [manualFromCustomer, setManualFromCustomer] = useState("");
    const [manualToCustomer, setManualToCustomer] = useState("");
    
    // Search/Autocomplete states
    const [fromSearchQuery, setFromSearchQuery] = useState("");
    const [toSearchQuery, setToSearchQuery] = useState("");
    const [showFromSuggestions, setShowFromSuggestions] = useState(false);
    const [showToSuggestions, setShowToSuggestions] = useState(false);
    const [fromFocusedIndex, setFromFocusedIndex] = useState(-1);
    const [toFocusedIndex, setToFocusedIndex] = useState(-1);

    const fromInputRef = useRef(null);
    const toInputRef = useRef(null);
    const fromSuggestionsRef = useRef(null);
    const toSuggestionsRef = useRef(null);

    const { data: arRecords = [] } = useQuery({
        queryKey: ['accountsReceivable'],
        queryFn: () => matrixSales.entities.AccountsReceivable.list(),
        initialData: []
    });

    const { data: customers = [] } = useQuery({
        queryKey: ['customers'],
        queryFn: () => matrixSales.entities.Customer.list(),
        initialData: []
    });

    // Get unique customers sorted by code
    const uniqueCustomers = [...new Set(arRecords.map(ar => ar.customer_code))]
        .map(code => arRecords.find(ar => ar.customer_code === code))
        .filter(c => c && c.customer_code)
        .sort((a, b) => (a.customer_code || '').localeCompare(b.customer_code || ''));

    // Filter customers based on search query
    const getFilteredCustomers = (query) => {
        if (!query || query.length < 1) return [];
        
        const lowerQuery = query.toLowerCase();
        return uniqueCustomers.filter(customer => 
            customer.customer_code.toLowerCase().includes(lowerQuery) ||
            customer.customer_name.toLowerCase().includes(lowerQuery)
        ).slice(0, 10); // Limit to 10 suggestions
    };

    const fromSuggestions = getFilteredCustomers(fromSearchQuery);
    const toSuggestions = getFilteredCustomers(toSearchQuery);

    // Handle click outside to close suggestions
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (fromSuggestionsRef.current && !fromSuggestionsRef.current.contains(event.target) &&
                fromInputRef.current && !fromInputRef.current.contains(event.target)) {
                setShowFromSuggestions(false);
                setFromFocusedIndex(-1);
            }
            if (toSuggestionsRef.current && !toSuggestionsRef.current.contains(event.target) &&
                toInputRef.current && !toInputRef.current.contains(event.target)) {
                setShowToSuggestions(false);
                setToFocusedIndex(-1);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [fromSuggestionsRef, toSuggestionsRef, fromInputRef, toInputRef]);

    // Handle keyboard navigation for from field
    const handleFromKeyDown = (e) => {
        if (!showFromSuggestions || fromSuggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFromFocusedIndex(prev => 
                prev < fromSuggestions.length - 1 ? prev + 1 : prev
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFromFocusedIndex(prev => prev > 0 ? prev - 1 : 0);
        } else if (e.key === 'Enter' && fromFocusedIndex >= 0) {
            e.preventDefault();
            selectFromCustomer(fromSuggestions[fromFocusedIndex]);
            fromInputRef.current?.blur(); // Optionally blur the input after selection
        } else if (e.key === 'Escape') {
            setShowFromSuggestions(false);
            setFromFocusedIndex(-1);
        }
    };

    // Handle keyboard navigation for to field
    const handleToKeyDown = (e) => {
        if (!showToSuggestions || toSuggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setToFocusedIndex(prev => 
                prev < toSuggestions.length - 1 ? prev + 1 : prev
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setToFocusedIndex(prev => prev > 0 ? prev - 1 : 0);
        } else if (e.key === 'Enter' && toFocusedIndex >= 0) {
            e.preventDefault();
            selectToCustomer(toSuggestions[toFocusedIndex]);
            toInputRef.current?.blur(); // Optionally blur the input after selection
        } else if (e.key === 'Escape') {
            setShowToSuggestions(false);
            setToFocusedIndex(-1);
        }
    };

    const selectFromCustomer = (customer) => {
        setFromSearchQuery(`${customer.customer_code} - ${customer.customer_name}`);
        setManualFromCustomer(customer.customer_code);
        setShowFromSuggestions(false);
        setFromFocusedIndex(-1);
    };

    const selectToCustomer = (customer) => {
        setToSearchQuery(`${customer.customer_code} - ${customer.customer_name}`);
        setManualToCustomer(customer.customer_code);
        setShowToSuggestions(false);
        setToFocusedIndex(-1);
    };

    const calculateAging = () => {
        const today = new Date(asOfDate);
        const agingData = [];

        // Determine which customer range to use
        let effectiveFromCustomer, effectiveToCustomer;
        
        if (selectionMode === "search") {
            effectiveFromCustomer = manualFromCustomer || "ALL";
            effectiveToCustomer = manualToCustomer || "ALL";
        } else if (selectionMode === "manual") {
            effectiveFromCustomer = manualFromCustomer || "ALL";
            effectiveToCustomer = manualToCustomer || "ALL";
        } else {
            effectiveFromCustomer = fromCustomer;
            effectiveToCustomer = toCustomer;
        }

        // Group by customer
        const customerGroups = {};
        arRecords.forEach(ar => {
            if (ar.status === 'open' || ar.status === 'partially_paid') {
                // Apply customer range filter
                if (effectiveFromCustomer !== "ALL" && effectiveToCustomer !== "ALL") {
                    if (ar.customer_code < effectiveFromCustomer || ar.customer_code > effectiveToCustomer) {
                        return;
                    }
                } else if (effectiveFromCustomer !== "ALL" && ar.customer_code < effectiveFromCustomer) {
                    return;
                } else if (effectiveToCustomer !== "ALL" && ar.customer_code > effectiveToCustomer) {
                    return;
                }

                if (!customerGroups[ar.customer_code]) {
                    customerGroups[ar.customer_code] = {
                        customer_code: ar.customer_code,
                        customer_name: ar.customer_name,
                        current: 0,
                        days_1_30: 0,
                        days_31_60: 0,
                        days_61_90: 0,
                        days_90_plus: 0,
                        total: 0,
                        invoices: []
                    };
                }

                const dueDate = new Date(ar.due_date);
                const daysPastDue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
                const outstanding = ar.outstanding_amount || 0;

                // Add to appropriate aging bucket
                if (daysPastDue <= 0) {
                    customerGroups[ar.customer_code].current += outstanding;
                } else if (daysPastDue <= 30) {
                    customerGroups[ar.customer_code].days_1_30 += outstanding;
                } else if (daysPastDue <= 60) {
                    customerGroups[ar.customer_code].days_31_60 += outstanding;
                } else if (daysPastDue <= 90) {
                    customerGroups[ar.customer_code].days_61_90 += outstanding;
                } else {
                    customerGroups[ar.customer_code].days_90_plus += outstanding;
                }

                customerGroups[ar.customer_code].total += outstanding;
                customerGroups[ar.customer_code].invoices.push({
                    invoice_number: ar.invoice_number,
                    invoice_date: ar.invoice_date,
                    due_date: ar.due_date,
                    days_past_due: daysPastDue,
                    outstanding: outstanding
                });
            }
        });

        return Object.values(customerGroups).sort((a, b) => (a.customer_code || '').localeCompare(b.customer_code || ''));
    };

    const agingData = calculateAging();
    
    const totals = {
        current: agingData.reduce((sum, c) => sum + c.current, 0),
        days_1_30: agingData.reduce((sum, c) => sum + c.days_1_30, 0),
        days_31_60: agingData.reduce((sum, c) => sum + c.days_31_60, 0),
        days_61_90: agingData.reduce((sum, c) => sum + c.days_61_90, 0),
        days_90_plus: agingData.reduce((sum, c) => sum + c.days_90_plus, 0),
        total: agingData.reduce((sum, c) => sum + c.total, 0)
    };

    const handleExportPDF = () => {
        const printWindow = window.open('', '_blank');
        let effectiveFromCustomer, effectiveToCustomer;
        
        if (selectionMode === "search" || selectionMode === "manual") {
            effectiveFromCustomer = manualFromCustomer || "ALL";
            effectiveToCustomer = manualToCustomer || "ALL";
        } else {
            effectiveFromCustomer = fromCustomer;
            effectiveToCustomer = toCustomer;
        }

        const customerRangeText = effectiveFromCustomer === "ALL" && effectiveToCustomer === "ALL" 
            ? "All Customers" 
            : effectiveFromCustomer !== "ALL" && effectiveToCustomer !== "ALL"
            ? `Customers: ${effectiveFromCustomer} to ${effectiveToCustomer}`
            : effectiveFromCustomer !== "ALL"
            ? `Customers from: ${effectiveFromCustomer}`
            : `Customers up to: ${effectiveToCustomer}`;

        const content = `
            <html>
                <head>
                    <title>Accounts Receivable Aging - ${asOfDate}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 40px; font-size: 11px; }
                        h1 { color: #059669; text-align: center; }
                        .header { text-align: center; margin-bottom: 20px; }
                        .filter-info { text-align: center; margin-bottom: 15px; color: #4b5563; font-style: italic; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f3f4f6; font-weight: bold; }
                        .number { text-align: right; }
                        .total-row { font-weight: bold; background-color: #e5e7eb; }
                        .warning { background-color: #fef3c7; }
                        .danger { background-color: #fee2e2; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>MatrixERP - Accounts Receivable Aging</h1>
                        <p>As of ${new Date(asOfDate).toLocaleDateString()}</p>
                    </div>
                    <div class="filter-info">
                        <p>${customerRangeText}</p>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Customer Code</th>
                                <th>Customer Name</th>
                                <th class="number">Current</th>
                                <th class="number">1-30 Days</th>
                                <th class="number">31-60 Days</th>
                                <th class="number">61-90 Days</th>
                                <th class="number">&gt;90 Days</th>
                                <th class="number">Total Outstanding</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${agingData.map(customer => `
                                <tr${customer.days_90_plus > 0 ? ' class="danger"' : customer.days_61_90 > 0 ? ' class="warning"' : ''}>
                                    <td>${customer.customer_code}</td>
                                    <td>${customer.customer_name}</td>
                                    <td class="number">${customer.current.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                    <td class="number">${customer.days_1_30.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                    <td class="number">${customer.days_31_60.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                    <td class="number">${customer.days_61_90.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                    <td class="number">${customer.days_90_plus.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                    <td class="number"><strong>${customer.total.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></td>
                                </tr>
                            `).join('')}
                            <tr class="total-row">
                                <td colspan="2">TOTAL</td>
                                <td class="number">${totals.current.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                <td class="number">${totals.days_1_30.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                <td class="number">${totals.days_31_60.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                <td class="number">${totals.days_61_90.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                <td class="number">${totals.days_90_plus.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                <td class="number">${totals.total.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                            </tr>
                        </tbody>
                    </table>
                    <p style="margin-top: 20px; font-size: 10px; color: #6b7280;">
                        Generated on: ${new Date().toLocaleString()} | MatrixERP Financial Reporting System
                    </p>
                </body>
            </html>
        `;
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.print();
    };

    const handleClearFilters = () => {
        setFromCustomer("ALL");
        setToCustomer("ALL");
        setManualFromCustomer("");
        setManualToCustomer("");
        setFromSearchQuery("");
        setToSearchQuery("");
        setShowFromSuggestions(false);
        setShowToSuggestions(false);
        setFromFocusedIndex(-1);
        setToFocusedIndex(-1);
    };

    let effectiveFromCustomer, effectiveToCustomer;
    if (selectionMode === "search" || selectionMode === "manual") {
        effectiveFromCustomer = manualFromCustomer || "ALL";
        effectiveToCustomer = manualToCustomer || "ALL";
    } else {
        effectiveFromCustomer = fromCustomer;
        effectiveToCustomer = toCustomer;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-emerald-600" />
                        Accounts Receivable Aging Report by Customer
                    </span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportPDF}>
                            <Download className="w-4 h-4 mr-2" />
                            Export PDF
                        </Button>
                        <Button variant="outline" size="sm">
                            <FileText className="w-4 h-4 mr-2" />
                            Export Excel
                        </Button>
                        <Button variant="outline" size="sm">
                            <Mail className="w-4 h-4 mr-2" />
                            Email
                        </Button>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {/* Filters */}
                <div className="space-y-4 mb-6 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <Label>As of Date</Label>
                            <Input
                                type="date"
                                value={asOfDate}
                                onChange={(e) => setAsOfDate(e.target.value)}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <Label>Customer Selection Mode</Label>
                            <Tabs value={selectionMode} onValueChange={setSelectionMode} className="w-full">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="dropdown">Dropdown</TabsTrigger>
                                    <TabsTrigger value="search">Search</TabsTrigger>
                                    <TabsTrigger value="manual">Manual</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    </div>

                    {selectionMode === "dropdown" && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <Label>From Customer</Label>
                                <Select value={fromCustomer} onValueChange={setFromCustomer}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All Customers</SelectItem>
                                        {uniqueCustomers.map(customer => (
                                            <SelectItem key={customer.customer_code} value={customer.customer_code}>
                                                {customer.customer_code} - {customer.customer_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>To Customer</Label>
                                <Select value={toCustomer} onValueChange={setToCustomer}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All Customers</SelectItem>
                                        {uniqueCustomers.map(customer => (
                                            <SelectItem key={customer.customer_code} value={customer.customer_code}>
                                                {customer.customer_code} - {customer.customer_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-end">
                                <Button 
                                    variant="outline" 
                                    className="w-full"
                                    onClick={handleClearFilters}
                                    disabled={fromCustomer === "ALL" && toCustomer === "ALL"}
                                >
                                    <Filter className="w-4 h-4 mr-2" />
                                    Clear Filters
                                </Button>
                            </div>
                        </div>
                    )}

                    {selectionMode === "search" && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="relative">
                                <Label>From Customer (Search by code or name)</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input
                                        ref={fromInputRef}
                                        type="text"
                                        placeholder="Type to search customers..."
                                        value={fromSearchQuery}
                                        onChange={(e) => {
                                            setFromSearchQuery(e.target.value);
                                            setShowFromSuggestions(true);
                                            setFromFocusedIndex(-1);
                                            // Clear the customer code if user is typing fresh or changing input
                                            setManualFromCustomer(""); 
                                        }}
                                        onFocus={() => {
                                            // Only show suggestions if there's a query or if suggestions were previously open
                                            if (fromSearchQuery.length > 0) {
                                                setShowFromSuggestions(true);
                                            }
                                        }}
                                        onKeyDown={handleFromKeyDown}
                                        className="pl-10"
                                    />
                                </div>
                                {showFromSuggestions && fromSuggestions.length > 0 && (
                                    <div 
                                        ref={fromSuggestionsRef}
                                        className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                                    >
                                        {fromSuggestions.map((customer, idx) => (
                                            <div
                                                key={customer.customer_code}
                                                className={`px-4 py-2 cursor-pointer hover:bg-emerald-50 border-b border-gray-100 last:border-b-0 ${
                                                    idx === fromFocusedIndex ? 'bg-emerald-50' : ''
                                                }`}
                                                onClick={() => selectFromCustomer(customer)}
                                                onMouseEnter={() => setFromFocusedIndex(idx)}
                                            >
                                                <div className="font-medium text-gray-900">{customer.customer_code}</div>
                                                <div className="text-sm text-gray-600">{customer.customer_name}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <p className="text-xs text-gray-500 mt-1">
                                    {manualFromCustomer ? `Selected: ${manualFromCustomer}` : 'Leave blank for all'}
                                </p>
                            </div>

                            <div className="relative">
                                <Label>To Customer (Search by code or name)</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input
                                        ref={toInputRef}
                                        type="text"
                                        placeholder="Type to search customers..."
                                        value={toSearchQuery}
                                        onChange={(e) => {
                                            setToSearchQuery(e.target.value);
                                            setShowToSuggestions(true);
                                            setToFocusedIndex(-1);
                                            setManualToCustomer("");
                                        }}
                                        onFocus={() => {
                                            if (toSearchQuery.length > 0) {
                                                setShowToSuggestions(true);
                                            }
                                        }}
                                        onKeyDown={handleToKeyDown}
                                        className="pl-10"
                                    />
                                </div>
                                {showToSuggestions && toSuggestions.length > 0 && (
                                    <div 
                                        ref={toSuggestionsRef}
                                        className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                                    >
                                        {toSuggestions.map((customer, idx) => (
                                            <div
                                                key={customer.customer_code}
                                                className={`px-4 py-2 cursor-pointer hover:bg-emerald-50 border-b border-gray-100 last:border-b-0 ${
                                                    idx === toFocusedIndex ? 'bg-emerald-50' : ''
                                                }`}
                                                onClick={() => selectToCustomer(customer)}
                                                onMouseEnter={() => setToFocusedIndex(idx)}
                                            >
                                                <div className="font-medium text-gray-900">{customer.customer_code}</div>
                                                <div className="text-sm text-gray-600">{customer.customer_name}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <p className="text-xs text-gray-500 mt-1">
                                    {manualToCustomer ? `Selected: ${manualToCustomer}` : 'Leave blank for all'}
                                </p>
                            </div>

                            <div className="flex items-end">
                                <Button 
                                    variant="outline" 
                                    className="w-full"
                                    onClick={handleClearFilters}
                                    disabled={!manualFromCustomer && !manualToCustomer && !fromSearchQuery && !toSearchQuery}
                                >
                                    <Filter className="w-4 h-4 mr-2" />
                                    Clear Filters
                                </Button>
                            </div>
                        </div>
                    )}

                    {selectionMode === "manual" && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <Label>From Customer Code</Label>
                                <Input
                                    type="text"
                                    placeholder="Enter customer code (e.g., C001)"
                                    value={manualFromCustomer}
                                    onChange={(e) => setManualFromCustomer(e.target.value.toUpperCase())}
                                />
                                <p className="text-xs text-gray-500 mt-1">Leave blank for all</p>
                            </div>
                            <div>
                                <Label>To Customer Code</Label>
                                <Input
                                    type="text"
                                    placeholder="Enter customer code (e.g., C999)"
                                    value={manualToCustomer}
                                    onChange={(e) => setManualToCustomer(e.target.value.toUpperCase())}
                                />
                                <p className="text-xs text-gray-500 mt-1">Leave blank for all</p>
                            </div>
                            <div className="flex items-end">
                                <Button 
                                    variant="outline" 
                                    className="w-full"
                                    onClick={handleClearFilters}
                                    disabled={!manualFromCustomer && !manualToCustomer}
                                >
                                    <Filter className="w-4 h-4 mr-2" />
                                    Clear Filters
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end">
                        <Button className="bg-emerald-600 hover:bg-emerald-700">
                            Generate Report
                        </Button>
                    </div>
                </div>

                {/* Active Filter Display */}
                {(effectiveFromCustomer !== "ALL" || effectiveToCustomer !== "ALL") && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800">
                            <Filter className="w-4 h-4 inline mr-2" />
                            <strong>Active Filter:</strong> Showing customers 
                            {effectiveFromCustomer !== "ALL" && effectiveToCustomer !== "ALL" 
                                ? ` from ${effectiveFromCustomer} to ${effectiveToCustomer}`
                                : effectiveFromCustomer !== "ALL"
                                ? ` from ${effectiveFromCustomer} onwards`
                                : ` up to ${effectiveToCustomer}`
                            }
                            {" "}({agingData.length} customer{agingData.length !== 1 ? 's' : ''})
                        </p>
                    </div>
                )}

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
                    <Card className="bg-green-50">
                        <CardContent className="p-3">
                            <p className="text-xs text-gray-600">Current</p>
                            <p className="text-lg font-bold text-green-700">
                                SAR {(totals.current / 1000).toFixed(0)}K
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-blue-50">
                        <CardContent className="p-3">
                            <p className="text-xs text-gray-600">1-30 Days</p>
                            <p className="text-lg font-bold text-blue-700">
                                SAR {(totals.days_1_30 / 1000).toFixed(0)}K
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-yellow-50">
                        <CardContent className="p-3">
                            <p className="text-xs text-gray-600">31-60 Days</p>
                            <p className="text-lg font-bold text-yellow-700">
                                SAR {(totals.days_31_60 / 1000).toFixed(0)}K
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-orange-50">
                        <CardContent className="p-3">
                            <p className="text-xs text-gray-600">61-90 Days</p>
                            <p className="text-lg font-bold text-orange-700">
                                SAR {(totals.days_61_90 / 1000).toFixed(0)}K
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-red-50">
                        <CardContent className="p-3">
                            <p className="text-xs text-gray-600">{">"} 90 Days</p>
                            <p className="text-lg font-bold text-red-700">
                                SAR {(totals.days_90_plus / 1000).toFixed(0)}K
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-indigo-50">
                        <CardContent className="p-3">
                            <p className="text-xs text-gray-600">Total</p>
                            <p className="text-lg font-bold text-indigo-700">
                                SAR {(totals.total / 1000).toFixed(0)}K
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Aging Table by Customer */}
                <div className="rounded-lg border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50">
                                <TableHead>Customer Code</TableHead>
                                <TableHead>Customer Name</TableHead>
                                <TableHead className="text-right">Current</TableHead>
                                <TableHead className="text-right">1-30 Days</TableHead>
                                <TableHead className="text-right">31-60 Days</TableHead>
                                <TableHead className="text-right">61-90 Days</TableHead>
                                <TableHead className="text-right">{">"} 90 Days</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead>Risk</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {agingData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                                        No receivables found for the selected criteria
                                    </TableCell>
                                </TableRow>
                            ) : (
                                <>
                                    {agingData.map((customer, idx) => {
                                        const riskLevel = customer.days_90_plus > 0 ? 'high' : 
                                                          customer.days_61_90 > 0 ? 'medium' : 'low';
                                        return (
                                            <TableRow key={idx} className={
                                                riskLevel === 'high' ? 'bg-red-50' : 
                                                riskLevel === 'medium' ? 'bg-yellow-50' : ''
                                            }>
                                                <TableCell className="font-medium">{customer.customer_code}</TableCell>
                                                <TableCell className="font-medium">{customer.customer_name}</TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {customer.current > 0 ? customer.current.toLocaleString('en-US', {minimumFractionDigits: 2}) : '-'}
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {customer.days_1_30 > 0 ? customer.days_1_30.toLocaleString('en-US', {minimumFractionDigits: 2}) : '-'}
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {customer.days_31_60 > 0 ? customer.days_31_60.toLocaleString('en-US', {minimumFractionDigits: 2}) : '-'}
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {customer.days_61_90 > 0 ? customer.days_61_90.toLocaleString('en-US', {minimumFractionDigits: 2}) : '-'}
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {customer.days_90_plus > 0 ? customer.days_90_plus.toLocaleString('en-US', {minimumFractionDigits: 2}) : '-'}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-bold">
                                                    {customer.total.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={
                                                        riskLevel === 'high' ? 'bg-red-100 text-red-800' :
                                                        riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-green-100 text-green-800'
                                                    }>
                                                        {riskLevel === 'high' ? <AlertTriangle className="w-3 h-3 mr-1 inline" /> : null}
                                                        {riskLevel.toUpperCase()}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    <TableRow className="bg-gray-100 font-bold">
                                        <TableCell colSpan={2}>TOTAL</TableCell>
                                        <TableCell className="text-right font-mono">
                                            {totals.current.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {totals.days_1_30.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {totals.days_31_60.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {totals.days_61_90.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {totals.days_90_plus.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {totals.total.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                        </TableCell>
                                        <TableCell></TableCell>
                                    </TableRow>
                                </>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* High Risk Customers Alert */}
                {agingData.filter(c => c.days_90_plus > 0).length > 0 && (
                    <Card className="mt-6 bg-red-50 border-red-200">
                        <CardHeader>
                            <CardTitle className="text-lg text-red-800 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" />
                                High Risk Customers - Immediate Action Required
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {agingData.filter(c => c.days_90_plus > 0).map((customer, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200">
                                        <div>
                                            <p className="font-semibold text-gray-900">{customer.customer_name}</p>
                                            <p className="text-sm text-gray-600">Code: {customer.customer_code} • {customer.invoices.length} overdue invoices</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-red-700">
                                                SAR {customer.days_90_plus.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                            </p>
                                            <p className="text-xs text-red-600">{">"} 90 days overdue</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </CardContent>
        </Card>
    );
}
