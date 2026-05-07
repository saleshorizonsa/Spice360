import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Clock, AlertCircle, FileText, ChevronRight } from "lucide-react";
import DataTable from "../components/erp/DataTable";
import ApprovalMatrixForm from "../components/approvals/ApprovalMatrixForm";
import DocumentList from "../components/shared/DocumentList";
import { useToast } from "@/components/ui/use-toast";
import { processApprovalAction } from "../components/utils/approvalWorkflow";

export default function Approvals() {
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState("pending");
    const [showMatrixDialog, setShowMatrixDialog] = useState(false);
    const [editingMatrix, setEditingMatrix] = useState(null);
    const [showApprovalDialog, setShowApprovalDialog] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [approvalComments, setApprovalComments] = useState("");
    const [approvalAction, setApprovalAction] = useState(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const currentUser = await matrixSales.auth.me();
                setUser(currentUser);
            } catch (error) {
                console.error('Error fetching user:', error);
            }
        };
        fetchUser();
    }, []);

    const { data: approvalRequests = [] } = useQuery({
        queryKey: ['approvalRequests'],
        queryFn: () => matrixSales.entities.ApprovalRequest.list('-request_date'),
        initialData: []
    });

    const { data: approvalMatrices = [] } = useQuery({
        queryKey: ['approvalMatrices'],
        queryFn: () => matrixSales.entities.ApprovalMatrix.list('approval_level'),
        initialData: []
    });

    // Filter requests by status
    const pendingRequests = approvalRequests.filter(r => 
        r.status === 'pending' && 
        (r.current_approver_email === user?.email || r.current_approver_role === user?.approval_role)
    );
    const myRequests = approvalRequests.filter(r => r.requested_by === user?.email);
    const approvedRequests = approvalRequests.filter(r => r.status === 'approved');
    const rejectedRequests = approvalRequests.filter(r => r.status === 'rejected');

    // Stats
    const totalPending = approvalRequests.filter(r => r.status === 'pending').length;
    const myPending = pendingRequests.length;
    const totalApproved = approvedRequests.length;
    const totalRejected = rejectedRequests.length;

    const approvalMutation = useMutation({
        mutationFn: async ({ requestId, action, comments }) => {
            return await processApprovalAction(
                requestId,
                action,
                comments,
                user.email,
                user.full_name
            );
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['approvalRequests'] });
            toast({
                title: "Success",
                description: data.message,
            });
            setShowApprovalDialog(false);
            setSelectedRequest(null);
            setApprovalComments("");
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to process approval",
                variant: "destructive"
            });
        }
    });

    const handleApprovalAction = (request, action) => {
        setSelectedRequest(request);
        setApprovalAction(action);
        setShowApprovalDialog(true);
    };

    const confirmApprovalAction = () => {
        if (!selectedRequest) return;
        
        approvalMutation.mutate({
            requestId: selectedRequest.request_id,
            action: approvalAction,
            comments: approvalComments
        });
    };

    const requestColumns = [
        { header: "Request ID", key: "request_id" },
        { header: "Document Type", key: "document_type", isBadge: true },
        { header: "Document #", key: "document_number" },
        { header: "Requestor", key: "requested_by_name" },
        { 
            header: "Amount", 
            key: "document_amount", 
            render: (val) => `SAR ${val?.toLocaleString() || 0}` 
        },
        { 
            header: "Level", 
            key: "approval_level", 
            render: (val, row) => `${val} of ${row.total_levels_required}` 
        },
        { header: "Current Approver", key: "current_approver_name" },
        { header: "Status", key: "status", isBadge: true },
        {
            header: "Actions",
            key: "actions",
            render: (val, row) => {
                if (row.status === 'pending' && 
                    (row.current_approver_email === user?.email || 
                     row.current_approver_role === user?.approval_role)) {
                    return (
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleApprovalAction(row, 'approve')}
                            >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Approve
                            </Button>
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleApprovalAction(row, 'reject')}
                            >
                                <XCircle className="w-4 h-4 mr-1" />
                                Reject
                            </Button>
                        </div>
                    );
                }
                return null;
            }
        }
    ];

    const matrixColumns = [
        { header: "Document Type", key: "document_type", isBadge: true },
        { 
            header: "Amount Range", 
            key: "threshold_min", 
            render: (val, row) => `${val?.toLocaleString() || 0} - ${row.threshold_max?.toLocaleString() || '∞'}` 
        },
        { header: "Level", key: "approval_level" },
        { header: "Required Role", key: "required_role", isBadge: true },
        { header: "Mandatory", key: "is_mandatory", render: (val) => val ? 'Yes' : 'No' },
        { header: "Status", key: "status", isBadge: true }
    ];

    const getBadgeColor = (value) => {
        const colors = {
            pending: "bg-yellow-100 text-yellow-800",
            approved: "bg-green-100 text-green-800",
            rejected: "bg-red-100 text-red-800",
            cancelled: "bg-gray-100 text-gray-800",
            escalated: "bg-orange-100 text-orange-800",
            active: "bg-green-100 text-green-800",
            inactive: "bg-gray-100 text-gray-800",
            quotation: "bg-blue-100 text-blue-800",
            sales_order: "bg-emerald-100 text-emerald-800",
            purchase_requisition: "bg-purple-100 text-purple-800",
            purchase_order: "bg-indigo-100 text-indigo-800",
            vendor_invoice: "bg-orange-100 text-orange-800",
            journal_entry: "bg-teal-100 text-teal-800",
            payment: "bg-pink-100 text-pink-800",
            leave_request: "bg-amber-100 text-amber-800",
            expense: "bg-violet-100 text-violet-800",
            sales_exec: "bg-blue-100 text-blue-800",
            sales_manager: "bg-emerald-100 text-emerald-800",
            commercial_head: "bg-purple-100 text-purple-800",
            procurement_manager: "bg-indigo-100 text-indigo-800",
            cfo: "bg-red-100 text-red-800",
            controller: "bg-orange-100 text-orange-800"
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

    if (!user) {
        return (
            <div className="p-6 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Approval Management</h1>
                <p className="text-sm md:text-base text-gray-600 mt-1">Multi-level approval workflow for transactions</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    title="Pending My Action"
                    value={myPending}
                    icon={Clock}
                    trend="Requires your approval"
                    color="amber"
                />
                    title="Total Pending"
                    value={totalPending}
                    icon={AlertCircle}
                    trend="All pending approvals"
                    color="blue"
                />
                    title="Approved"
                    value={totalApproved}
                    icon={CheckCircle}
                    trend="Fully approved"
                    color="emerald"
                />
                    title="Rejected"
                    value={totalRejected}
                    icon={XCircle}
                    trend="Rejected requests"
                    color="red"
                />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 md:space-y-6">
                <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full h-auto gap-1">
                    <TabsTrigger value="pending">
                        Pending My Action ({myPending})
                    </TabsTrigger>
                    <TabsTrigger value="my-requests">My Requests</TabsTrigger>
                    <TabsTrigger value="approved">Approved</TabsTrigger>
                    <TabsTrigger value="rejected">Rejected</TabsTrigger>
                    <TabsTrigger value="matrix">Approval Matrix</TabsTrigger>
                </TabsList>

                <TabsContent value="pending">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="w-5 h-5 text-amber-600" />
                                Pending My Approval
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={pendingRequests}
                                columns={requestColumns}
                                getBadgeColor={getBadgeColor}
                                showSearch={false}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="my-requests">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-blue-600" />
                                My Submitted Requests
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={myRequests}
                                columns={requestColumns.filter(col => col.key !== 'actions')}
                                getBadgeColor={getBadgeColor}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="approved">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                Approved Requests
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={approvedRequests}
                                columns={requestColumns.filter(col => col.key !== 'actions')}
                                getBadgeColor={getBadgeColor}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="rejected">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <XCircle className="w-5 h-5 text-red-600" />
                                Rejected Requests
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={rejectedRequests}
                                columns={requestColumns.filter(col => col.key !== 'actions')}
                                getBadgeColor={getBadgeColor}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="matrix">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Approval Matrix Configuration</CardTitle>
                            <Button
                                onClick={() => {
                                    setEditingMatrix(null);
                                    setShowMatrixDialog(true);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                + New Matrix Rule
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={approvalMatrices}
                                columns={matrixColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => {
                                    setEditingMatrix(item);
                                    setShowMatrixDialog(true);
                                }}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Approval Action Dialog */}
            {showApprovalDialog && selectedRequest && (
                <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                {approvalAction === 'approve' ? (
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                ) : (
                                    <XCircle className="w-5 h-5 text-red-600" />
                                )}
                                {approvalAction === 'approve' ? 'Approve' : 'Reject'} Request
                            </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4">
                            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-xs text-gray-500">Document Type</Label>
                                        <p className="font-medium">{selectedRequest.document_type}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-500">Document Number</Label>
                                        <p className="font-medium">{selectedRequest.document_number}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-500">Amount</Label>
                                        <p className="font-medium">SAR {selectedRequest.document_amount?.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-500">Requestor</Label>
                                        <p className="font-medium">{selectedRequest.requested_by_name}</p>
                                    </div>
                                </div>
                                {selectedRequest.document_summary && (
                                    <div className="pt-2 border-t">
                                        <Label className="text-xs text-gray-500">Summary</Label>
                                        <p className="text-sm">{selectedRequest.document_summary}</p>
                                    </div>
                                )}
                            </div>

                            {/* Supporting Documents */}
                            <div>
                                <DocumentList
                                    relatedEntity="approval_request"
                                    relatedEntityId={selectedRequest.id}
                                    relatedDocumentNumber={selectedRequest.request_id}
                                />
                            </div>

                            {/* Approval Chain Progress */}
                            <div>
                                <Label className="text-sm font-medium mb-2 block">Approval Progress</Label>
                                <div className="space-y-2">
                                    {selectedRequest.approval_chain?.map((level, idx) => (
                                        <div key={idx} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                                            <div className="flex items-center gap-2 flex-1">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                                    level.status === 'approved' ? 'bg-green-100 text-green-600' :
                                                    level.status === 'rejected' ? 'bg-red-100 text-red-600' :
                                                    level.level === selectedRequest.approval_level ? 'bg-amber-100 text-amber-600' :
                                                    'bg-gray-200 text-gray-400'
                                                }`}>
                                                    {level.status === 'approved' ? <CheckCircle className="w-4 h-4" /> :
                                                     level.status === 'rejected' ? <XCircle className="w-4 h-4" /> :
                                                     <span className="text-sm font-bold">{level.level}</span>}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">{level.role}</p>
                                                    {level.approver_name && (
                                                        <p className="text-xs text-gray-500">{level.approver_name}</p>
                                                    )}
                                                </div>
                                            </div>
                                            {idx < selectedRequest.approval_chain.length - 1 && (
                                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <Label>Comments {approvalAction === 'reject' && '*'}</Label>
                                <Textarea
                                    value={approvalComments}
                                    onChange={(e) => setApprovalComments(e.target.value)}
                                    placeholder={approvalAction === 'approve' ? 
                                        "Add optional comments..." : 
                                        "Please provide reason for rejection"}
                                    rows={3}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowApprovalDialog(false);
                                    setSelectedRequest(null);
                                    setApprovalComments("");
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={confirmApprovalAction}
                                disabled={approvalAction === 'reject' && !approvalComments}
                                className={approvalAction === 'approve' ? 
                                    "bg-green-600 hover:bg-green-700" : 
                                    "bg-red-600 hover:bg-red-700"}
                            >
                                {approvalAction === 'approve' ? 'Approve' : 'Reject'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* Approval Matrix Dialog */}
            {showMatrixDialog && (
                <ApprovalMatrixForm
                    item={editingMatrix}
                    onClose={() => {
                        setShowMatrixDialog(false);
                        setEditingMatrix(null);
                    }}
                />
            )}
        </div>
    );
}