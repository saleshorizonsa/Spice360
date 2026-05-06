import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
    DollarSign, 
    ShoppingCart,
    Package,
    Factory,
    CheckCircle2,
    Users,
    Shield,
    RefreshCw,
    FileCheck
} from "lucide-react";

// Financial Reports
import TrialBalanceReport from "../components/reports/TrialBalanceReport";
import GeneralLedgerReport from "../components/reports/GeneralLedgerReport";
import ARAgingReport from "../components/reports/ARAgingReport";
import APAgingReport from "../components/reports/APAgingReport";
import BankReconciliationReport from "../components/reports/BankReconciliationReport";
import FixedAssetReport from "../components/reports/FixedAssetReport";
import ProfitLossReport from "../components/reports/ProfitLossReport";
import BalanceSheetReport from "../components/reports/BalanceSheetReport";
import CashFlowReport from "../components/reports/CashFlowReport";
import CashForecastReport from "../components/reports/CashForecastReport";
import InterBranchReconciliationReport from "../components/reports/InterBranchReconciliationReport";

// Compliance Reports
import VATReturnReport from "../components/reports/VATReturnReport";
import ZATCAInvoiceLogsReport from "../components/reports/ZATCAInvoiceLogsReport";
import CreditDebitNoteRegister from "../components/reports/CreditDebitNoteRegister";
import WPSReport from "../components/reports/WPSReport";
import GOSIReport from "../components/reports/GOSIReport";
import NitaqatReport from "../components/reports/NitaqatReport";
import DocumentExpiryReport from "../components/reports/DocumentExpiryReport";
import DocumentArchivalReport from "../components/reports/DocumentArchivalReport";

// Sales Reports
import DailySalesRegister from "../components/reports/DailySalesRegister";
import MarginReport from "../components/reports/MarginReport";
import QuotationConversionReport from "../components/reports/QuotationConversionReport";
import PriceDiscountExceptionReport from "../components/reports/PriceDiscountExceptionReport";
import DSOCollectionsReport from "../components/reports/DSOCollectionsReport";
import ReturnRefundRegister from "../components/reports/ReturnRefundRegister";

// Inventory Reports
import StockOnHandReport from "../components/reports/StockOnHandReport";
import InventoryValuationReport from "../components/reports/InventoryValuationReport";
import StockAgingReport from "../components/reports/StockAgingReport";
import CycleCountVarianceReport from "../components/reports/CycleCountVarianceReport";
import STOInTransitReport from "../components/reports/STOInTransitReport";
import BatchTraceabilityReport from "../components/reports/BatchTraceabilityReport";
import OTIFFillRateReport from "../components/reports/OTIFFillRateReport";

// Manufacturing Reports
import MRPExceptionReport from "../components/reports/MRPExceptionReport";
import ProductionOrderStatusReport from "../components/reports/ProductionOrderStatusReport";
import YieldScrapReport from "../components/reports/YieldScrapReport";
import CostVarianceReport from "../components/reports/CostVarianceReport";
import CapacityLoadReport from "../components/reports/CapacityLoadReport";
import BackflushVarianceReport from "../components/reports/BackflushVarianceReport";

// Quality & Maintenance Reports
import InspectionResultsReport from "../components/reports/InspectionResultsReport";
import NCCAPARegister from "../components/reports/NCCAPARegister";
import COALogReport from "../components/reports/COALogReport";
import PMComplianceReport from "../components/reports/PMComplianceReport";
import BreakdownMaintenanceCostReport from "../components/reports/BreakdownMaintenanceCostReport";

// HR Reports
import PayrollRegisterReport from "../components/reports/PayrollRegisterReport";
import LeaveBalanceReport from "../components/reports/LeaveBalanceReport";
import OvertimeAllowanceReport from "../components/reports/OvertimeAllowanceReport";
import EOSProvisionReport from "../components/reports/EOSProvisionReport";

