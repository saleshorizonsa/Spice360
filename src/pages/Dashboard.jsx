import React, { useMemo, useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    AlertTriangle,
    BarChart3,
    Bot,
    Briefcase,
    Building2,
    Calculator,
    CheckCircle2,
    Clock,
    Database,
    DollarSign,
    Factory,
    FileCheck,
    FileText,
    Landmark,
    Package2,
    Receipt,
    Recycle,
    Settings,
    Shield,
    ShoppingCart,
    Target,
    TrendingDown,
    TrendingUp,
    Truck,
    Users,
    Warehouse
} from "lucide-react";
import StatCard from "@/components/erp/StatCard";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePermissions } from "@/components/utils/usePermissions";
import { useLanguage } from "@/components/utils/languageContext";

const toList = (value) => (Array.isArray(value) ? value : []);
const sumBy = (items, key) => items.reduce((sum, item) => sum + (Number(item?.[key]) || 0), 0);
const formatSar = (value) => `SAR ${(Number(value) || 0).toLocaleString()}`;
const formatSarM = (value) => `SAR ${((Number(value) || 0) / 1000000).toFixed(1)}M`;

function useEntityList(entityName, queryKey, sort, limit) {
    return useQuery({
        queryKey,
        queryFn: () => matrixSales.entities[entityName].list(sort, limit),
        initialData: []
    });
}

function useOptionalEntityList(entityName, queryKey, sort, limit) {
    return useQuery({
        queryKey,
        queryFn: async () => {
            try {
                return await matrixSales.entities[entityName].list(sort, limit);
            } catch (error) {
                if (/does not exist|not found|period_close/i.test(error.message || "")) return [];
                throw error;
            }
        },
        initialData: []
    });
}

const ManagementCard = ({ title, value, description, icon: Icon, color = "blue", to }) => {
    const colorMap = {
        blue: "bg-blue-50 text-blue-700 ring-blue-100",
        emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
        indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100",
        amber: "bg-amber-50 text-amber-700 ring-amber-100",
        red: "bg-red-50 text-red-700 ring-red-100",
        purple: "bg-purple-50 text-purple-700 ring-purple-100",
        slate: "bg-slate-50 text-slate-700 ring-slate-100"
    };

    const content = (
        <Card className="h-full border-slate-200 bg-white transition-shadow hover:shadow-md">
            <CardContent className="flex h-full flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className={`rounded-xl p-3 ring-1 ${colorMap[color] || colorMap.blue}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Dashboard
                    </span>
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-500">{title}</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
                    {description && <p className="mt-2 text-sm text-slate-600">{description}</p>}
                </div>
            </CardContent>
        </Card>
    );

    if (!to) return content;

    return (
        <Link to={createPageUrl(to)} className="block h-full">
            {content}
        </Link>
    );
};

const ModuleCards = ({ cards }) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
            <ManagementCard key={`${card.title}-${card.to || "static"}`} {...card} />
        ))}
    </div>
);

