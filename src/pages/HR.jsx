import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Users, Calendar, DollarSign, UserCheck, Shield, Calculator } from "lucide-react";
import DataTable from "@/components/erp/DataTable";
import { useToast } from "@/components/ui/use-toast";
import EmployeeForm from "@/components/hr/EmployeeForm";
import LeaveRequestForm from "@/components/hr/LeaveRequestForm";
import PayrollForm from "@/components/hr/PayrollForm";
import LoanAdvanceForm from "@/components/hr/LoanAdvanceForm";
import EOSForm from "@/components/hr/EOSForm";
import GOSIContributionForm from "@/components/hr/GOSIContributionForm";
import GOSIBulkCalculation from "@/components/hr/GOSIBulkCalculation";
import { Clock, CheckCircle, XCircle } from "lucide-react";
import { useLanguage } from "@/components/utils/languageContext";

export default function HR() {
    const [activeTab, setActiveTab] = useState("employees");
    const [showDialog, setShowDialog] = useState(false);
    const [showBulkGOSI, setShowBulkGOSI] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { t } = useLanguage();

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => matrixSales.entities.Employee.list(),
        initialData: []
    });

    const { data: leaveRequests = [] } = useQuery({
        queryKey: ['leaveRequests'],
        queryFn: () => matrixSales.entities.LeaveRequest.list('-applied_date'),
        initialData: []
    });

    const { data: payrolls = [] } = useQuery({
        queryKey: ['payrolls'],
        queryFn: () => matrixSales.entities.Payroll.list('-payroll_month'),
        initialData: []
    });

    const { data: loans = [] } = useQuery({
        queryKey: ['loans'],
        queryFn: () => matrixSales.entities.LoanAdvance.list('-request_date'),
        initialData: []
    });

    const { data: eosSettlements = [] } = useQuery({
        queryKey: ['eosSettlements'],
        queryFn: () => matrixSales.entities.EOSSettlement.list('-last_working_date'),
        initialData: []
    });

    const { data: gosiContributions = [] } = useQuery({
        queryKey: ['gosiContributions'],
        queryFn: () => matrixSales.entities.GOSIContribution.list('-month'),
        initialData: []
    });

    // KPIs
    const activeEmployees = employees.filter(e => e.employment_status === 'active').length;
    const saudiEmployees = employees.filter(e => e.is_saudi && e.employment_status === 'active').length;
    const saudizationRate = activeEmployees > 0 ? Math.round((saudiEmployees / activeEmployees) * 100) : 0;
    const pendingLeaves = leaveRequests.filter(l => l.status === 'submitted').length;
    const pendingPayrolls = payrolls.filter(p => p.status === 'draft' || p.status === 'calculated').length;
    const activeLoans = loans.filter(l => l.status === 'active').length;
    const currentMonthGOSI = gosiContributions.filter(g => g.month === new Date().toISOString().substring(0, 7) && g.status === 'calculated').length;

    const deleteMutation = useMutation({
        mutationFn: ({ entity, id }) => matrixSales.entities[entity].delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries();
            toast({
                title: t('success'),
                description: t('deletedSuccessfully'),
            });
        }
    });

    const getBadgeColor = (value) => {
        const colors = {
            active: "bg-green-100 text-green-800",
            inactive: "bg-gray-100 text-gray-800",
            suspended: "bg-yellow-100 text-yellow-800",
            resigned: "bg-red-100 text-red-800",
            terminated: "bg-red-100 text-red-800",
            pending: "bg-yellow-100 text-yellow-800",
            submitted: "bg-blue-100 text-blue-800",
            approved: "bg-green-100 text-green-800",
            rejected: "bg-red-100 text-red-800",
            draft: "bg-gray-100 text-gray-800",
            calculated: "bg-blue-100 text-blue-800",
            paid: "bg-green-100 text-green-800",
            requested: "bg-yellow-100 text-yellow-800",
            disbursed: "bg-emerald-100 text-emerald-800",
            business: "bg-indigo-100 text-indigo-800",
            annual: "bg-purple-100 text-purple-800",
            sick: "bg-red-100 text-red-800",
            maternity: "bg-pink-100 text-pink-800",
            paternity: "bg-blue-100 text-blue-800",
            cancelled: "bg-gray-100 text-gray-800"
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

    const employeeColumns = [
        { header: "Employee #", key: "employee_number" },
        { header: "Name", key: "employee_name" },
        { header: "Department", key: "department" },
        { header: "Designation", key: "designation" },
        { header: "Nationality", key: "nationality" },
        { header: "Joining Date", key: "joining_date" },
        { header: "Basic Salary", key: "basic_salary", render: (val) => `SAR ${val?.toLocaleString()}` },
        { header: "Status", key: "employment_status", isBadge: true }
    ];

    const leaveRequestColumns = [
        { header: "Request #", key: "leave_request_number" },
        { header: "Employee", key: "employee_name" },
        { header: "Leave Type", key: "leave_type", isBadge: true },
        { header: "Start Date", key: "start_date" },
        { header: "End Date", key: "end_date" },
        { header: "Total Days", key: "total_days" },
        { header: "Status", key: "status", isBadge: true },
        {
            header: "Approval",
            key: "approval_status",
            render: (val, row) => {
                if (row.status === 'submitted' || row.hr_approval_status === 'pending' || row.supervisor_approval_status === 'pending') {
                    return (
                        <div className="flex items-center gap-1 text-amber-600">
                            <Clock className="w-4 h-4" />
                            <span className="text-xs">Pending</span>
                        </div>
                    );
                }
                if (row.status === 'approved') {
                    return (
                        <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-xs">Approved</span>
                        </div>
                    );
                }
                if (row.status === 'rejected') {
                    return (
                        <div className="flex items-center gap-1 text-red-600">
                            <XCircle className="w-4 h-4" />
                            <span className="text-xs">Rejected</span>
                        </div>
                    );
                }
                return null;
            }
        }
    ];

    const payrollColumns = [
        { header: "Payroll #", key: "payroll_number" },
        { header: "Month", key: "payroll_month" },
        { header: "Employee", key: "employee_name" },
        { header: "Gross", key: "gross_earnings", render: (val) => `SAR ${val?.toLocaleString()}` },
        { header: "Deductions", key: "total_deductions", render: (val) => `SAR ${val?.toLocaleString()}` },
        { header: "Net Salary", key: "net_salary", render: (val) => `SAR ${val?.toLocaleString()}` },
        { header: "Status", key: "status", isBadge: true }
    ];

    const loanColumns = [
        { header: "Loan #", key: "loan_number" },
        { header: "Employee", key: "employee_name" },
        { header: "Type", key: "loan_type" },
        { header: "Approved", key: "amount_approved", render: (val) => `SAR ${val?.toLocaleString()}` },
        { header: "Repaid", key: "amount_repaid", render: (val) => `SAR ${val?.toLocaleString()}` },
        { header: "Outstanding", key: "balance_outstanding", render: (val) => `SAR ${val?.toLocaleString()}` },
        { header: "Status", key: "status", isBadge: true }
    ];

    const eosColumns = [
        { header: "EOS #", key: "eos_number" },
        { header: "Employee", key: "employee_name" },
        { header: "Service Years", key: "total_service_years" },
        { header: "EOS Amount", key: "total_eos_amount", render: (val) => `SAR ${val?.toLocaleString()}` },
        { header: "Net Settlement", key: "net_settlement_amount", render: (val) => `SAR ${val?.toLocaleString()}` },
        { header: "Type", key: "termination_type" },
        { header: "Status", key: "status", isBadge: true }
    ];

    const gosiColumns = [
        { header: "Contribution ID", key: "contribution_id" },
        { header: "Month", key: "month" },
        { header: "Employee", key: "employee_name" },
        { header: "GOSI Wage", key: "gosi_wage", render: (val) => `SAR ${val?.toLocaleString()}` },
        { header: "Employee", key: "employee_contribution", render: (val) => `SAR ${val?.toLocaleString()}` },
        { header: "Employer", key: "employer_contribution", render: (val) => `SAR ${val?.toLocaleString()}` },
        { header: "Total", key: "total_contribution", render: (val) => `SAR ${val?.toLocaleString()}` },
        { header: "Status", key: "status", isBadge: true }
    ];

    const handleCreate = (type) => {
        setEditingItem(null);
        setActiveTab(type);
        setShowDialog(true);
    };

    const handleEdit = (item, type) => {
        if (item.status === 'submitted' || item.status === 'approved') {
            toast({
                title: "Cannot Edit",
                description: "Submitted or approved records cannot be edited",
                variant: "destructive"
            });
            return;
        }
        setEditingItem(item);
        setActiveTab(type);
        setShowDialog(true);
    };

    const handleDelete = (item, entity) => {
        if (item.status === 'approved' || item.status === 'submitted') {
            toast({
                title: "Cannot Delete",
                description: "Approved or submitted records cannot be deleted",
                variant: "destructive"
            });
            return;
        }
        
        if (confirm(`Delete this ${entity}?`)) {
            deleteMutation.mutate({ entity, id: item.id });
        }
    };

    const handleCloseDialog = () => {
        setShowDialog(false);
        setEditingItem(null);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">HR & Payroll (KSA)</h1>
                    <p className="text-gray-600 mt-1">Manage employees, payroll, leaves, and GOSI contributions</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    title="Active Employees"
                    value={activeEmployees}
                    icon={Users}
                    trend={`${employees.length} total`}
                    color="emerald"
                />
                    title="Saudization Rate"
                    value={`${saudizationRate}%`}
                    icon={UserCheck}
                    trend={`${saudiEmployees} Saudi`}
                    color="blue"
                />
                    title="Pending Leaves"
                    value={pendingLeaves}
                    icon={Calendar}
                    trend={`${leaveRequests.length} total`}
                    color="amber"
                />
                    title="Active Loans"
                    value={activeLoans}
                    icon={DollarSign}
                    trend={`${loans.length} total`}
                    color="indigo"
                />
                    title="GOSI Pending"
                    value={currentMonthGOSI}
                    icon={Shield}
                    trend="This month"
                    color="emerald"
                />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-6 w-full">
                    <TabsTrigger value="employees">Employees</TabsTrigger>
                    <TabsTrigger value="leaves">Leaves</TabsTrigger>
                    <TabsTrigger value="payroll">Payroll</TabsTrigger>
                    <TabsTrigger value="loans">Loans</TabsTrigger>
                    <TabsTrigger value="eos">EOS</TabsTrigger>
                    <TabsTrigger value="gosi">GOSI</TabsTrigger>
                </TabsList>

                <TabsContent value="employees">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Employee Master</CardTitle>
                            <Button 
                                onClick={() => handleCreate('employees')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                New Employee
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={employees}
                                columns={employeeColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'employees')}
                                onDelete={(item) => handleDelete(item, 'Employee')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="leaves">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Leave Requests</CardTitle>
                            <Button 
                                onClick={() => handleCreate('leaves')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                New Leave Request
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={leaveRequests}
                                columns={leaveRequestColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'leaves')}
                                onDelete={(item) => handleDelete(item, 'LeaveRequest')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="payroll">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Payroll Processing</CardTitle>
                            <Button 
                                onClick={() => handleCreate('payroll')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Process Payroll
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={payrolls}
                                columns={payrollColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'payroll')}
                                onDelete={(item) => handleDelete(item, 'Payroll')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="loans">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Loans & Advances</CardTitle>
                            <Button 
                                onClick={() => handleCreate('loans')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                New Loan/Advance
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={loans}
                                columns={loanColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'loans')}
                                onDelete={(item) => handleDelete(item, 'LoanAdvance')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="eos">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>End of Service Settlements</CardTitle>
                            <Button 
                                onClick={() => handleCreate('eos')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                New EOS Settlement
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={eosSettlements}
                                columns={eosColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'eos')}
                                onDelete={(item) => handleDelete(item, 'EOSSettlement')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="gosi">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>GOSI Contributions</CardTitle>
                            <div className="flex gap-2">
                                <Button
                                    onClick={() => setShowBulkGOSI(true)}
                                    variant="outline"
                                    className="border-emerald-600 text-emerald-600"
                                >
                                    <Calculator className="w-4 h-4 mr-2" />
                                    Bulk Calculate
                                </Button>
                                <Button 
                                    onClick={() => handleCreate('gosi')}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    New Contribution
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={gosiContributions}
                                columns={gosiColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'gosi')}
                                onDelete={(item) => handleDelete(item, 'GOSIContribution')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Dialogs */}
            {showDialog && activeTab === 'employees' && (
                <EmployeeForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'leaves' && (
                <LeaveRequestForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'payroll' && (
                <PayrollForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'loans' && (
                <LoanAdvanceForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'eos' && (
                <EOSForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'gosi' && (
                <GOSIContributionForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showBulkGOSI && (
                <GOSIBulkCalculation onClose={() => setShowBulkGOSI(false)} />
            )}
        </div>
    );
}