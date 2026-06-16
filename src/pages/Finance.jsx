import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Users, CreditCard, Building2, AlertCircle, Clock, CheckCircle, Receipt } from "lucide-react";
import DataTable from "@/components/erp/DataTable";
import JournalEntryForm from "@/components/finance/JournalEntryForm";
import ARForm from "@/components/finance/ARForm";
import APForm from "@/components/finance/APForm";
import PaymentForm from "@/components/finance/PaymentForm";
import FixedAssetForm from "@/components/finance/FixedAssetForm";
import InvoiceClearingDialog from "@/components/finance/InvoiceClearingDialog";
import TrialBalanceReport from "@/components/finance/TrialBalanceReport";
import IncomeStatementReport from "@/components/finance/IncomeStatementReport";
import BalanceSheetReport from "@/components/finance/BalanceSheetReport";
import CashFlowStatementReport from "@/components/finance/CashFlowStatementReport";
import BudgetVarianceReport from "@/components/finance/BudgetVarianceReport";
import GLAccountMappingForm from "@/components/finance/GLAccountMappingForm";
import CostCenterForm from "@/components/finance/CostCenterForm";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/components/utils/languageContext";
import { Settings, MapPin } from "lucide-react";

export default function Finance() {
    const [activeTab, setActiveTab] = useState("gl");
    const [showDialog, setShowDialog] = useState(false);
    const [showClearingDialog, setShowClearingDialog] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [showCostCenterDialog, setShowCostCenterDialog] = useState(false);
    const [editingCostCenter, setEditingCostCenter] = useState(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { t } = useLanguage();

    const { data: journals = [] } = useQuery({
        queryKey: ['journals'],
        queryFn: () => matrixSales.entities.JournalEntry.list('-posting_date'),
        initialData: []
    });

    const { data: arTransactions = [] } = useQuery({
        queryKey: ['ar'],
        queryFn: () => matrixSales.entities.AccountsReceivable.list('-invoice_date'),
        initialData: []
    });

    const { data: apTransactions = [] } = useQuery({
        queryKey: ['ap'],
        queryFn: () => matrixSales.entities.AccountsPayable.list('-invoice_date'),
        initialData: []
    });

    const { data: payments = [] } = useQuery({
        queryKey: ['payments'],
        queryFn: () => matrixSales.entities.Payment.list('-payment_date'),
        initialData: []
    });

    const { data: assets = [] } = useQuery({
        queryKey: ['assets'],
        queryFn: () => matrixSales.entities.FixedAsset.list('-acquisition_date'),
        initialData: []
    });

    const { data: banks = [] } = useQuery({
        queryKey: ['banks'],
        queryFn: () => matrixSales.entities.BankAccount.list(),
        initialData: []
    });

    const { data: costCenters = [] } = useQuery({
        queryKey: ['costCenters'],
        queryFn: () => matrixSales.entities.CostCenter.list(),
        initialData: []
    });

    const totalAR = arTransactions.reduce((sum, ar) => sum + (ar.outstanding_amount || 0), 0);
    const totalAP = apTransactions.reduce((sum, ap) => sum + (ap.outstanding_amount || 0), 0);
    const overdueAR = arTransactions.filter(ar => ar.status === 'overdue').length;
    const totalAssetValue = assets.reduce((sum, asset) => sum + (asset.net_book_value || 0), 0);

    const dso = arTransactions.length > 0 
        ? Math.round((totalAR / (totalAR + totalAP)) * 365 / 12)
        : 0;

    const dpo = apTransactions.length > 0
        ? Math.round((totalAP / (totalAR + totalAP)) * 365 / 12)
        : 0;

    const deleteMutation = useMutation({
        mutationFn: ({ entity, id }) => matrixSales.entities[entity].delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries();
            toast({
                title: t('success'),
                description: t('deletedSuccessfully'),
                variant: "default"
            });
        }
    });

    const journalEntryColumns = [
        { header: "Journal #", key: "journal_number" },
        { header: "Posting Date", key: "posting_date" },
        { header: "Account Code", key: "account_code" },
        { header: "Account Name", key: "account_name" },
        { 
            header: "Debit", 
            key: "debit_amount", 
            render: (val) => val ? `LKR ${val.toLocaleString()}` : '-'
        },
        { 
            header: "Credit", 
            key: "credit_amount", 
            render: (val) => val ? `LKR ${val.toLocaleString()}` : '-'
        },
        { header: t('status'), key: "status", isBadge: true },
        {
            header: "Approval",
            key: "approval_status",
            render: (val, row) => {
                if (row.status === 'pending_approval') {
                    return (
                        <div className="flex items-center gap-1 text-amber-600">
                            <Clock className="w-4 h-4" />
                            <span className="text-xs">{t('pending')}</span>
                        </div>
                    );
                }
                if (row.status === 'posted') {
                    return (
                        <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-xs">Posted</span>
                        </div>
                    );
                }
                return null;
            }
        }
    ];

    const arColumns = [
        { header: "AR #", key: "ar_number" },
        { header: "Invoice #", key: "invoice_number" },
        { header: t('customer'), key: "customer_name" },
        { header: "Invoice Date", key: "invoice_date" },
        { header: "Due Date", key: "due_date" },
        { header: t('amount'), key: "invoice_amount", render: (val) => `LKR ${val?.toLocaleString() || 0}` },
        { header: "Outstanding", key: "outstanding_amount", render: (val) => `LKR ${val?.toLocaleString() || 0}` },
        { header: "Aging", key: "aging_bucket", isBadge: true },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const apColumns = [
        { header: "AP #", key: "ap_number" },
        { header: "Vendor Invoice", key: "vendor_invoice_number" },
        { header: t('vendor'), key: "vendor_name" },
        { header: "Invoice Date", key: "invoice_date" },
        { header: "Due Date", key: "due_date" },
        { header: t('amount'), key: "invoice_amount", render: (val) => `LKR ${val?.toLocaleString() || 0}` },
        { header: "Outstanding", key: "outstanding_amount", render: (val) => `LKR ${val?.toLocaleString() || 0}` },
        { header: "Aging", key: "aging_bucket", isBadge: true },
        { header: t('status'), key: "payment_status", isBadge: true }
    ];

    const paymentColumns = [
        { header: "Payment #", key: "payment_number" },
        { header: t('type'), key: "payment_type", isBadge: true },
        { header: t('date'), key: "payment_date" },
        { header: "Party", key: "party_name" },
        { header: t('amount'), key: "amount", render: (val) => `LKR ${val?.toLocaleString() || 0}` },
        { header: "Method", key: "payment_method", isBadge: true },
        { header: "Bank Account", key: "bank_account" },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const assetColumns = [
        { header: t('assetNumber'), key: "asset_number" },
        { header: t('assetName'), key: "asset_name" },
        { header: "Class", key: "asset_class", isBadge: true },
        { header: t('acquisitionDate'), key: "acquisition_date" },
        { header: "Cost", key: "acquisition_cost", render: (val) => `LKR ${val?.toLocaleString() || 0}` },
        { header: "Depreciation", key: "accumulated_depreciation", render: (val) => `LKR ${val?.toLocaleString() || 0}` },
        { header: "NBV", key: "net_book_value", render: (val) => `LKR ${val?.toLocaleString() || 0}` },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const bankColumns = [
        { header: "Account #", key: "account_number" },
        { header: "Account Name", key: "account_name" },
        { header: "Bank", key: "bank_name" },
        { header: "IBAN", key: "iban" },
        { header: "Currency", key: "currency" },
        { header: "Balance", key: "current_balance", render: (val) => `LKR ${val?.toLocaleString() || 0}` },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const getBadgeColor = (value) => {
        const colors = {
            draft: "bg-gray-100 text-gray-800",
            posted: "bg-green-100 text-green-800",
            reversed: "bg-red-100 text-red-800",
            open: "bg-blue-100 text-blue-800",
            paid: "bg-green-100 text-green-800",
            overdue: "bg-red-100 text-red-800",
            partially_paid: "bg-yellow-100 text-yellow-800",
            pending: "bg-yellow-100 text-yellow-800",
            pending_approval: "bg-amber-100 text-amber-800",
            approved: "bg-green-100 text-green-800",
            scheduled: "bg-blue-100 text-blue-800",
            rejected: "bg-red-100 text-red-800",
            cleared: "bg-green-100 text-green-800",
            bounced: "bg-red-100 text-red-800",
            cancelled: "bg-gray-100 text-gray-800",
            active: "bg-green-100 text-green-800",
            inactive: "bg-gray-100 text-gray-800",
            disposed: "bg-red-100 text-red-800",
            incoming: "bg-emerald-100 text-emerald-800",
            outgoing: "bg-orange-100 text-orange-800",
            cash: "bg-green-100 text-green-800",
            check: "bg-blue-100 text-blue-800",
            bank_transfer: "bg-indigo-100 text-indigo-800",
            credit_card: "bg-purple-100 text-purple-800",
            wire_transfer: "bg-teal-100 text-teal-800",
            land: "bg-green-100 text-green-800",
            building: "bg-blue-100 text-blue-800",
            machinery: "bg-indigo-100 text-indigo-800",
            equipment: "bg-purple-100 text-purple-800",
            vehicles: "bg-orange-100 text-orange-800",
            furniture: "bg-pink-100 text-pink-800",
            computers: "bg-cyan-100 text-cyan-800",
            current: "bg-green-100 text-green-800",
            "1-30": "bg-yellow-100 text-yellow-800",
            "31-60": "bg-orange-100 text-orange-800",
            "61-90": "bg-red-100 text-red-800",
            "90+": "bg-red-200 text-red-900"
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

    const handleCreate = (type) => {
        setEditingItem(null);
        setActiveTab(type);
        setShowDialog(true);
    };

    const handleEdit = (item, type) => {
        if (item.status === 'pending_approval') {
            toast({
                title: "Cannot Edit",
                description: "This entry is pending approval and cannot be edited.",
                variant: "destructive"
            });
            return;
        }
        if (item.status === 'posted') {
            toast({
                title: "Cannot Edit",
                description: "This entry has been posted and cannot be edited. Please create a reversal entry instead.",
                variant: "destructive"
            });
            return;
        }
        setEditingItem(item);
        setActiveTab(type);
        setShowDialog(true);
    };

    const handleDelete = (item, entity) => {
        if (item.status === 'posted') {
            toast({
                title: "Cannot Delete",
                description: "Posted entries cannot be deleted. Please create a reversal entry instead.",
                variant: "destructive"
            });
            return;
        }
        if (item.status === 'pending_approval') {
            toast({
                title: "Cannot Delete",
                description: "Entries pending approval cannot be deleted. Please reject the approval first.",
                variant: "destructive"
            });
            return;
        }
        
        if (confirm(t('areYouSure'))) {
            deleteMutation.mutate({ entity, id: item.id });
        }
    };

    const handleCloseDialog = () => {
        setShowDialog(false);
        setEditingItem(null);
    };

    const handlePrint = (item, type) => {
        const printWindow = window.open('', '_blank');
        let content = '';
        
        if (type === 'Journal Entry') {
            content = `<html><head><title>Journal Entry</title><style>body{font-family:Arial,sans-serif;padding:40px}h1{color:#059669}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:10px;text-align:left}th{background-color:#f3f4f6}.debit{color:#059669}.credit{color:#dc2626}</style></head><body><h1>Journal Entry</h1><p><strong>JE #:</strong> ${item.journal_number}</p><p><strong>Posting Date:</strong> ${item.posting_date}</p><p><strong>Description:</strong> ${item.description || 'N/A'}</p><table><tr><th>Account Code</th><th>Account Name</th><th>Debit</th><th>Credit</th></tr><tr><td>${item.account_code || ''}</td><td>${item.account_name || 'N/A'}</td><td class="debit">LKR ${(item.debit_amount || 0).toFixed(2)}</td><td class="credit">LKR ${(item.credit_amount || 0).toFixed(2)}</td></tr></table><p style="margin-top:20px"><strong>Reference:</strong> ${item.reference || 'N/A'}</p></body></html>`;
        } else if (type === 'AR' || type === 'AP') {
            const isAR = type === 'AR';
            content = `<html><head><title>${isAR ? 'AR' : 'AP'}</title><style>body{font-family:Arial,sans-serif;padding:40px}h1{color:#059669}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:10px;text-align:left}th{background-color:#f3f4f6}.overdue{color:#dc2626;font-weight:bold}</style></head><body><h1>${isAR ? 'Accounts Receivable' : 'Accounts Payable'}</h1><p><strong>Number:</strong> ${item[isAR ? 'ar_number' : 'ap_number']}</p><p><strong>Invoice #:</strong> ${item[isAR ? 'invoice_number' : 'vendor_invoice_number']}</p><p><strong>${isAR ? 'Customer' : 'Vendor'}:</strong> ${item[isAR ? 'customer_name' : 'vendor_name']}</p><p><strong>Invoice Date:</strong> ${item.invoice_date}</p><p><strong>Due Date:</strong> ${item.due_date}</p><table><tr><th>Invoice Amount</th><th>Paid Amount</th><th>Outstanding</th><th>Aging</th></tr><tr><td>LKR ${(item.invoice_amount || 0).toFixed(2)}</td><td>LKR ${(item.paid_amount || 0).toFixed(2)}</td><td class="${item.aging_bucket && item.aging_bucket !== 'current' ? 'overdue' : ''}">LKR ${(item.outstanding_amount || 0).toFixed(2)}</td><td class="${item.aging_bucket && item.aging_bucket !== 'current' ? 'overdue' : ''}">${item.aging_bucket || 'N/A'}</td></tr></table><p style="margin-top:20px"><strong>Payment Terms:</strong> ${item.payment_terms || 'N/A'}</p></body></html>`;
        } else if (type === 'Payment') {
            content = `<html><head><title>Payment</title><style>body{font-family:Arial,sans-serif;padding:40px}h1{color:#059669}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:10px;text-align:left}th{background-color:#f3f4f6}</style></head><body><h1>Payment Receipt</h1><p><strong>Payment #:</strong> ${item.payment_number}</p><p><strong>Date:</strong> ${item.payment_date}</p><p><strong>Type:</strong> ${item.payment_type}</p><p><strong>${item.payment_type === 'incoming' ? 'From' : 'To'}:</strong> ${item.party_name}</p><table><tr><th>Amount</th><th>Method</th><th>Reference</th><th>Status</th></tr><tr><td>LKR ${(item.amount || 0).toFixed(2)}</td><td>${item.payment_method || 'N/A'}</td><td>${item.reference_number || 'N/A'}</td><td>${item.status || 'N/A'}</td></tr></table><p style="margin-top:20px"><strong>Bank Account:</strong> ${item.bank_account || 'N/A'}</p></body></html>`;
        } else if (type === 'Fixed Asset') {
            content = `<html><head><title>Fixed Asset</title><style>body{font-family:Arial,sans-serif;padding:40px}h1{color:#059669}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:10px;text-align:left}th{background-color:#f3f4f6}</style></head><body><h1>Fixed Asset Card</h1><p><strong>Asset #:</strong> ${item.asset_number}</p><p><strong>Name:</strong> ${item.asset_name}</p><p><strong>Class:</strong> ${item.asset_class}</p><table><tr><th>Acquisition Cost</th><th>Accumulated Depreciation</th><th>Net Book Value</th></tr><tr><td>LKR ${(item.acquisition_cost || 0).toFixed(2)}</td><td>LKR ${(item.accumulated_depreciation || 0).toFixed(2)}</td><td>LKR ${(item.net_book_value || 0).toFixed(2)}</td></tr></table><p style="margin-top:20px"><strong>Acquisition Date:</strong> ${item.acquisition_date}</p><p><strong>Useful Life:</strong> ${item.useful_life_years || 'N/A'} years</p><p><strong>Location:</strong> ${item.location_code || 'N/A'}</p></body></html>`;
        }
        
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.print();
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t('financeAccounting')}</h1>
                    <p className="text-gray-600 mt-1">GL, AR, AP, Assets & Comprehensive Financial Reporting</p>
                </div>
            </div>

            <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900">
                    <strong>VAT:</strong> Sri Lanka VAT rate is 18%. Ensure all transactions include proper VAT calculations.
                    <strong className="ml-4">Currency:</strong> All amounts are in LKR (Sri Lankan Rupee).
                </AlertDescription>
            </Alert>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-12 w-full">
                    <TabsTrigger value="gl">GL</TabsTrigger>
                    <TabsTrigger value="ar">AR</TabsTrigger>
                    <TabsTrigger value="ap">AP</TabsTrigger>
                    <TabsTrigger value="cash">Cash</TabsTrigger>
                    <TabsTrigger value="assets">Assets</TabsTrigger>
                    <TabsTrigger value="trial-balance">Trial</TabsTrigger>
                    <TabsTrigger value="pl">P&L</TabsTrigger>
                    <TabsTrigger value="balance">Balance</TabsTrigger>
                    <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
                    <TabsTrigger value="budget">Budget</TabsTrigger>
                    <TabsTrigger value="reports">Reports</TabsTrigger>
                    <TabsTrigger value="settings" className="flex items-center gap-1">
                        <Settings className="w-3 h-3" />Settings
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="gl">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>General Ledger - Journal Entries</CardTitle>
                            <Button 
                                onClick={() => handleCreate('gl')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} Journal Entry
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={journals}
                                columns={journalEntryColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'gl')}
                                onDelete={(item) => handleDelete(item, 'JournalEntry')}
                                onPrint={(item) => handlePrint(item, 'Journal Entry')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="ar">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Accounts Receivable</CardTitle>
                            <div className="flex gap-2">
                                <Button 
                                    onClick={() => setShowClearingDialog(true)}
                                    variant="outline"
                                    className="gap-2"
                                >
                                    <Receipt className="w-4 h-4" />
                                    Invoice Clearing (F-28)
                                </Button>
                                <Button 
                                    onClick={() => handleCreate('ar')}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    {t('new')} AR Entry
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={arTransactions}
                                columns={arColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'ar')}
                                onDelete={(item) => handleDelete(item, 'AccountsReceivable')}
                                onPrint={(item) => handlePrint(item, 'AR')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="ap">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Accounts Payable</CardTitle>
                            <Button 
                                onClick={() => handleCreate('ap')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} AP Entry
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={apTransactions}
                                columns={apColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'ap')}
                                onDelete={(item) => handleDelete(item, 'AccountsPayable')}
                                onPrint={(item) => handlePrint(item, 'AP')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="cash">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Bank Accounts</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <DataTable
                                    data={banks}
                                    columns={bankColumns}
                                    getBadgeColor={getBadgeColor}
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Payments</CardTitle>
                                <Button 
                                    onClick={() => handleCreate('cash')}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Record Payment
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <DataTable
                                    data={payments}
                                    columns={paymentColumns}
                                    getBadgeColor={getBadgeColor}
                                    onEdit={(item) => handleEdit(item, 'cash')}
                                    onDelete={(item) => handleDelete(item, 'Payment')}
                                    onPrint={(item) => handlePrint(item, 'Payment')}
                                />
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="assets">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('fixedAssets')} Register</CardTitle>
                            <Button 
                                onClick={() => handleCreate('assets')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} Asset
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={assets}
                                columns={assetColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'assets')}
                                onDelete={(item) => handleDelete(item, 'FixedAsset')}
                                onPrint={(item) => handlePrint(item, 'Fixed Asset')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="trial-balance">
                    <TrialBalanceReport />
                </TabsContent>

                <TabsContent value="pl">
                    <IncomeStatementReport />
                </TabsContent>

                <TabsContent value="balance">
                    <BalanceSheetReport />
                </TabsContent>

                <TabsContent value="cashflow">
                    <CashFlowStatementReport />
                </TabsContent>

                <TabsContent value="budget">
                    <BudgetVarianceReport />
                </TabsContent>

                <TabsContent value="reports">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>AR Aging Summary</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {['current', '1-30', '31-60', '61-90', '90+'].map(bucket => {
                                        const amount = arTransactions
                                            .filter(ar => ar.aging_bucket === bucket)
                                            .reduce((sum, ar) => sum + (ar.outstanding_amount || 0), 0);
                                        return (
                                            <div key={bucket} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                                                <span className="font-medium capitalize">{bucket} days</span>
                                                <span className="text-lg font-bold">LKR {amount.toLocaleString()}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>AP Aging Summary</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {['current', '1-30', '31-60', '61-90', '90+'].map(bucket => {
                                        const amount = apTransactions
                                            .filter(ap => ap.aging_bucket === bucket)
                                            .reduce((sum, ap) => sum + (ap.outstanding_amount || 0), 0);
                                        return (
                                            <div key={bucket} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                                                <span className="font-medium capitalize">{bucket} days</span>
                                                <span className="text-lg font-bold">LKR {amount.toLocaleString()}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Asset Depreciation Summary</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {['machinery', 'equipment', 'vehicles', 'building', 'other'].map(assetClass => {
                                        const classAssets = assets.filter(a => a.asset_class === assetClass);
                                        const totalCost = classAssets.reduce((sum, a) => sum + (a.acquisition_cost || 0), 0);
                                        const totalDep = classAssets.reduce((sum, a) => sum + (a.accumulated_depreciation || 0), 0);
                                        return totalCost > 0 ? (
                                            <div key={assetClass} className="p-3 bg-gray-50 rounded">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-medium capitalize">{assetClass}</span>
                                                    <span className="text-sm text-gray-600">{classAssets.length} assets</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span>Cost: LKR {totalCost.toLocaleString()}</span>
                                                    <span>Depreciation: LKR {totalDep.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        ) : null;
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Cash Flow Summary</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <div className="p-3 bg-green-50 rounded">
                                        <div className="text-sm text-gray-600">Cash Inflows</div>
                                        <div className="text-2xl font-bold text-green-700">
                                            LKR {payments
                                                .filter(p => p.payment_type === 'incoming' && p.status === 'cleared')
                                                .reduce((sum, p) => sum + (p.amount || 0), 0)
                                                .toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-red-50 rounded">
                                        <div className="text-sm text-gray-600">Cash Outflows</div>
                                        <div className="text-2xl font-bold text-red-700">
                                            LKR {payments
                                                .filter(p => p.payment_type === 'outgoing' && p.status === 'cleared')
                                                .reduce((sum, p) => sum + (p.amount || 0), 0)
                                                .toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-blue-50 rounded">
                                        <div className="text-sm text-gray-600">Net Cash Position</div>
                                        <div className="text-2xl font-bold text-blue-700">
                                            LKR {banks.reduce((sum, b) => sum + (b.current_balance || 0), 0).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="settings" className="space-y-6">
                    {/* GL Account Mapping */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="w-5 h-5 text-emerald-600" />
                                GL Account Mapping
                            </CardTitle>
                            <p className="text-sm text-gray-500 mt-1">
                                Configure which Chart of Accounts codes are used for automatic GL postings across all modules.
                            </p>
                        </CardHeader>
                        <CardContent>
                            <GLAccountMappingForm />
                        </CardContent>
                    </Card>

                    {/* Cost Centers */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <MapPin className="w-5 h-5 text-emerald-600" />
                                    Cost Centers
                                </CardTitle>
                                <p className="text-sm text-gray-500 mt-1">
                                    Define cost centers for departmental expense tracking. Assign them on journal entries.
                                </p>
                            </div>
                            <Button
                                onClick={() => { setEditingCostCenter(null); setShowCostCenterDialog(true); }}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                New Cost Center
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {costCenters.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 text-sm">
                                    No cost centers yet. Click "New Cost Center" to add one.
                                </div>
                            ) : (
                                <div className="rounded-md border overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="text-left px-4 py-2 font-medium text-gray-600">Code</th>
                                                <th className="text-left px-4 py-2 font-medium text-gray-600">Name</th>
                                                <th className="text-left px-4 py-2 font-medium text-gray-600">Manager</th>
                                                <th className="text-right px-4 py-2 font-medium text-gray-600">Budget (LKR)</th>
                                                <th className="text-center px-4 py-2 font-medium text-gray-600">Status</th>
                                                <th className="px-4 py-2"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {costCenters.map((cc) => (
                                                <tr key={cc.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-2 font-mono font-medium">{cc.cost_center_code}</td>
                                                    <td className="px-4 py-2">{cc.cost_center_name}</td>
                                                    <td className="px-4 py-2 text-gray-600">{cc.manager || '—'}</td>
                                                    <td className="px-4 py-2 text-right text-gray-600">
                                                        {cc.budget_amount ? `LKR ${Number(cc.budget_amount).toLocaleString()}` : '—'}
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                                            cc.status === 'active'
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-gray-100 text-gray-600'
                                                        }`}>
                                                            {cc.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2 text-right">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => { setEditingCostCenter(cc); setShowCostCenterDialog(true); }}
                                                        >
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-red-600 hover:text-red-700 ml-1"
                                                            onClick={() => {
                                                                if (confirm(`Delete cost center ${cc.cost_center_code}?`)) {
                                                                    matrixSales.entities.CostCenter.delete(cc.id)
                                                                        .then(() => queryClient.invalidateQueries({ queryKey: ['costCenters'] }));
                                                                }
                                                            }}
                                                        >
                                                            Delete
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {showDialog && activeTab === 'gl' && (
                <JournalEntryForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'ar' && (
                <ARForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'ap' && (
                <APForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'cash' && (
                <PaymentForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'assets' && (
                <FixedAssetForm item={editingItem} onClose={handleCloseDialog} />
            )}
            
            {showClearingDialog && (
                <InvoiceClearingDialog
                    open={showClearingDialog}
                    onClose={() => setShowClearingDialog(false)}
                />
            )}

            {showCostCenterDialog && (
                <CostCenterForm
                    item={editingCostCenter}
                    onClose={() => { setShowCostCenterDialog(false); setEditingCostCenter(null); }}
                />
            )}
        </div>
    );
}