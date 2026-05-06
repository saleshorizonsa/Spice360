import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
    History, 
    Search, 
    Filter, 
    FileText, 
    Clock,
    CheckCircle,
    XCircle,
    Edit,
    Trash2,
    Plus
} from "lucide-react";
import { formatActionType, getActionColor, formatFieldName } from "../utils/auditTrail";
import { format } from "date-fns";

export default function AuditTrailViewer() {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterEntity, setFilterEntity] = useState('all');
    const [filterAction, setFilterAction] = useState('all');
    const [filterUser, setFilterUser] = useState('');
    const [selectedAudit, setSelectedAudit] = useState(null);
    const [showDetails, setShowDetails] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const { data: auditTrails = [], isLoading } = useQuery({
        queryKey: ['auditTrails'],
        queryFn: () => base44.entities.AuditTrail.list('-action_timestamp', 500),
        initialData: []
    });

    // Filter audit trails
    const filteredTrails = auditTrails.filter(trail => {
        // Text search
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm || 
            trail.document_number?.toLowerCase().includes(searchLower) ||
            trail.user_name?.toLowerCase().includes(searchLower) ||
            trail.user_email?.toLowerCase().includes(searchLower) ||
            trail.change_summary?.toLowerCase().includes(searchLower);

        // Entity type filter
        const matchesEntity = filterEntity === 'all' || trail.entity_type === filterEntity;

        // Action type filter
        const matchesAction = filterAction === 'all' || trail.action_type === filterAction;

        // User filter
        const matchesUser = !filterUser || trail.user_email === filterUser;

        // Date range filter
        const trailDate = new Date(trail.action_timestamp);
        const matchesDateFrom = !dateFrom || trailDate >= new Date(dateFrom);
        const matchesDateTo = !dateTo || trailDate <= new Date(dateTo + 'T23:59:59');

        return matchesSearch && matchesEntity && matchesAction && matchesUser && matchesDateFrom && matchesDateTo;
    });

    // Get unique users for filter
    const uniqueUsers = [...new Set(auditTrails.map(t => t.user_email))];

    const getSeverityBadge = (severity) => {
        const colors = {
            info: "bg-blue-100 text-blue-800",
            warning: "bg-yellow-100 text-yellow-800",
            critical: "bg-red-100 text-red-800"
        };
        return colors[severity] || colors.info;
    };

    const getActionIcon = (actionType) => {
        const icons = {
            create: Plus,
            update: Edit,
            delete: Trash2,
            approve: CheckCircle,
            reject: XCircle,
            cancel: XCircle
        };
        const Icon = icons[actionType] || FileText;
        return <Icon className="w-4 h-4" />;
    };

    const handleViewDetails = (audit) => {
        setSelectedAudit(audit);
        setShowDetails(true);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <History className="w-8 h-8 text-emerald-600" />
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Audit Trail</h2>
                    <p className="text-gray-600">Comprehensive system activity log</p>
                </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="text-sm text-gray-600">Total Events</div>
                        <div className="text-2xl font-bold">{filteredTrails.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="text-sm text-gray-600">Today's Activity</div>
                        <div className="text-2xl font-bold">
                            {filteredTrails.filter(t => 
                                new Date(t.action_timestamp).toDateString() === new Date().toDateString()
                            ).length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="text-sm text-gray-600">Critical Events</div>
                        <div className="text-2xl font-bold text-red-600">
                            {filteredTrails.filter(t => t.severity === 'critical').length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="text-sm text-gray-600">Active Users</div>
                        <div className="text-2xl font-bold">{uniqueUsers.length}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="w-5 h-5" />
                        Filters
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                        <div className="lg:col-span-2">
                            <Label>Search</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    placeholder="Document #, user, or description..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <div>
                            <Label>Entity Type</Label>
                            <Select value={filterEntity} onValueChange={setFilterEntity}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="sales_order">Sales Orders</SelectItem>
                                    <SelectItem value="purchase_order">Purchase Orders</SelectItem>
                                    <SelectItem value="journal_entry">Journal Entries</SelectItem>
                                    <SelectItem value="invoice">Invoices</SelectItem>
                                    <SelectItem value="payment">Payments</SelectItem>
                                    <SelectItem value="leave_request">Leave Requests</SelectItem>
                                    <SelectItem value="approval_request">Approvals</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Action Type</Label>
                            <Select value={filterAction} onValueChange={setFilterAction}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Actions</SelectItem>
                                    <SelectItem value="create">Create</SelectItem>
                                    <SelectItem value="update">Update</SelectItem>
                                    <SelectItem value="delete">Delete</SelectItem>
                                    <SelectItem value="approve">Approve</SelectItem>
                                    <SelectItem value="reject">Reject</SelectItem>
                                    <SelectItem value="post">Post</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Date From</Label>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                            />
                        </div>

                        <div>
                            <Label>Date To</Label>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                            />
                        </div>
                    </div>

                    {(searchTerm || filterEntity !== 'all' || filterAction !== 'all' || dateFrom || dateTo) && (
                        <div className="mt-4">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setSearchTerm('');
                                    setFilterEntity('all');
                                    setFilterAction('all');
                                    setDateFrom('');
                                    setDateTo('');
                                }}
                            >
                                Clear Filters
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Audit Trail List */}
            <Card>
                <CardHeader>
                    <CardTitle>Activity Log ({filteredTrails.length} events)</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8 text-gray-500">Loading audit trails...</div>
                    ) : filteredTrails.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">No audit trails found</div>
                    ) : (
                        <ScrollArea className="h-[600px]">
                            <div className="space-y-3">
                                {filteredTrails.map((audit) => (
                                    <div
                                        key={audit.id}
                                        className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                                        onClick={() => handleViewDetails(audit)}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-3 flex-1">
                                                <div className={`p-2 rounded-lg ${getActionColor(audit.action_type)}`}>
                                                    {getActionIcon(audit.action_type)}
                                                </div>
                                                
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-semibold text-gray-900">
                                                            {audit.user_name}
                                                        </span>
                                                        <Badge className={getActionColor(audit.action_type)}>
                                                            {formatActionType(audit.action_type)}
                                                        </Badge>
                                                        <Badge variant="outline">
                                                            {audit.entity_type.replace('_', ' ')}
                                                        </Badge>
                                                        {audit.severity !== 'info' && (
                                                            <Badge className={getSeverityBadge(audit.severity)}>
                                                                {audit.severity}
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    <p className="text-sm text-gray-600 mb-2">
                                                        {audit.change_summary}
                                                    </p>

                                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                                        <div className="flex items-center gap-1">
                                                            <FileText className="w-3 h-3" />
                                                            <span>{audit.document_number}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            <span>
                                                                {format(new Date(audit.action_timestamp), 'MMM dd, yyyy HH:mm:ss')}
                                                            </span>
                                                        </div>
                                                        {audit.branch_code && (
                                                            <div className="flex items-center gap-1">
                                                                <span>Branch: {audit.branch_code}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {audit.fields_changed && audit.fields_changed.length > 0 && (
                                                        <div className="mt-2 text-xs text-gray-500">
                                                            Fields: {audit.fields_changed.map(formatFieldName).join(', ')}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>

            {/* Details Dialog */}
            {showDetails && selectedAudit && (
                <Dialog open={showDetails} onOpenChange={setShowDetails}>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <History className="w-5 h-5" />
                                Audit Trail Details
                            </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4">
                            {/* Basic Info */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Action Information</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label className="text-gray-600">Action Type</Label>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge className={getActionColor(selectedAudit.action_type)}>
                                                    {formatActionType(selectedAudit.action_type)}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div>
                                            <Label className="text-gray-600">Severity</Label>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge className={getSeverityBadge(selectedAudit.severity)}>
                                                    {selectedAudit.severity}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div>
                                            <Label className="text-gray-600">Entity Type</Label>
                                            <p className="mt-1">{selectedAudit.entity_type.replace('_', ' ')}</p>
                                        </div>
                                        <div>
                                            <Label className="text-gray-600">Document Number</Label>
                                            <p className="mt-1 font-mono">{selectedAudit.document_number}</p>
                                        </div>
                                        <div>
                                            <Label className="text-gray-600">Timestamp</Label>
                                            <p className="mt-1">
                                                {format(new Date(selectedAudit.action_timestamp), 'PPpp')}
                                            </p>
                                        </div>
                                        <div>
                                            <Label className="text-gray-600">Audit ID</Label>
                                            <p className="mt-1 font-mono text-xs">{selectedAudit.audit_id}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* User Info */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">User Information</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label className="text-gray-600">User Name</Label>
                                            <p className="mt-1">{selectedAudit.user_name}</p>
                                        </div>
                                        <div>
                                            <Label className="text-gray-600">Email</Label>
                                            <p className="mt-1">{selectedAudit.user_email}</p>
                                        </div>
                                        <div>
                                            <Label className="text-gray-600">Role</Label>
                                            <p className="mt-1">{selectedAudit.user_role}</p>
                                        </div>
                                        {selectedAudit.branch_code && (
                                            <div>
                                                <Label className="text-gray-600">Branch</Label>
                                                <p className="mt-1">{selectedAudit.branch_code}</p>
                                            </div>
                                        )}
                                        {selectedAudit.department && (
                                            <div>
                                                <Label className="text-gray-600">Department</Label>
                                                <p className="mt-1">{selectedAudit.department}</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Changes */}
                            {selectedAudit.changes && selectedAudit.changes.before && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Changes Made</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {selectedAudit.fields_changed?.map((field) => (
                                                <div key={field} className="border-b pb-3">
                                                    <Label className="text-gray-600 font-semibold">
                                                        {formatFieldName(field)}
                                                    </Label>
                                                    <div className="grid grid-cols-2 gap-4 mt-2">
                                                        <div>
                                                            <div className="text-xs text-gray-500 mb-1">Before:</div>
                                                            <div className="bg-red-50 p-2 rounded text-sm">
                                                                {JSON.stringify(selectedAudit.changes.before[field]) || 'N/A'}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="text-xs text-gray-500 mb-1">After:</div>
                                                            <div className="bg-green-50 p-2 rounded text-sm">
                                                                {JSON.stringify(selectedAudit.changes.after[field]) || 'N/A'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Additional Info */}
                            {(selectedAudit.reason || selectedAudit.notes) && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Additional Information</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {selectedAudit.reason && (
                                            <div>
                                                <Label className="text-gray-600">Reason</Label>
                                                <p className="mt-1">{selectedAudit.reason}</p>
                                            </div>
                                        )}
                                        {selectedAudit.notes && (
                                            <div>
                                                <Label className="text-gray-600">Notes</Label>
                                                <p className="mt-1">{selectedAudit.notes}</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}