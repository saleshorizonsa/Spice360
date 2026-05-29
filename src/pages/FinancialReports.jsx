import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
    FileText, 
    Calendar,
    Download,
    Mail
} from "lucide-react";
import TrialBalanceReport from "../components/reports/TrialBalanceReport";
import VATReturnReport from "../components/reports/VATReturnReport";
import GeneralLedgerReport from "../components/reports/GeneralLedgerReport";
import ARAgingReport from "../components/reports/ARAgingReport";
import APAgingReport from "../components/reports/APAgingReport";
import BankReconciliationReport from "../components/reports/BankReconciliationReport";
import FixedAssetReport from "../components/reports/FixedAssetReport";
import ProfitLossReport from "../components/reports/ProfitLossReport";
import BalanceSheetReport from "../components/reports/BalanceSheetReport";
import AccountingStatementsReport from "../components/reports/AccountingStatementsReport";
import CashFlowReport from "../components/reports/CashFlowReport";
import CashForecastReport from "../components/reports/CashForecastReport";
import InterBranchReconciliationReport from "../components/reports/InterBranchReconciliationReport";

export default function FinancialReports() {
    const [activeTab, setActiveTab] = useState("financial_statements");

    const { data: reportHistory = [] } = useQuery({
        queryKey: ['reportHistory'],
        queryFn: () => matrixSales.entities.ReportHistory.list('-generation_date', 50),
        initialData: []
    });

    const recentReports = reportHistory.slice(0, 5);

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Financial Reports & Analysis</h1>
                    <p className="text-gray-600 mt-1">Comprehensive financial reporting for management & compliance</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2">
                        <Calendar className="w-4 h-4" />
                        Schedule Reports
                    </Button>
                    <Button variant="outline" className="gap-2">
                        <Mail className="w-4 h-4" />
                        Email Reports
                    </Button>
                </div>
            </div>

            {/* Recent Reports Summary */}
            <Card className="bg-gradient-to-r from-emerald-50 to-blue-50">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="w-5 h-5 text-emerald-600" />
                        Recently Generated Reports
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {recentReports.map((report, idx) => (
                            <div key={idx} className="bg-white rounded-lg p-4 shadow-sm">
                                <p className="font-semibold text-sm text-gray-900 truncate">{report.report_name}</p>
                                <p className="text-xs text-gray-600 mt-1">{report.period_end}</p>
                                <Button variant="link" className="text-xs p-0 h-auto mt-2">
                                    <Download className="w-3 h-3 mr-1" />
                                    Download
                                </Button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="flex flex-wrap h-auto gap-1 p-1">
                    <TabsTrigger value="financial_statements">Statements</TabsTrigger>
                    <TabsTrigger value="trial_balance">Trial Balance</TabsTrigger>
                    <TabsTrigger value="gl_detail">GL Detail</TabsTrigger>
                    <TabsTrigger value="ar_aging">A/R Aging</TabsTrigger>
                    <TabsTrigger value="ap_aging">A/P Aging</TabsTrigger>
                    <TabsTrigger value="bank_recon">Bank Recon</TabsTrigger>
                    <TabsTrigger value="fixed_assets">Fixed Assets</TabsTrigger>
                    <TabsTrigger value="profit_loss">P&L</TabsTrigger>
                    <TabsTrigger value="balance_sheet">Balance Sheet</TabsTrigger>
                    <TabsTrigger value="cash_flow">Cash Flow</TabsTrigger>
                    <TabsTrigger value="cash_forecast">Cash Forecast</TabsTrigger>
                    <TabsTrigger value="inter_branch">Inter-Branch</TabsTrigger>
                    <TabsTrigger value="vat_return">VAT Return</TabsTrigger>
                </TabsList>

                <TabsContent value="financial_statements">
                    <AccountingStatementsReport />
                </TabsContent>

                <TabsContent value="trial_balance">
                    <TrialBalanceReport />
                </TabsContent>

                <TabsContent value="gl_detail">
                    <GeneralLedgerReport />
                </TabsContent>

                <TabsContent value="ar_aging">
                    <ARAgingReport />
                </TabsContent>

                <TabsContent value="ap_aging">
                    <APAgingReport />
                </TabsContent>

                <TabsContent value="bank_recon">
                    <BankReconciliationReport />
                </TabsContent>

                <TabsContent value="fixed_assets">
                    <FixedAssetReport />
                </TabsContent>

                <TabsContent value="profit_loss">
                    <ProfitLossReport />
                </TabsContent>

                <TabsContent value="balance_sheet">
                    <BalanceSheetReport />
                </TabsContent>

                <TabsContent value="cash_flow">
                    <CashFlowReport />
                </TabsContent>

                <TabsContent value="cash_forecast">
                    <CashForecastReport />
                </TabsContent>

                <TabsContent value="inter_branch">
                    <InterBranchReconciliationReport />
                </TabsContent>

                <TabsContent value="vat_return">
                    <VATReturnReport />
                </TabsContent>
            </Tabs>
        </div>
    );
}
