import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, Mail, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function PayrollRegisterReport() {
    const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7));
    const [department, setDepartment] = useState("ALL");

    const { data: payrolls = [] } = useQuery({
        queryKey: ['payrolls'],
        queryFn: () => base44.entities.Payroll.list('-payroll_month'),
        initialData: []
    });

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.list(),
        initialData: []
    });

    const filteredPayrolls = payrolls.filter(p => {
        const monthMatch = p.payroll_month === payrollMonth;
        const deptMatch = department === 'ALL' || p.department === department;
        return monthMatch && deptMatch;
    });

    // Calculate totals
    const totals = {
        basic_salary: filteredPayrolls.reduce((sum, p) => sum + (p.basic_salary || 0), 0),
        housing_allowance: filteredPayrolls.reduce((sum, p) => sum + (p.housing_allowance || 0), 0),
        transport_allowance: filteredPayrolls.reduce((sum, p) => sum + (p.transport_allowance || 0), 0),
        other_allowances: filteredPayrolls.reduce((sum, p) => sum + (p.other_allowances || 0), 0),
        overtime: filteredPayrolls.reduce((sum, p) => sum + (p.overtime_amount || 0), 0),
        gross_salary: filteredPayrolls.reduce((sum, p) => sum + (p.gross_salary || 0), 0),
        gosi_employee: filteredPayrolls.reduce((sum, p) => sum + (p.gosi_employee_deduction || 0), 0),
        loan_deduction: filteredPayrolls.reduce((sum, p) => sum + (p.loan_deduction || 0), 0),
        other_deductions: filteredPayrolls.reduce((sum, p) => sum + (p.other_deductions || 0), 0),
        total_deductions: filteredPayrolls.reduce((sum, p) => sum + (p.total_deductions || 0), 0),
        net_salary: filteredPayrolls.reduce((sum, p) => sum + (p.net_salary || 0), 0),
        gosi_employer: filteredPayrolls.reduce((sum, p) => sum + (p.gosi_employer_contribution || 0), 0)
    };

    const handleExportPDF = () => {
        const printWindow = window.open('', '_blank');
        const content = `
            <html>
                <head>
                    <title>Payroll Register - ${payrollMonth}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 40px; font-size: 10px; }
                        h1 { color: #059669; text-align: center; font-size: 18px; }
                        .header { text-align: center; margin-bottom: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                        th { background-color: #f3f4f6; font-weight: bold; font-size: 9px; }
                        .number { text-align: right; }
                        .total-row { font-weight: bold; background-color: #e5e7eb; }
                        .section-header { background-color: #d1fae5; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>MatrixERP - Payroll Register</h1>
                        <p><strong>Period:</strong> ${new Date(payrollMonth).toLocaleDateString('en-US', {year: 'numeric', month: 'long'})}</p>
                        <p><strong>Department:</strong> ${department === 'ALL' ? 'All Departments' : department}</p>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Emp #</th>
                                <th>Name</th>
                                <th>Dept</th>
                                <th class="number">Basic</th>
                                <th class="number">Housing</th>
                                <th class="number">Transport</th>
                                <th class="number">Other Allow</th>
                                <th class="number">OT</th>
                                <th class="number">Gross</th>
                                <th class="number">GOSI</th>
                                <th class="number">Loan</th>
                                <th class="number">Other Ded</th>
                                <th class="number">Total Ded</th>
                                <th class="number">Net Salary</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredPayrolls.map(p => `
                                <tr>
                                    <td>${p.employee_number}</td>
                                    <td>${p.employee_name}</td>
                                    <td>${p.department}</td>
                                    <td class="number">${(p.basic_salary || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                    <td class="number">${(p.housing_allowance || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                    <td class="number">${(p.transport_allowance || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                    <td class="number">${(p.other_allowances || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                    <td class="number">${(p.overtime_amount || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                    <td class="number">${(p.gross_salary || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                    <td class="number">${(p.gosi_employee_deduction || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                    <td class="number">${(p.loan_deduction || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                    <td class="number">${(p.other_deductions || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                    <td class="number">${(p.total_deductions || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                    <td class="number"><strong>${(p.net_salary || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></td>
                                </tr>
                            `).join('')}
                            <tr class="total-row">
                                <td colspan="3">TOTAL</td>
                                <td class="number">${totals.basic_salary.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                <td class="number">${totals.housing_allowance.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                <td class="number">${totals.transport_allowance.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                <td class="number">${totals.other_allowances.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                <td class="number">${totals.overtime.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                <td class="number">${totals.gross_salary.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                <td class="number">${totals.gosi_employee.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                <td class="number">${totals.loan_deduction.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                <td class="number">${totals.other_deductions.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                <td class="number">${totals.total_deductions.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                <td class="number">${totals.net_salary.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <div style="margin-top: 30px;">
                        <h3 style="color: #059669;">Payroll Journal Entry</h3>
                        <table>
                            <thead>
                                <tr class="section-header">
                                    <th>Account</th>
                                    <th>Description</th>
                                    <th class="number">Debit (SAR)</th>
                                    <th class="number">Credit (SAR)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td>6010</td><td>Salaries & Wages</td><td class="number">${totals.gross_salary.toLocaleString('en-US', {minimumFractionDigits: 2})}</td><td class="number">-</td></tr>
                                <tr><td>6020</td><td>GOSI Employer Contribution</td><td class="number">${totals.gosi_employer.toLocaleString('en-US', {minimumFractionDigits: 2})}</td><td class="number">-</td></tr>
                                <tr><td>2010</td><td>Salaries Payable</td><td class="number">-</td><td class="number">${totals.net_salary.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
                                <tr><td>2020</td><td>GOSI Payable</td><td class="number">-</td><td class="number">${(totals.gosi_employee + totals.gosi_employer).toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
                                <tr><td>2030</td><td>Loan Recoveries</td><td class="number">-</td><td class="number">${totals.loan_deduction.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
                                <tr><td>2040</td><td>Other Deductions</td><td class="number">-</td><td class="number">${totals.other_deductions.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
                                <tr class="total-row">
                                    <td colspan="2">TOTAL</td>
                                    <td class="number">${(totals.gross_salary + totals.gosi_employer).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                    <td class="number">${(totals.net_salary + totals.gosi_employee + totals.gosi_employer + totals.loan_deduction + totals.other_deductions).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    
                    <p style="margin-top: 20px; font-size: 9px; color: #6b7280;">
                        Generated on: ${new Date().toLocaleString()} | MatrixERP Payroll System
                    </p>
                </body>
            </html>
        `;
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.print();
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-emerald-600" />
                        Payroll Register (Gross → Net) + Journal Entry
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                    <div>
                        <Label>Payroll Month</Label>
                        <Input
                            type="month"
                            value={payrollMonth}
                            onChange={(e) => setPayrollMonth(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label>Department</Label>
                        <Select value={department} onValueChange={setDepartment}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Departments</SelectItem>
                                <SelectItem value="production">Production</SelectItem>
                                <SelectItem value="sales">Sales</SelectItem>
                                <SelectItem value="finance">Finance</SelectItem>
                                <SelectItem value="hr">HR</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-end">
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                            <Search className="w-4 h-4 mr-2" />
                            Generate
                        </Button>
                    </div>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <Card className="bg-blue-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Employees</p>
                            <p className="text-2xl font-bold text-blue-700">{filteredPayrolls.length}</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-emerald-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Gross Salary</p>
                            <p className="text-xl font-bold text-emerald-700">
                                SAR {(totals.gross_salary / 1000).toFixed(0)}K
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-red-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Total Deductions</p>
                            <p className="text-xl font-bold text-red-700">
                                SAR {(totals.total_deductions / 1000).toFixed(0)}K
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-indigo-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Net Salary</p>
                            <p className="text-xl font-bold text-indigo-700">
                                SAR {(totals.net_salary / 1000).toFixed(0)}K
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Payroll Table */}
                <div className="rounded-lg border overflow-hidden max-h-[500px] overflow-y-auto mb-6">
                    <Table>
                        <TableHeader className="sticky top-0 bg-gray-50 z-10">
                            <TableRow>
                                <TableHead>Emp #</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Dept</TableHead>
                                <TableHead className="text-right">Basic</TableHead>
                                <TableHead className="text-right">Housing</TableHead>
                                <TableHead className="text-right">Transport</TableHead>
                                <TableHead className="text-right">Other</TableHead>
                                <TableHead className="text-right">OT</TableHead>
                                <TableHead className="text-right">Gross</TableHead>
                                <TableHead className="text-right">GOSI</TableHead>
                                <TableHead className="text-right">Loan</TableHead>
                                <TableHead className="text-right">Other Ded</TableHead>
                                <TableHead className="text-right">Net</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredPayrolls.map((payroll, idx) => (
                                <TableRow key={idx} className="hover:bg-gray-50">
                                    <TableCell className="font-medium">{payroll.employee_number}</TableCell>
                                    <TableCell>{payroll.employee_name}</TableCell>
                                    <TableCell className="capitalize">{payroll.department}</TableCell>
                                    <TableCell className="text-right font-mono">
                                        {(payroll.basic_salary || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        {(payroll.housing_allowance || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        {(payroll.transport_allowance || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        {(payroll.other_allowances || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        {(payroll.overtime_amount || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-semibold">
                                        {(payroll.gross_salary || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-red-600">
                                        {(payroll.gosi_employee_deduction || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-red-600">
                                        {(payroll.loan_deduction || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-red-600">
                                        {(payroll.other_deductions || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold text-emerald-700">
                                        {(payroll.net_salary || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="bg-gray-100 font-bold">
                                <TableCell colSpan={3}>TOTAL</TableCell>
                                <TableCell className="text-right font-mono">
                                    {totals.basic_salary.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {totals.housing_allowance.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {totals.transport_allowance.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {totals.other_allowances.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {totals.overtime.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {totals.gross_salary.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {totals.gosi_employee.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {totals.loan_deduction.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {totals.other_deductions.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {totals.net_salary.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>

                {/* Journal Entry */}
                <Card className="bg-emerald-50">
                    <CardHeader>
                        <CardTitle className="text-lg">Payroll Journal Entry</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-lg border bg-white overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-emerald-100">
                                        <TableHead>Account Code</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">Debit (SAR)</TableHead>
                                        <TableHead className="text-right">Credit (SAR)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow>
                                        <TableCell className="font-medium">6010</TableCell>
                                        <TableCell>Salaries & Wages</TableCell>
                                        <TableCell className="text-right font-mono">
                                            {totals.gross_salary.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                        </TableCell>
                                        <TableCell className="text-right text-gray-400">-</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-medium">6020</TableCell>
                                        <TableCell>GOSI Employer Contribution</TableCell>
                                        <TableCell className="text-right font-mono">
                                            {totals.gosi_employer.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                        </TableCell>
                                        <TableCell className="text-right text-gray-400">-</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-medium">2010</TableCell>
                                        <TableCell>Salaries Payable</TableCell>
                                        <TableCell className="text-right text-gray-400">-</TableCell>
                                        <TableCell className="text-right font-mono">
                                            {totals.net_salary.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                        </TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-medium">2020</TableCell>
                                        <TableCell>GOSI Payable (Employee + Employer)</TableCell>
                                        <TableCell className="text-right text-gray-400">-</TableCell>
                                        <TableCell className="text-right font-mono">
                                            {(totals.gosi_employee + totals.gosi_employer).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                        </TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-medium">2030</TableCell>
                                        <TableCell>Loan Recoveries</TableCell>
                                        <TableCell className="text-right text-gray-400">-</TableCell>
                                        <TableCell className="text-right font-mono">
                                            {totals.loan_deduction.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                        </TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-medium">2040</TableCell>
                                        <TableCell>Other Deductions</TableCell>
                                        <TableCell className="text-right text-gray-400">-</TableCell>
                                        <TableCell className="text-right font-mono">
                                            {totals.other_deductions.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                        </TableCell>
                                    </TableRow>
                                    <TableRow className="bg-gray-100 font-bold">
                                        <TableCell colSpan={2}>TOTAL</TableCell>
                                        <TableCell className="text-right font-mono">
                                            {(totals.gross_salary + totals.gosi_employer).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {(totals.net_salary + totals.gosi_employee + totals.gosi_employer + totals.loan_deduction + totals.other_deductions).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </CardContent>
        </Card>
    );
}