// IT & Security Reports
import UserRolesMatrixReport from "../components/reports/UserRolesMatrixReport";
import MasterDataChangesReport from "../components/reports/MasterDataChangesReport";
import DocumentNumberingGapsReport from "../components/reports/DocumentNumberingGapsReport";
import IntegrationErrorLogReport from "../components/reports/IntegrationErrorLogReport";
import BackupVerificationReport from "../components/reports/BackupVerificationReport";

export default function Reports() {
    const [activeCategory, setActiveCategory] = useState("financial");
    const [activeReport, setActiveReport] = useState("trial_balance");

    // Fetch summary data for KPIs
    const { data: sales = [] } = useQuery({
        queryKey: ['salesOrders'],
        queryFn: () => base44.entities.SalesOrder.list(),
        initialData: []
    });

    const { data: stockLevels = [] } = useQuery({
        queryKey: ['stockLevels'],
        queryFn: () => base44.entities.StockLevel.list(),
        initialData: []
    });

    const { data: productions = [] } = useQuery({
        queryKey: ['productions'],
        queryFn: () => base44.entities.ProductionOrder.list(),
        initialData: []
    });

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.list(),
        initialData: []
    });

    // Calculate KPIs
    const totalRevenue = sales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const totalStockValue = stockLevels.reduce((sum, s) => sum + ((s.quantity || 0) * (s.unit_cost || 0)), 0);
    const activeProduction = productions.filter(p => p.status === 'in_progress').length;
    const activeEmployees = employees.filter(e => e.employment_status === 'active').length;

    const reportCategories = [
        { id: "financial", name: "Financial", icon: DollarSign, color: "emerald" },
        { id: "compliance", name: "Compliance", icon: FileCheck, color: "blue" },
        { id: "sales", name: "Sales", icon: ShoppingCart, color: "purple" },
        { id: "inventory", name: "Inventory", icon: Package, color: "amber" },
        { id: "manufacturing", name: "Manufacturing", icon: Factory, color: "indigo" },
        { id: "quality", name: "Quality & Maintenance", icon: CheckCircle2, color: "green" },
        { id: "hr", name: "HR & Payroll", icon: Users, color: "pink" },
        { id: "it", name: "IT & Security", icon: Shield, color: "red" }
    ];

    const renderReportContent = () => {
        switch (activeCategory) {
            case "financial":
                return (
                    <Tabs value={activeReport} onValueChange={setActiveReport} className="space-y-6">
                        <TabsList className="grid grid-cols-3 lg:grid-cols-6 w-full">
                            <TabsTrigger value="trial_balance">Trial Balance</TabsTrigger>
                            <TabsTrigger value="general_ledger">General Ledger</TabsTrigger>
                            <TabsTrigger value="ar_aging">AR Aging</TabsTrigger>
                            <TabsTrigger value="ap_aging">AP Aging</TabsTrigger>
                            <TabsTrigger value="bank_recon">Bank Reconciliation</TabsTrigger>
                            <TabsTrigger value="fixed_assets">Fixed Assets</TabsTrigger>
                            <TabsTrigger value="profit_loss">P&L Statement</TabsTrigger>
                            <TabsTrigger value="balance_sheet">Balance Sheet</TabsTrigger>
                            <TabsTrigger value="cash_flow">Cash Flow</TabsTrigger>
                            <TabsTrigger value="cash_forecast">Cash Forecast</TabsTrigger>
                            <TabsTrigger value="inter_branch">Inter-Branch</TabsTrigger>
                        </TabsList>

                        <TabsContent value="trial_balance"><TrialBalanceReport /></TabsContent>
                        <TabsContent value="general_ledger"><GeneralLedgerReport /></TabsContent>
                        <TabsContent value="ar_aging"><ARAgingReport /></TabsContent>
                        <TabsContent value="ap_aging"><APAgingReport /></TabsContent>
                        <TabsContent value="bank_recon"><BankReconciliationReport /></TabsContent>
                        <TabsContent value="fixed_assets"><FixedAssetReport /></TabsContent>
                        <TabsContent value="profit_loss"><ProfitLossReport /></TabsContent>
                        <TabsContent value="balance_sheet"><BalanceSheetReport /></TabsContent>
                        <TabsContent value="cash_flow"><CashFlowReport /></TabsContent>
                        <TabsContent value="cash_forecast"><CashForecastReport /></TabsContent>
                        <TabsContent value="inter_branch"><InterBranchReconciliationReport /></TabsContent>
                    </Tabs>
                );

            case "compliance":
                return (
                    <Tabs value={activeReport} onValueChange={setActiveReport} className="space-y-6">
                        <TabsList className="grid grid-cols-2 lg:grid-cols-4 w-full">
                            <TabsTrigger value="vat_return">VAT Return</TabsTrigger>
                            <TabsTrigger value="zatca_logs">ZATCA Logs</TabsTrigger>
                            <TabsTrigger value="credit_debit">Credit/Debit Notes</TabsTrigger>
                            <TabsTrigger value="wps">WPS</TabsTrigger>
                            <TabsTrigger value="gosi">GOSI</TabsTrigger>
                            <TabsTrigger value="nitaqat">Nitaqat</TabsTrigger>
                            <TabsTrigger value="doc_expiry">Document Expiry</TabsTrigger>
                            <TabsTrigger value="archival">Document Archival</TabsTrigger>
                        </TabsList>

                        <TabsContent value="vat_return"><VATReturnReport /></TabsContent>
                        <TabsContent value="zatca_logs"><ZATCAInvoiceLogsReport /></TabsContent>
                        <TabsContent value="credit_debit"><CreditDebitNoteRegister /></TabsContent>
                        <TabsContent value="wps"><WPSReport /></TabsContent>
                        <TabsContent value="gosi"><GOSIReport /></TabsContent>
                        <TabsContent value="nitaqat"><NitaqatReport /></TabsContent>
                        <TabsContent value="doc_expiry"><DocumentExpiryReport /></TabsContent>
                        <TabsContent value="archival"><DocumentArchivalReport /></TabsContent>
                    </Tabs>
                );

            case "sales":
                return (
                    <Tabs value={activeReport} onValueChange={setActiveReport} className="space-y-6">
                        <TabsList className="grid grid-cols-3 lg:grid-cols-6 w-full">
                            <TabsTrigger value="daily_sales">Daily Sales</TabsTrigger>
                            <TabsTrigger value="margin">Margin Analysis</TabsTrigger>
                            <TabsTrigger value="conversion">Quote Conversion</TabsTrigger>
                            <TabsTrigger value="exceptions">Price Exceptions</TabsTrigger>
                            <TabsTrigger value="dso">DSO & Collections</TabsTrigger>
                            <TabsTrigger value="returns">Returns & Refunds</TabsTrigger>
                        </TabsList>

                        <TabsContent value="daily_sales"><DailySalesRegister /></TabsContent>
                        <TabsContent value="margin"><MarginReport /></TabsContent>
                        <TabsContent value="conversion"><QuotationConversionReport /></TabsContent>
                        <TabsContent value="exceptions"><PriceDiscountExceptionReport /></TabsContent>
                        <TabsContent value="dso"><DSOCollectionsReport /></TabsContent>
                        <TabsContent value="returns"><ReturnRefundRegister /></TabsContent>
                    </Tabs>
                );

            case "inventory":
                return (
                    <Tabs value={activeReport} onValueChange={setActiveReport} className="space-y-6">
                        <TabsList className="grid grid-cols-2 lg:grid-cols-4 w-full">
                            <TabsTrigger value="stock_on_hand">Stock on Hand</TabsTrigger>
                            <TabsTrigger value="valuation">Inventory Valuation</TabsTrigger>
                            <TabsTrigger value="aging">Stock Aging</TabsTrigger>
                            <TabsTrigger value="cycle_count">Cycle Count Variance</TabsTrigger>
                            <TabsTrigger value="sto_transit">STO In-Transit</TabsTrigger>
                            <TabsTrigger value="traceability">Batch Traceability</TabsTrigger>
                            <TabsTrigger value="otif">OTIF / Fill Rate</TabsTrigger>
                        </TabsList>

                        <TabsContent value="stock_on_hand"><StockOnHandReport /></TabsContent>
                        <TabsContent value="valuation"><InventoryValuationReport /></TabsContent>
                        <TabsContent value="aging"><StockAgingReport /></TabsContent>
                        <TabsContent value="cycle_count"><CycleCountVarianceReport /></TabsContent>
                        <TabsContent value="sto_transit"><STOInTransitReport /></TabsContent>
                        <TabsContent value="traceability"><BatchTraceabilityReport /></TabsContent>
                        <TabsContent value="otif"><OTIFFillRateReport /></TabsContent>
                    </Tabs>
                );

            case "manufacturing":
                return (
                    <Tabs value={activeReport} onValueChange={setActiveReport} className="space-y-6">
                        <TabsList className="grid grid-cols-3 lg:grid-cols-6 w-full">
                            <TabsTrigger value="mrp_exception">MRP Exceptions</TabsTrigger>
                            <TabsTrigger value="prod_status">Production Status</TabsTrigger>
                            <TabsTrigger value="yield_scrap">Yield & Scrap</TabsTrigger>
                            <TabsTrigger value="cost_variance">Cost Variance</TabsTrigger>
                            <TabsTrigger value="capacity">Capacity Load</TabsTrigger>
                            <TabsTrigger value="backflush">Backflush Variance</TabsTrigger>
                        </TabsList>

                        <TabsContent value="mrp_exception"><MRPExceptionReport /></TabsContent>
                        <TabsContent value="prod_status"><ProductionOrderStatusReport /></TabsContent>
                        <TabsContent value="yield_scrap"><YieldScrapReport /></TabsContent>
                        <TabsContent value="cost_variance"><CostVarianceReport /></TabsContent>
                        <TabsContent value="capacity"><CapacityLoadReport /></TabsContent>
                        <TabsContent value="backflush"><BackflushVarianceReport /></TabsContent>
                    </Tabs>
                );

            case "quality":
                return (
                    <Tabs value={activeReport} onValueChange={setActiveReport} className="space-y-6">
                        <TabsList className="grid grid-cols-2 lg:grid-cols-5 w-full">
                            <TabsTrigger value="inspection">Inspection Results</TabsTrigger>
                            <TabsTrigger value="nc_capa">NC & CAPA</TabsTrigger>
                            <TabsTrigger value="coa">COA Log</TabsTrigger>
                            <TabsTrigger value="pm_compliance">PM Compliance</TabsTrigger>
                            <TabsTrigger value="breakdown">Breakdown & Cost</TabsTrigger>
                        </TabsList>

                        <TabsContent value="inspection"><InspectionResultsReport /></TabsContent>
                        <TabsContent value="nc_capa"><NCCAPARegister /></TabsContent>
                        <TabsContent value="coa"><COALogReport /></TabsContent>
                        <TabsContent value="pm_compliance"><PMComplianceReport /></TabsContent>
                        <TabsContent value="breakdown"><BreakdownMaintenanceCostReport /></TabsContent>
                    </Tabs>
                );

            case "hr":
                return (
                    <Tabs value={activeReport} onValueChange={setActiveReport} className="space-y-6">
                        <TabsList className="grid grid-cols-2 lg:grid-cols-4 w-full">
                            <TabsTrigger value="payroll">Payroll Register</TabsTrigger>
                            <TabsTrigger value="leave">Leave Balance</TabsTrigger>
                            <TabsTrigger value="overtime">Overtime & Allowances</TabsTrigger>
                            <TabsTrigger value="eos">EOS Provision</TabsTrigger>
                        </TabsList>

                        <TabsContent value="payroll"><PayrollRegisterReport /></TabsContent>
                        <TabsContent value="leave"><LeaveBalanceReport /></TabsContent>
                        <TabsContent value="overtime"><OvertimeAllowanceReport /></TabsContent>
                        <TabsContent value="eos"><EOSProvisionReport /></TabsContent>
                    </Tabs>
                );

            case "it":
                return (
                    <Tabs value={activeReport} onValueChange={setActiveReport} className="space-y-6">
                        <TabsList className="grid grid-cols-2 lg:grid-cols-5 w-full">
                            <TabsTrigger value="user_roles">User/Roles Matrix</TabsTrigger>
                            <TabsTrigger value="master_data">Master Data Changes</TabsTrigger>
                            <TabsTrigger value="numbering">Numbering Gaps</TabsTrigger>
                            <TabsTrigger value="integration">Integration Errors</TabsTrigger>
                            <TabsTrigger value="backup">Backup Verification</TabsTrigger>
                        </TabsList>

                        <TabsContent value="user_roles"><UserRolesMatrixReport /></TabsContent>
                        <TabsContent value="master_data"><MasterDataChangesReport /></TabsContent>
                        <TabsContent value="numbering"><DocumentNumberingGapsReport /></TabsContent>
                        <TabsContent value="integration"><IntegrationErrorLogReport /></TabsContent>
                        <TabsContent value="backup"><BackupVerificationReport /></TabsContent>
                    </Tabs>
                );

            default:
                return null;
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Reports Center</h1>
                    <p className="text-gray-600 mt-1">Comprehensive reporting across all business functions</p>
                </div>
                <Button variant="outline" className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Refresh Data
                </Button>
            </div>

            {/* KPI Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-emerald-100">Total Revenue</p>
                                <p className="text-2xl font-bold">
                                    SAR {(totalRevenue / 1000000).toFixed(1)}M
                                </p>
                            </div>
                            <DollarSign className="w-8 h-8 text-emerald-100" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-blue-100">Stock Value</p>
                                <p className="text-2xl font-bold">
                                    SAR {(totalStockValue / 1000000).toFixed(1)}M
                                </p>
                            </div>
                            <Package className="w-8 h-8 text-blue-100" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-purple-100">Active Production</p>
                                <p className="text-2xl font-bold">{activeProduction}</p>
                            </div>
                            <Factory className="w-8 h-8 text-purple-100" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-pink-500 to-pink-600 text-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-pink-100">Employees</p>
                                <p className="text-2xl font-bold">{activeEmployees}</p>
                            </div>
                            <Users className="w-8 h-8 text-pink-100" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Report Category Selection */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                {reportCategories.map((category) => {
                    const Icon = category.icon;
                    const isActive = activeCategory === category.id;
                    return (
                        <Card
                            key={category.id}
                            className={`cursor-pointer transition-all hover:shadow-lg ${
                                isActive
                                    ? 'ring-2 ring-emerald-500 bg-emerald-50'
                                    : 'hover:bg-gray-50'
                            }`}
                            onClick={() => {
                                setActiveCategory(category.id);
                                setActiveReport(
                                    category.id === "financial" ? "trial_balance" :
                                    category.id === "compliance" ? "vat_return" :
                                    category.id === "sales" ? "daily_sales" :
                                    category.id === "inventory" ? "stock_on_hand" :
                                    category.id === "manufacturing" ? "mrp_exception" :
                                    category.id === "quality" ? "inspection" :
                                    category.id === "hr" ? "payroll" :
                                    "user_roles"
                                );
                            }}
                        >
                            <CardContent className="p-4 text-center">
                                <Icon className={`w-8 h-8 mx-auto mb-2 ${
                                    isActive ? 'text-emerald-600' : 'text-gray-600'
                                }`} />
                                <p className={`text-sm font-medium ${
                                    isActive ? 'text-emerald-900' : 'text-gray-900'
                                }`}>
                                    {category.name}
                                </p>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Report Content */}
            <div className="bg-white rounded-lg shadow-sm">
                {renderReportContent()}
            </div>
        </div>
    );
}