function OverviewCards() {
    const { isAdmin, hasPermission, getRoleNames } = usePermissions();
    const { t } = useLanguage();

    const { data: assets = [] } = useEntityList("FixedAsset", ["dashboard-assets"]);
    const { data: salesOrders = [] } = useEntityList("SalesOrder", ["dashboard-sales-orders"], "-order_date", 10);
    const { data: maintenance = [] } = useEntityList("AssetMaintenance", ["dashboard-maintenance"], "-maintenance_date", 20);
    const { data: approvalRequests = [] } = useEntityList("ApprovalRequest", ["dashboard-approval-requests"], "-created_date", 10);
    const { data: verificationTasks = [] } = useEntityList("AssetVerificationTask", ["dashboard-verification-tasks"], "-scheduled_date", 5);

    const assetList = toList(assets);
    const salesOrderList = toList(salesOrders);
    const maintenanceList = toList(maintenance);
    const approvalRequestList = toList(approvalRequests);
    const verificationTaskList = toList(verificationTasks);

    const activeAssets = assetList.filter(a => a.status === "active").length;
    const totalAssetValue = sumBy(assetList, "acquisition_cost");
    const totalNBV = sumBy(assetList, "net_book_value");
    const pendingSalesOrders = salesOrderList.filter(o => o.status === "pending_approval" || o.status === "draft").length;
    const overdueMaintenance = maintenanceList.filter(m => m.status === "scheduled" && new Date(m.scheduled_date) < new Date()).length;
    const pendingApprovals = approvalRequestList.filter(a => a.status === "pending").length;
    const overdueVerifications = verificationTaskList.filter(t => t.status === "scheduled" && new Date(t.scheduled_date) < new Date()).length;

    return (
        <div className="space-y-4 md:space-y-6">
            {!isAdmin && getRoleNames().length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {getRoleNames().map((roleName, idx) => (
                        <Badge key={idx} variant="outline">{roleName}</Badge>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-4">
                {hasPermission("finance.fixed_asset", "view") && (
                    <>
                        <StatCard title={`${t("active")} Assets`} value={activeAssets} icon={Package2} trend={`${formatSarM(totalAssetValue)} total value`} color="emerald" />
                        <StatCard title={t("netBookValue")} value={formatSarM(totalNBV)} icon={TrendingDown} trend="Current valuation" color="blue" />
                    </>
                )}
                {hasPermission("sales.sales_order", "view") && (
                    <StatCard title={`${t("pending")} Sales Orders`} value={pendingSalesOrders} icon={ShoppingCart} trend="Awaiting processing" color="indigo" />
                )}
                {(hasPermission("maintenance.work_order", "view") || hasPermission("finance.fixed_asset", "view")) && (
                    <StatCard title={`${t("overdue")} ${t("maintenance")}`} value={overdueMaintenance} icon={AlertTriangle} trend="Requires attention" color="red" />
                )}
            </div>

            <div className="space-y-3">
                {pendingApprovals > 0 && (
                    <Alert className="border-yellow-200 bg-yellow-50">
                        <Clock className="h-4 w-4 text-yellow-600" />
                        <AlertDescription className="text-yellow-900">
                            <strong>{pendingApprovals} approval requests</strong> are waiting for review
                            <Link to={createPageUrl("Approvals")} className="ml-2 font-semibold underline">View {t("approvals")}</Link>
                        </AlertDescription>
                    </Alert>
                )}
                {overdueVerifications > 0 && hasPermission("finance.fixed_asset", "view") && (
                    <Alert className="border-orange-200 bg-orange-50">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-orange-900">
                            <strong>{overdueVerifications} asset verification tasks</strong> are {t("overdue")}
                            <Link to={createPageUrl("AssetVerification")} className="ml-2 font-semibold underline">View Verifications</Link>
                        </AlertDescription>
                    </Alert>
                )}
            </div>

            <ModuleCards
                cards={[
                    { title: "Sales", value: pendingSalesOrders, description: "Pending sales orders", icon: ShoppingCart, color: "indigo", to: "Sales" },
                    { title: "Finance", value: formatSarM(totalNBV), description: "Net book value", icon: DollarSign, color: "blue", to: "Finance" },
                    { title: "Assets", value: activeAssets, description: "Active fixed assets", icon: Package2, color: "emerald", to: "FixedAssets" },
                    { title: "Approvals", value: pendingApprovals, description: "Pending approval requests", icon: Clock, color: "amber", to: "Approvals" },
                    { title: "Admin Center", value: isAdmin ? "Open" : "Restricted", description: "System setup and access", icon: Shield, color: "slate", to: "AdminCenter" }
                ]}
            />
        </div>
    );
}

function ControlCenterCards() {
    const today = new Date().toISOString().slice(0, 10);
    const { data: approvals = [] } = useEntityList("ApprovalRequest", ["dashboard-control-approvals"], "-request_date");
    const { data: ar = [] } = useEntityList("AccountsReceivable", ["dashboard-control-ar"], "-due_date");
    const { data: ap = [] } = useEntityList("AccountsPayable", ["dashboard-control-ap"], "-due_date");
    const { data: stock = [] } = useEntityList("StockLevel", ["dashboard-control-stock"], "-aging_days");
    const { data: zatca = [] } = useEntityList("ZATCASubmissionLog", ["dashboard-control-zatca"], "-submission_date");
    const { data: documentSeries = [] } = useEntityList("DocumentNumberSeries", ["dashboard-control-document-series"]);
    const { data: periods = [] } = useOptionalEntityList("PeriodClose", ["dashboard-control-period-close"], "-period_start");

    const approvalList = toList(approvals);
    const arList = toList(ar);
    const apList = toList(ap);
    const stockList = toList(stock);
    const zatcaList = toList(zatca);
    const seriesList = toList(documentSeries);
    const periodList = toList(periods);

    const pendingApprovals = approvalList.filter((item) => item.status === "pending").length;
    const overdueReceivables = arList.filter((item) => {
        const status = String(item.payment_status || item.status || "").toLowerCase();
        return status !== "paid" && item.due_date && item.due_date < today;
    });
    const overduePayables = apList.filter((item) => {
        const status = String(item.payment_status || item.status || "").toLowerCase();
        return status !== "paid" && item.due_date && item.due_date < today;
    });
    const lowStock = stockList.filter((item) => {
        const available = Number(item.available_quantity ?? item.quantity ?? 0);
        const reorderLevel = Number(item.reorder_level ?? item.minimum_stock ?? 10);
        return available <= reorderLevel;
    });
    const zatcaFailures = zatcaList.filter((item) => {
        const values = [
            item.status,
            item.validation_status,
            item.clearance_status,
            item.reporting_status,
            item.submission_status
        ].map((value) => String(value || "").toLowerCase());
        return values.some((value) => ["failed", "fail", "rejected", "error"].includes(value)) || Number(item.response_status_code) >= 400;
    });
    const numberingRisks = seriesList.filter((item) => {
        const status = String(item.status || "").toLowerCase();
        const current = Number(item.current_number || 0);
        const ending = Number(item.ending_number || item.max_number || 0);
        return status === "exhausted" || (ending > 0 && ending - current <= 100);
    });
    const closedPeriods = periodList.filter((item) => item.status === "closed").length;

    return (
        <div className="space-y-4">
            <Alert className="border-blue-200 bg-blue-50">
                <Shield className="h-4 w-4 text-blue-700" />
                <AlertDescription className="text-blue-900">
                    Management control cards for exceptions that need action before month end, audit review, or compliance filing.
                </AlertDescription>
            </Alert>

            <ModuleCards
                cards={[
                    {
                        title: "Pending Approvals",
                        value: pendingApprovals,
                        description: "Documents waiting for authorization",
                        icon: Clock,
                        color: pendingApprovals > 0 ? "amber" : "emerald",
                        to: "Approvals"
                    },
                    {
                        title: "Overdue Receivables",
                        value: formatSar(sumBy(overdueReceivables, "outstanding_amount")),
                        description: `${overdueReceivables.length} customer balances past due`,
                        icon: TrendingUp,
                        color: overdueReceivables.length > 0 ? "red" : "emerald",
                        to: "Finance"
                    },
                    {
                        title: "Overdue Payables",
                        value: formatSar(sumBy(overduePayables, "outstanding_amount")),
                        description: `${overduePayables.length} vendor balances past due`,
                        icon: TrendingDown,
                        color: overduePayables.length > 0 ? "amber" : "emerald",
                        to: "Finance"
                    },
                    {
                        title: "Low Stock Items",
                        value: lowStock.length,
                        description: "Materials at or below reorder level",
                        icon: Warehouse,
                        color: lowStock.length > 0 ? "red" : "emerald",
                        to: "Inventory"
                    },
                    {
                        title: "ZATCA Exceptions",
                        value: zatcaFailures.length,
                        description: "Failed or rejected e-invoice submissions",
                        icon: FileCheck,
                        color: zatcaFailures.length > 0 ? "red" : "emerald",
                        to: "ZATCA"
                    },
                    {
                        title: "Numbering Risks",
                        value: numberingRisks.length,
                        description: "Series exhausted or close to ending",
                        icon: FileText,
                        color: numberingRisks.length > 0 ? "amber" : "emerald",
                        to: "AdminCenter"
                    },
                    {
                        title: "Closed Periods",
                        value: closedPeriods,
                        description: "Locked periods active in the system",
                        icon: Shield,
                        color: closedPeriods > 0 ? "slate" : "blue",
                        to: "AdminCenter"
                    },
                    {
                        title: "Audit Trail",
                        value: "Review",
                        description: "Monitor critical record changes",
                        icon: Database,
                        color: "purple",
                        to: "AdminCenter"
                    }
                ]}
            />
        </div>
    );
}

function SalesCards() {
    const { data: quotations = [] } = useEntityList("Quotation", ["dashboard-quotations"], "-quotation_date");
    const { data: orders = [] } = useEntityList("SalesOrder", ["dashboard-sales"], "-order_date");
    const { data: deliveries = [] } = useEntityList("Delivery", ["dashboard-deliveries"], "-delivery_date");
    const { data: invoices = [] } = useEntityList("Invoice", ["dashboard-invoices"], "-invoice_date");
    const quotationList = toList(quotations);
    const orderList = toList(orders);
    const deliveryList = toList(deliveries);
    const invoiceList = toList(invoices);

    return <ModuleCards cards={[
        { title: "Quotations", value: quotationList.length, description: `${quotationList.filter(q => q.status === "accepted" || q.status === "converted").length} accepted or converted`, icon: FileText, color: "blue", to: "Sales" },
        { title: "Sales Orders", value: orderList.length, description: `${formatSar(sumBy(orderList, "total_amount"))} total order value`, icon: ShoppingCart, color: "indigo", to: "Sales" },
        { title: "Deliveries", value: deliveryList.filter(d => d.status === "pending" || d.status === "in_transit").length, description: "Pending or in transit", icon: Truck, color: "amber", to: "Sales" },
        { title: "Invoices", value: invoiceList.filter(i => i.payment_status === "unpaid" || i.payment_status === "overdue").length, description: "Unpaid or overdue", icon: Receipt, color: "red", to: "Sales" },
        { title: "POS", value: "Open", description: "Point of sale workspace", icon: DollarSign, color: "emerald", to: "POS" },
        { title: "Sales Reports", value: "Reports", description: "Sales analytics and exports", icon: BarChart3, color: "purple", to: "SalesReports" }
    ]} />;
}

function FinanceCards() {
    const { data: ar = [] } = useEntityList("AccountsReceivable", ["dashboard-ar"], "-invoice_date");
    const { data: ap = [] } = useEntityList("AccountsPayable", ["dashboard-ap"], "-invoice_date");
    const { data: payments = [] } = useEntityList("Payment", ["dashboard-payments"], "-payment_date");
    const { data: assets = [] } = useEntityList("FixedAsset", ["dashboard-finance-assets"], "-acquisition_date");
    const arList = toList(ar);
    const apList = toList(ap);
    const paymentList = toList(payments);
    const assetList = toList(assets);

    return <ModuleCards cards={[
        { title: "Accounts Receivable", value: formatSar(sumBy(arList, "outstanding_amount")), description: `${arList.filter(x => x.status === "overdue").length} overdue records`, icon: TrendingUp, color: "blue", to: "Finance" },
        { title: "Accounts Payable", value: formatSar(sumBy(apList, "outstanding_amount")), description: "Outstanding payable balance", icon: TrendingDown, color: "amber", to: "Finance" },
        { title: "Payments", value: paymentList.length, description: "Payment records", icon: Receipt, color: "emerald", to: "Finance" },
        { title: "Fixed Assets", value: formatSarM(sumBy(assetList, "net_book_value")), description: `${assetList.filter(a => a.status === "active").length} active assets`, icon: Building2, color: "indigo", to: "FixedAssets" },
        { title: "Treasury", value: "Open", description: "Bank and cash management", icon: Landmark, color: "slate", to: "TreasuryManagement" },
        { title: "Finance Reports", value: "Reports", description: "Statements and variance reports", icon: BarChart3, color: "purple", to: "FinancialReports" }
    ]} />;
}

function InventoryCards() {
    const { data: stock = [] } = useEntityList("StockLevel", ["dashboard-stock"], "-aging_days");
    const { data: movements = [] } = useEntityList("StockMovement", ["dashboard-movements"], "-movement_date");
    const { data: counts = [] } = useEntityList("CycleCount", ["dashboard-cycle-counts"], "-count_date");
    const { data: inspections = [] } = useEntityList("InspectionLot", ["dashboard-inspections"], "-inspection_date");
    const stockList = toList(stock);
    const movementList = toList(movements);
    const countList = toList(counts);
    const inspectionList = toList(inspections);

    return <ModuleCards cards={[
        { title: "Stock Value", value: formatSar(sumBy(stockList, "total_value")), description: `${sumBy(stockList, "quantity").toLocaleString()} total quantity`, icon: Warehouse, color: "emerald", to: "Inventory" },
        { title: "Low Stock", value: stockList.filter(s => (s.available_quantity || 0) <= 10).length, description: "Materials needing attention", icon: AlertTriangle, color: "red", to: "Inventory" },
        { title: "Movements", value: movementList.length, description: "Stock movement records", icon: Truck, color: "blue", to: "Inventory" },
        { title: "Cycle Counts", value: countList.filter(c => c.status === "in_progress" || c.status === "planned").length, description: "Planned or in progress", icon: Calculator, color: "amber", to: "Inventory" },
        { title: "Quality Inspections", value: inspectionList.length, description: "Inspection lots", icon: CheckCircle2, color: "indigo", to: "Quality" },
        { title: "Inventory Reports", value: "Reports", description: "Valuation and stock reports", icon: BarChart3, color: "purple", to: "InventoryReports" }
    ]} />;
}

function OperationsCards() {
    const { data: production = [] } = useEntityList("ProductionOrder", ["dashboard-production"], "-planned_start_date");
    const { data: workOrders = [] } = useEntityList("WorkOrder", ["dashboard-work-orders"], "-scheduled_date");
    const { data: equipment = [] } = useEntityList("Equipment", ["dashboard-equipment"]);
    const { data: verifications = [] } = useEntityList("AssetVerificationTask", ["dashboard-asset-verification"], "-scheduled_date");

    return <ModuleCards cards={[
        { title: "Production Orders", value: toList(production).length, description: "Manufacturing workload", icon: Factory, color: "indigo", to: "Production" },
        { title: "Work Orders", value: toList(workOrders).filter(w => w.status === "open" || w.status === "in_progress").length, description: "Open or in progress", icon: Settings, color: "amber", to: "Production" },
        { title: "Equipment", value: toList(equipment).filter(e => e.status === "active").length, description: "Active equipment", icon: Database, color: "emerald", to: "Production" },
        { title: "Asset Verification", value: toList(verifications).filter(v => v.status === "scheduled").length, description: "Scheduled verification tasks", icon: CheckCircle2, color: "blue", to: "AssetVerification" },
        { title: "Manufacturing Reports", value: "Reports", description: "Production performance reports", icon: BarChart3, color: "purple", to: "ManufacturingReports" }
    ]} />;
}

function SupplyChainCards() {
    const { data: requisitions = [] } = useEntityList("PurchaseRequisition", ["dashboard-pr"], "-request_date");
    const { data: orders = [] } = useEntityList("PurchaseOrder", ["dashboard-po"], "-order_date");
    const { data: grn = [] } = useEntityList("GoodsReceiptNote", ["dashboard-grn"], "-receipt_date");
    const { data: vendors = [] } = useEntityList("Vendor", ["dashboard-vendors"]);

    return <ModuleCards cards={[
        { title: "Purchase Requisitions", value: toList(requisitions).filter(r => r.status === "pending" || r.status === "submitted").length, description: "Waiting for processing", icon: FileText, color: "amber", to: "Purchasing" },
        { title: "Purchase Orders", value: toList(orders).length, description: `${formatSar(sumBy(toList(orders), "total_amount"))} total value`, icon: ShoppingCart, color: "blue", to: "Purchasing" },
        { title: "Goods Receipts", value: toList(grn).length, description: "Receipt documents", icon: Truck, color: "emerald", to: "Purchasing" },
        { title: "Vendors", value: toList(vendors).length, description: "Vendor master records", icon: Building2, color: "indigo", to: "MasterDataManagement" },
        { title: "Demand Planning", value: "Open", description: "Forecasting dashboard", icon: Target, color: "purple", to: "DemandPlanning" },
        { title: "Supply Chain", value: "Open", description: "Supply chain overview", icon: TrendingUp, color: "slate", to: "SupplyChain" }
    ]} />;
}

function HRCards() {
    const { data: employees = [] } = useEntityList("Employee", ["dashboard-employees"]);
    const { data: leave = [] } = useEntityList("LeaveRequest", ["dashboard-leave"], "-applied_date");
    const { data: payroll = [] } = useEntityList("Payroll", ["dashboard-payroll"], "-payroll_month");
    const { data: loans = [] } = useEntityList("LoanAdvance", ["dashboard-loans"], "-request_date");
    const employeesList = toList(employees);

    return <ModuleCards cards={[
        { title: "Employees", value: employeesList.filter(e => e.employment_status === "active").length, description: `${employeesList.length} total employees`, icon: Users, color: "blue", to: "HR" },
        { title: "Leave Requests", value: toList(leave).filter(l => l.status === "submitted").length, description: "Submitted for approval", icon: Clock, color: "amber", to: "HR" },
        { title: "Payroll", value: toList(payroll).filter(p => p.status === "draft" || p.status === "calculated").length, description: "Draft or calculated payrolls", icon: DollarSign, color: "emerald", to: "HR" },
        { title: "Loans & Advances", value: toList(loans).filter(l => l.status === "active").length, description: "Active employee loans", icon: Receipt, color: "indigo", to: "HR" },
        { title: "HR Reports", value: "Reports", description: "Payroll and employee reporting", icon: BarChart3, color: "purple", to: "HRReports" }
    ]} />;
}

function ProjectCards() {
    const { data: projects = [] } = useEntityList("Project", ["dashboard-projects"], "-start_date");
    const { data: tasks = [] } = useEntityList("ProjectTask", ["dashboard-project-tasks"], "-due_date");
    const { data: milestones = [] } = useEntityList("ProjectMilestone", ["dashboard-project-milestones"], "-due_date");
    const { data: expenses = [] } = useEntityList("ProjectExpense", ["dashboard-project-expenses"], "-expense_date");

    return <ModuleCards cards={[
        { title: "Projects", value: toList(projects).filter(p => p.status === "active" || p.status === "in_progress").length, description: "Active projects", icon: Briefcase, color: "blue", to: "Projects" },
        { title: "Project Tasks", value: toList(tasks).filter(t => t.status !== "completed").length, description: "Open tasks", icon: CheckCircle2, color: "amber", to: "Projects" },
        { title: "Milestones", value: toList(milestones).length, description: "Tracked milestones", icon: Target, color: "indigo", to: "Projects" },
        { title: "Project Expenses", value: formatSar(sumBy(toList(expenses), "amount")), description: "Recorded project expenses", icon: DollarSign, color: "emerald", to: "Projects" }
    ]} />;
}

function ComplianceCards() {
    const { data: zatca = [] } = useEntityList("ZATCASubmissionLog", ["dashboard-zatca"], "-submission_date");
    const { data: vat = [] } = useEntityList("VATReturn", ["dashboard-vat"], "-period_end");
    const { data: zakat = [] } = useEntityList("ZakatComputation", ["dashboard-zakat"], "-period_end");

    return <ModuleCards cards={[
        { title: "ZATCA Submissions", value: toList(zatca).length, description: `${toList(zatca).filter(z => z.status === "failed").length} failed submissions`, icon: FileCheck, color: "blue", to: "ZATCA" },
        { title: "VAT Returns", value: toList(vat).length, description: "VAT return records", icon: Receipt, color: "emerald", to: "ComplianceReports" },
        { title: "Zakat Computations", value: toList(zakat).length, description: "Zakat calculation records", icon: Calculator, color: "amber", to: "ZakatManagement" },
        { title: "Compliance Reports", value: "Reports", description: "Regulatory reporting center", icon: BarChart3, color: "purple", to: "ComplianceReports" }
    ]} />;
}

function ReportsCards() {
    return <ModuleCards cards={[
        { title: "Management Reports", value: "Open", description: "Main reporting center", icon: BarChart3, color: "blue", to: "Reports" },
        { title: "Sales Reports", value: "Open", description: "Revenue and order reports", icon: ShoppingCart, color: "indigo", to: "SalesReports" },
        { title: "Financial Reports", value: "Open", description: "Statements and ledgers", icon: DollarSign, color: "emerald", to: "FinancialReports" },
        { title: "Inventory Reports", value: "Open", description: "Stock and valuation reports", icon: Warehouse, color: "amber", to: "InventoryReports" },
        { title: "Manufacturing Reports", value: "Open", description: "Production reports", icon: Factory, color: "purple", to: "ManufacturingReports" },
        { title: "HR Reports", value: "Open", description: "Employee and payroll reports", icon: Users, color: "slate", to: "HRReports" }
    ]} />;
}

function WorkflowCards() {
    const { data: approvals = [] } = useEntityList("ApprovalRequest", ["dashboard-workflow-approvals"], "-created_date");
    const { data: matrix = [] } = useEntityList("ApprovalMatrix", ["dashboard-approval-matrix"]);

    return <ModuleCards cards={[
        { title: "Pending Approvals", value: toList(approvals).filter(a => a.status === "pending").length, description: "Awaiting review", icon: Clock, color: "amber", to: "Approvals" },
        { title: "Approval Requests", value: toList(approvals).length, description: "Total workflow requests", icon: FileCheck, color: "blue", to: "Approvals" },
        { title: "Approval Matrix", value: toList(matrix).length, description: "Configured approval rules", icon: Shield, color: "indigo", to: "ApprovalWorkflows" }
    ]} />;
}

function AdministrationCards() {
    const { data: organizations = [] } = useEntityList("Organization", ["dashboard-organizations"]);
    const { data: plants = [] } = useEntityList("Plant", ["dashboard-plants"]);
    const { data: roles = [] } = useEntityList("Role", ["dashboard-roles"]);
    const { data: users = [] } = useEntityList("User", ["dashboard-users"]);

    return <ModuleCards cards={[
        { title: "Organizations", value: toList(organizations).length, description: "Company setup records", icon: Building2, color: "blue", to: "AdminCenter" },
        { title: "Plants", value: toList(plants).length, description: "Plant master records", icon: Factory, color: "indigo", to: "AdminCenter" },
        { title: "Roles", value: toList(roles).length, description: "Security roles", icon: Shield, color: "amber", to: "AdminCenter" },
        { title: "Users", value: toList(users).length, description: "Application users", icon: Users, color: "emerald", to: "AdminCenter" },
        { title: "Master Data", value: "Open", description: "Core master data setup", icon: Database, color: "purple", to: "MasterDataManagement" },
        { title: "AI Assistant", value: "Open", description: "Management assistant", icon: Bot, color: "slate", to: "AIAssistant" }
    ]} />;
}

export default function Dashboard() {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState("overview");
    const dashboardTabs = useMemo(() => ([
        { value: "overview", label: "Overview", Component: OverviewCards },
        { value: "controls", label: "Control Center", Component: ControlCenterCards },
        { value: "sales", label: "Sales", Component: SalesCards },
        { value: "inventory", label: "Inventory & Quality", Component: InventoryCards },
        { value: "operations", label: "Operations", Component: OperationsCards },
        { value: "supply-chain", label: "Supply Chain", Component: SupplyChainCards },
        { value: "finance", label: "Finance", Component: FinanceCards },
        { value: "projects", label: "Projects", Component: ProjectCards },
        { value: "hr", label: "HR", Component: HRCards },
        { value: "compliance", label: "Compliance", Component: ComplianceCards },
        { value: "reports", label: "Reports", Component: ReportsCards },
        { value: "workflow", label: "Workflow", Component: WorkflowCards },
        { value: "administration", label: "Administration", Component: AdministrationCards }
    ]), []);

    const activeModule = dashboardTabs.find(tab => tab.value === activeTab) || dashboardTabs[0];
    const ActiveComponent = activeModule.Component;

    return (
        <div className="space-y-4 p-4 md:space-y-6 md:p-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">{t("dashboard")}</h1>
                <p className="mt-1 text-sm text-gray-600 md:text-base">
                    Management overview by module. Use the cards to review status and open the working screens when needed.
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                    <TabsList className="h-auto min-w-max justify-start bg-transparent p-0">
                        {dashboardTabs.map(tab => (
                            <TabsTrigger
                                key={tab.value}
                                value={tab.value}
                                className="px-3 py-2 data-[state=active]:bg-[#24466f] data-[state=active]:text-white"
                            >
                                {tab.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                <TabsContent value={activeModule.value} className="mt-0">
                    <ActiveComponent />
                </TabsContent>
            </Tabs>
        </div>
    );
}
