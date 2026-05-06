import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
    Download, 
    Printer, 
    CheckCircle2, 
    AlertTriangle, 
    XCircle,
    TrendingUp,
    MapPin
} from "lucide-react";

export default function VerificationReport({ task, verifications }) {
    const verified = verifications.filter(v => v.verification_status === 'verified');
    const discrepancies = verifications.filter(v => v.verification_status === 'discrepancy');
    const notFound = verifications.filter(v => v.verification_status === 'not_found');
    const damaged = verifications.filter(v => v.verification_status === 'damaged');
    
    const locationMismatches = verifications.filter(v => !v.location_match);
    const custodianMismatches = verifications.filter(v => !v.custodian_match);
    const conditionIssues = verifications.filter(v => !v.condition_match);

    const completionRate = task.total_assets > 0 
        ? (verifications.length / task.total_assets) * 100 
        : 0;
    const accuracyRate = verifications.length > 0
        ? (verified.length / verifications.length) * 100
        : 0;

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Asset Verification Report - ${task.task_id}</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        padding: 40px; 
                        color: #333;
                    }
                    h1 { 
                        color: #059669; 
                        border-bottom: 3px solid #059669; 
                        padding-bottom: 10px;
                    }
                    h2 {
                        color: #047857;
                        margin-top: 30px;
                        border-bottom: 1px solid #d1d5db;
                        padding-bottom: 5px;
                    }
                    .header-info {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 20px;
                        margin: 20px 0;
                        padding: 20px;
                        background: #f3f4f6;
                        border-radius: 8px;
                    }
                    .info-item {
                        margin: 5px 0;
                    }
                    .label {
                        font-weight: bold;
                        color: #6b7280;
                    }
                    .kpi-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 15px;
                        margin: 20px 0;
                    }
                    .kpi-card {
                        padding: 15px;
                        border: 2px solid #e5e7eb;
                        border-radius: 8px;
                        text-align: center;
                    }
                    .kpi-value {
                        font-size: 32px;
                        font-weight: bold;
                        color: #059669;
                    }
                    .kpi-label {
                        font-size: 12px;
                        color: #6b7280;
                        margin-top: 5px;
                    }
                    table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        margin-top: 15px;
                        font-size: 12px;
                    }
                    th, td { 
                        border: 1px solid #d1d5db; 
                        padding: 8px; 
                        text-align: left; 
                    }
                    th { 
                        background-color: #f9fafb; 
                        font-weight: bold;
                        color: #374151;
                    }
                    .verified { color: #059669; font-weight: bold; }
                    .discrepancy { color: #d97706; font-weight: bold; }
                    .not-found { color: #dc2626; font-weight: bold; }
                    .footer {
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 2px solid #d1d5db;
                        text-align: center;
                        color: #6b7280;
                        font-size: 11px;
                    }
                    @media print {
                        body { -webkit-print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <h1>Asset Verification Report</h1>
                
                <div class="header-info">
                    <div>
                        <div class="info-item">
                            <span class="label">Task ID:</span> ${task.task_id}
                        </div>
                        <div class="info-item">
                            <span class="label">Task Name:</span> ${task.task_name}
                        </div>
                        <div class="info-item">
                            <span class="label">Type:</span> ${task.task_type}
                        </div>
                        <div class="info-item">
                            <span class="label">Location:</span> ${task.location_name || 'All Locations'}
                        </div>
                    </div>
                    <div>
                        <div class="info-item">
                            <span class="label">Scheduled:</span> ${task.scheduled_date}
                        </div>
                        <div class="info-item">
                            <span class="label">Assigned To:</span> ${task.assigned_to_name}
                        </div>
                        <div class="info-item">
                            <span class="label">Status:</span> ${task.status}
                        </div>
                        <div class="info-item">
                            <span class="label">Generated:</span> ${new Date().toLocaleString()}
                        </div>
                    </div>
                </div>

                <h2>Summary Statistics</h2>
                <div class="kpi-grid">
                    <div class="kpi-card">
                        <div class="kpi-value">${task.total_assets}</div>
                        <div class="kpi-label">Total Assets</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value" style="color: #059669;">${verified.length}</div>
                        <div class="kpi-label">Verified</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value" style="color: #d97706;">${discrepancies.length}</div>
                        <div class="kpi-label">Discrepancies</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value" style="color: #dc2626;">${notFound.length}</div>
                        <div class="kpi-label">Not Found</div>
                    </div>
                </div>

                <div class="kpi-grid">
                    <div class="kpi-card">
                        <div class="kpi-value">${Math.round(completionRate)}%</div>
                        <div class="kpi-label">Completion Rate</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">${Math.round(accuracyRate)}%</div>
                        <div class="kpi-label">Accuracy Rate</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">${locationMismatches.length}</div>
                        <div class="kpi-label">Location Issues</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">${custodianMismatches.length}</div>
                        <div class="kpi-label">Custodian Issues</div>
                    </div>
                </div>

                ${discrepancies.length > 0 ? `
                    <h2>Discrepancies & Issues</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Asset Tag</th>
                                <th>Asset Name</th>
                                <th>Issue Type</th>
                                <th>Details</th>
                                <th>Action Required</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${discrepancies.map(v => `
                                <tr>
                                    <td>${v.asset_tag}</td>
                                    <td>${v.asset_name}</td>
                                    <td class="discrepancy">${v.verification_status}</td>
                                    <td>${v.discrepancy_details || 'N/A'}</td>
                                    <td>${v.action_required ? 'Yes' : 'No'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : ''}

                ${notFound.length > 0 ? `
                    <h2>Assets Not Found</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Asset Tag</th>
                                <th>Asset Name</th>
                                <th>Expected Location</th>
                                <th>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${notFound.map(v => `
                                <tr>
                                    <td>${v.asset_tag}</td>
                                    <td>${v.asset_name}</td>
                                    <td>${v.expected_location}</td>
                                    <td>${v.notes || 'N/A'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : ''}

                <h2>All Verification Records</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Asset Tag</th>
                            <th>Asset Name</th>
                            <th>Status</th>
                            <th>Location</th>
                            <th>Condition</th>
                            <th>Verified By</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${verifications.map(v => `
                            <tr>
                                <td>${v.asset_tag}</td>
                                <td>${v.asset_name}</td>
                                <td class="${v.verification_status === 'verified' ? 'verified' : 'discrepancy'}">
                                    ${v.verification_status}
                                </td>
                                <td>${v.actual_location} ${v.location_match ? '✓' : '✗'}</td>
                                <td>${v.actual_condition}</td>
                                <td>${v.verified_by_name}</td>
                                <td>${new Date(v.verification_date).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="footer">
                    <p>Asset Verification Report | Generated on ${new Date().toLocaleString()}</p>
                    <p>${task.task_name} | Company Fixed Asset Management System</p>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
        
        setTimeout(() => {
            printWindow.print();
        }, 500);
    };

    const handleDownload = () => {
        const data = verifications.map(v => ({
            'Task ID': task.task_id,
            'Asset Tag': v.asset_tag,
            'Asset Number': v.asset_number,
            'Asset Name': v.asset_name,
            'Verification Status': v.verification_status,
            'Expected Location': v.expected_location,
            'Actual Location': v.actual_location,
            'Location Match': v.location_match ? 'Yes' : 'No',
            'Condition': v.actual_condition,
            'Verified By': v.verified_by_name,
            'Verification Date': v.verification_date,
            'Discrepancy Details': v.discrepancy_details || '',
            'Notes': v.notes || ''
        }));

        const csv = [
            Object.keys(data[0]).join(','),
            ...data.map(row => Object.values(row).map(val => `"${val}"`).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `verification-report-${task.task_id}-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>{task.task_name}</CardTitle>
                        <p className="text-sm text-gray-600 mt-1">
                            Verification Report - {new Date().toLocaleDateString()}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleDownload}>
                            <Download className="w-4 h-4 mr-2" />
                            CSV
                        </Button>
                        <Button variant="outline" size="sm" onClick={handlePrint}>
                            <Printer className="w-4 h-4 mr-2" />
                            Print
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                            <span className="text-sm font-medium text-green-900">Verified</span>
                        </div>
                        <p className="text-3xl font-bold text-green-700">{verified.length}</p>
                    </div>
                    
                    <div className="bg-yellow-50 p-4 rounded-lg border-2 border-yellow-200">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-5 h-5 text-yellow-600" />
                            <span className="text-sm font-medium text-yellow-900">Discrepancies</span>
                        </div>
                        <p className="text-3xl font-bold text-yellow-700">{discrepancies.length}</p>
                    </div>
                    
                    <div className="bg-red-50 p-4 rounded-lg border-2 border-red-200">
                        <div className="flex items-center gap-2 mb-2">
                            <XCircle className="w-5 h-5 text-red-600" />
                            <span className="text-sm font-medium text-red-900">Not Found</span>
                        </div>
                        <p className="text-3xl font-bold text-red-700">{notFound.length}</p>
                    </div>
                    
                    <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-5 h-5 text-blue-600" />
                            <span className="text-sm font-medium text-blue-900">Completion</span>
                        </div>
                        <p className="text-3xl font-bold text-blue-700">{Math.round(completionRate)}%</p>
                    </div>
                </div>

                {/* Progress */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="font-medium">Overall Progress</span>
                        <span>{verifications.length} / {task.total_assets} assets</span>
                    </div>
                    <Progress value={completionRate} className="h-3" />
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="font-medium">Accuracy Rate</span>
                        <span className="text-emerald-600 font-bold">{Math.round(accuracyRate)}%</span>
                    </div>
                    <Progress value={accuracyRate} className="h-3 bg-emerald-100" />
                </div>

                {/* Issue Breakdown */}
                <div className="grid grid-cols-3 gap-4">
                    <Card>
                        <CardContent className="pt-4 text-center">
                            <MapPin className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-orange-700">{locationMismatches.length}</p>
                            <p className="text-xs text-gray-600">Location Mismatches</p>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardContent className="pt-4 text-center">
                            <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-amber-700">{conditionIssues.length}</p>
                            <p className="text-xs text-gray-600">Condition Issues</p>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardContent className="pt-4 text-center">
                            <XCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-red-700">{custodianMismatches.length}</p>
                            <p className="text-xs text-gray-600">Custodian Mismatches</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Discrepancies List */}
                {discrepancies.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="font-semibold text-lg">Discrepancies Requiring Action</h3>
                        {discrepancies.map((v, idx) => (
                            <div key={idx} className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-mono text-xs font-bold">{v.asset_tag}</span>
                                            <span className="text-sm font-medium">{v.asset_name}</span>
                                        </div>
                                        <p className="text-sm text-gray-700">{v.discrepancy_details}</p>
                                        {v.corrective_action && (
                                            <p className="text-xs text-gray-600 mt-1">
                                                <strong>Action:</strong> {v.corrective_action}
                                            </p>
                                        )}
                                    </div>
                                    <Badge className="bg-yellow-600">
                                        {v.verification_status}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Not Found List */}
                {notFound.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="font-semibold text-lg text-red-700">Assets Not Found</h3>
                        {notFound.map((v, idx) => (
                            <div key={idx} className="bg-red-50 border-l-4 border-red-400 p-3 rounded">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="font-mono text-xs font-bold">{v.asset_tag}</span>
                                        <span className="text-sm font-medium ml-2">{v.asset_name}</span>
                                        <p className="text-xs text-gray-600 mt-1">
                                            Expected: {v.expected_location}
                                        </p>
                                    </div>
                                    <Badge className="bg-red-600">Not Found</Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}