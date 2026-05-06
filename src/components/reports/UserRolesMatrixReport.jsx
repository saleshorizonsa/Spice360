import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileText, AlertTriangle, Users } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function UserRolesMatrixReport() {
    const [periodStart, setPeriodStart] = useState(new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]);
    const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split('T')[0]);

    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: () => matrixSales.entities.User.list(),
        initialData: []
    });

    // Segregation of Duties Checks
    const sodViolations = [];
    
    // Check for users with conflicting permissions
    users.forEach(user => {
        const conflicts = [];
        
        // Finance + Approvals
        if (user.permissions?.finance && user.permissions?.approvals && user.can_approve_own) {
            conflicts.push("Finance + Self-Approval");
        }
        
        // Purchasing + Approvals
        if (user.permissions?.purchasing && user.permissions?.approvals) {
            conflicts.push("Purchasing + Approval Authority");
        }
        
        // Admin + Finance
        if (user.role === 'admin' && user.permissions?.finance) {
            conflicts.push("System Admin + Finance Access");
        }
        
        if (conflicts.length > 0) {
            sodViolations.push({
                user: user.full_name || user.email,
                email: user.email,
                role: user.role,
                conflicts: conflicts
            });
        }
    });

    const handleExportPDF = () => {
        const printWindow = window.open('', '_blank');
        const content = `
            <html>
                <head>
                    <title>User/Roles Matrix & SoD Report</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 40px; font-size: 11px; }
                        h1 { color: #059669; text-align: center; }
                        .header { text-align: center; margin-bottom: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f3f4f6; font-weight: bold; }
                        .violation { background-color: #fee2e2; }
                        .checkmark { color: #10b981; }
                        .cross { color: #dc2626; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>MatrixERP - User/Roles Matrix & Segregation of Duties</h1>
                        <p><strong>Period:</strong> ${new Date(periodStart).toLocaleDateString()} to ${new Date(periodEnd).toLocaleDateString()}</p>
                        <p><strong>Total Users:</strong> ${users.length} | <strong>Active:</strong> ${users.filter(u => u.status === 'active').length}</p>
                    </div>
                    
                    <h2 style="color: #dc2626;">Segregation of Duties Violations</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Conflicts Detected</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sodViolations.length === 0 ? `
                                <tr>
                                    <td colspan="4" style="text-align: center; color: #10b981;">No SoD violations detected ✓</td>
                                </tr>
                            ` : sodViolations.map(v => `
                                <tr class="violation">
                                    <td>${v.user}</td>
                                    <td>${v.email}</td>
                                    <td>${v.role}</td>
                                    <td>${v.conflicts.join(', ')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <h2 style="margin-top: 30px;">User Permissions Matrix</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Role</th>
                                <th>Dept</th>
                                <th>Status</th>
                                <th>Sales</th>
                                <th>Purchasing</th>
                                <th>Production</th>
                                <th>Inventory</th>
                                <th>Finance</th>
                                <th>HR</th>
                                <th>Approvals</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.map(user => `
                                <tr>
                                    <td>${user.full_name || user.email}</td>
                                    <td>${user.role}</td>
                                    <td>${user.department || '-'}</td>
                                    <td>${user.status || 'active'}</td>
                                    <td>${user.permissions?.sales ? '✓' : '-'}</td>
                                    <td>${user.permissions?.purchasing ? '✓' : '-'}</td>
                                    <td>${user.permissions?.production ? '✓' : '-'}</td>
                                    <td>${user.permissions?.inventory ? '✓' : '-'}</td>
                                    <td>${user.permissions?.finance ? '✓' : '-'}</td>
                                    <td>${user.permissions?.hr ? '✓' : '-'}</td>
                                    <td>${user.permissions?.approvals ? '✓' : '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <p style="margin-top: 20px; font-size: 10px; color: #6b7280;">
                        Generated on: ${new Date().toLocaleString()} | MatrixERP IT & Security
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
                        <Users className="w-5 h-5 text-emerald-600" />
                        User/Roles Matrix & Segregation of Duties (SoD)
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
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                    <div>
                        <Label>Period Start</Label>
                        <Input
                            type="date"
                            value={periodStart}
                            onChange={(e) => setPeriodStart(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label>Period End</Label>
                        <Input
                            type="date"
                            value={periodEnd}
                            onChange={(e) => setPeriodEnd(e.target.value)}
                        />
                    </div>
                    <div className="flex items-end">
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                            Generate Report
                        </Button>
                    </div>
                </div>

                {/* SoD Violations */}
                {sodViolations.length > 0 && (
                    <Card className="bg-red-50 border-red-200 mb-6">
                        <CardHeader>
                            <CardTitle className="text-lg text-red-800 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" />
                                Segregation of Duties Violations Detected
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-lg border border-red-200 overflow-hidden bg-white">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-red-100">
                                            <TableHead>User</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Conflicts</TableHead>
                                            <TableHead>Risk Level</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sodViolations.map((violation, idx) => (
                                            <TableRow key={idx} className="bg-red-50">
                                                <TableCell className="font-medium">{violation.user}</TableCell>
                                                <TableCell>{violation.email}</TableCell>
                                                <TableCell className="capitalize">{violation.role}</TableCell>
                                                <TableCell>
                                                    {violation.conflicts.map((c, i) => (
                                                        <Badge key={i} className="mr-1 mb-1 bg-red-600">
                                                            {c}
                                                        </Badge>
                                                    ))}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className="bg-red-600">HIGH</Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {sodViolations.length === 0 && (
                    <Card className="bg-green-50 border-green-200 mb-6">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 text-green-800">
                                <span className="text-2xl">✓</span>
                                <span className="font-semibold">No Segregation of Duties violations detected</span>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* User Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Total Users</p>
                            <p className="text-2xl font-bold text-gray-900">{users.length}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Active Users</p>
                            <p className="text-2xl font-bold text-green-700">
                                {users.filter(u => u.status === 'active').length}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Admin Users</p>
                            <p className="text-2xl font-bold text-blue-700">
                                {users.filter(u => u.role === 'admin').length}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">SoD Violations</p>
                            <p className="text-2xl font-bold text-red-700">{sodViolations.length}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Permissions Matrix */}
                <div className="rounded-lg border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50">
                                <TableHead>User</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Department</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-center">Sales</TableHead>
                                <TableHead className="text-center">Purchasing</TableHead>
                                <TableHead className="text-center">Production</TableHead>
                                <TableHead className="text-center">Inventory</TableHead>
                                <TableHead className="text-center">Finance</TableHead>
                                <TableHead className="text-center">HR</TableHead>
                                <TableHead className="text-center">Approvals</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((user, idx) => (
                                <TableRow key={idx} className="hover:bg-gray-50">
                                    <TableCell className="font-medium">{user.full_name || user.email}</TableCell>
                                    <TableCell className="capitalize">
                                        <Badge className={user.role === 'admin' ? 'bg-red-600' : 'bg-blue-600'}>
                                            {user.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="capitalize">{user.department || '-'}</TableCell>
                                    <TableCell>
                                        <Badge className={
                                            user.status === 'active' ? 'bg-green-600' :
                                            user.status === 'inactive' ? 'bg-gray-600' :
                                            'bg-orange-600'
                                        }>
                                            {user.status || 'active'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {user.permissions?.sales ? '✓' : '-'}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {user.permissions?.purchasing ? '✓' : '-'}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {user.permissions?.production ? '✓' : '-'}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {user.permissions?.inventory ? '✓' : '-'}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {user.permissions?.finance ? '✓' : '-'}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {user.permissions?.hr ? '✓' : '-'}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {user.permissions?.approvals ? '✓' : '-'}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}