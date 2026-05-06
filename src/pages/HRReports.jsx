import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
    Users, 
    DollarSign, 
    Calendar,
    RefreshCw,
    TrendingUp
} from "lucide-react";
import PayrollRegisterReport from "../components/reports/PayrollRegisterReport";
import LeaveBalanceReport from "../components/reports/LeaveBalanceReport";
import OvertimeAllowanceReport from "../components/reports/OvertimeAllowanceReport";
import EOSProvisionReport from "../components/reports/EOSProvisionReport";

export default function HRReports() {
    const [activeTab, setActiveTab] = useState("payroll_register");

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.list(),
        initialData: []
    });

    const { data: payrolls = [] } = useQuery({
        queryKey: ['payrolls'],
        queryFn: () => base44.entities.Payroll.list('-payroll_month'),
        initialData: []
    });

    const { data: leaves = [] } = useQuery({
        queryKey: ['leaves'],
        queryFn: () => base44.entities.LeaveRequest.list(),
        initialData: []
    });

    const { data: eosSettlements = [] } = useQuery({
        queryKey: ['eosSettlements'],
        queryFn: () => base44.entities.EOSSettlement.list(),
        initialData: []
    });

    // KPIs
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentPayroll = payrolls.find(p => p.payroll_month === currentMonth);
    const totalPayroll = currentPayroll?.total_net_salary || 0;
    const activeEmployees = employees.filter(e => e.employment_status === 'active').length;
    const pendingLeaves = leaves.filter(l => l.status === 'pending').length;
    const totalEOSProvision = employees
        .filter(e => e.employment_status === 'active')
        .reduce((sum, e) => sum + (e.eos_provision || 0), 0);

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">HR & Payroll Reports</h1>
                    <p className="text-gray-600 mt-1">Payroll register, leave management, overtime & EOS provisions</p>
                </div>
                <Button variant="outline" className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Refresh Data
                </Button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Active Employees</p>
                                <p className="text-2xl font-bold text-gray-900">{activeEmployees}</p>
                                <p className="text-xs text-gray-500 mt-1">{employees.length} total</p>
                            </div>
                            <Users className="w-8 h-8 text-emerald-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Monthly Payroll</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {(totalPayroll / 1000).toFixed(0)}K
                                </p>
                                <p className="text-xs text-gray-500 mt-1">Current month</p>
                            </div>
                            <DollarSign className="w-8 h-8 text-blue-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Pending Leaves</p>
                                <p className="text-2xl font-bold text-orange-600">{pendingLeaves}</p>
                                <p className="text-xs text-gray-500 mt-1">Awaiting approval</p>
                            </div>
                            <Calendar className="w-8 h-8 text-orange-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">EOS Provision</p>
                                <p className="text-2xl font-bold text-indigo-600">
                                    {(totalEOSProvision / 1000).toFixed(0)}K
                                </p>
                                <p className="text-xs text-gray-500 mt-1">Total liability</p>
                            </div>
                            <TrendingUp className="w-8 h-8 text-indigo-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-2 lg:grid-cols-4 w-full">
                    <TabsTrigger value="payroll_register">Payroll Register</TabsTrigger>
                    <TabsTrigger value="leave_balance">Leave Balance</TabsTrigger>
                    <TabsTrigger value="overtime_allowance">Overtime & Allowances</TabsTrigger>
                    <TabsTrigger value="eos_provision">EOS Provision</TabsTrigger>
                </TabsList>

                <TabsContent value="payroll_register">
                    <PayrollRegisterReport />
                </TabsContent>

                <TabsContent value="leave_balance">
                    <LeaveBalanceReport />
                </TabsContent>

                <TabsContent value="overtime_allowance">
                    <OvertimeAllowanceReport />
                </TabsContent>

                <TabsContent value="eos_provision">
                    <EOSProvisionReport />
                </TabsContent>
            </Tabs>
        </div>
    );
}