import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, ChevronRight } from "lucide-react";
import { processApprovalAction } from "../utils/approvalWorkflow";
import { useToast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function QuickApprovalWidget() {
    const [user, setUser] = useState(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();

    useEffect(() => {
        const fetchUser = async () => {
            const currentUser = await matrixSales.auth.me();
            setUser(currentUser);
        };
        fetchUser();
    }, []);

    const { data: approvalRequests = [] } = useQuery({
        queryKey: ['approvalRequests'],
        queryFn: () => matrixSales.entities.ApprovalRequest.list('-request_date', 100),
        initialData: []
    });

    const pendingRequests = approvalRequests.filter(r => 
        r.status === 'pending' && 
        (r.current_approver_email === user?.email || r.current_approver_role === user?.approval_role)
    );

    const quickApproveMutation = useMutation({
        mutationFn: async ({ requestId, action }) => {
            return await processApprovalAction(
                requestId,
                action,
                action === 'approve' ? 'Quick approved' : 'Quick rejected',
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
        }
    });

    if (!user || pendingRequests.length === 0) return null;

    return (
        <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="w-5 h-5 text-amber-600" />
                    Pending Your Approval ({pendingRequests.length})
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {pendingRequests.slice(0, 5).map(request => (
                    <div key={request.id} className="bg-white p-3 rounded-lg border shadow-sm">
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge className="bg-blue-100 text-blue-800">
                                        {request.document_type}
                                    </Badge>
                                    <span className="font-semibold text-sm">{request.document_number}</span>
                                </div>
                                <p className="text-sm text-gray-600">
                                    LKR {request.document_amount?.toLocaleString()} • {request.requested_by_name}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Level {request.approval_level} of {request.total_levels_required}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                className="flex-1 bg-green-600 hover:bg-green-700"
                                onClick={() => quickApproveMutation.mutate({ 
                                    requestId: request.request_id, 
                                    action: 'approve' 
                                })}
                                disabled={quickApproveMutation.isPending}
                            >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Approve
                            </Button>
                            <Button
                                size="sm"
                                variant="destructive"
                                className="flex-1"
                                onClick={() => quickApproveMutation.mutate({ 
                                    requestId: request.request_id, 
                                    action: 'reject' 
                                })}
                                disabled={quickApproveMutation.isPending}
                            >
                                <XCircle className="w-3 h-3 mr-1" />
                                Reject
                            </Button>
                        </div>
                    </div>
                ))}
                
                {pendingRequests.length > 5 && (
                    <Link to={createPageUrl('Approvals')}>
                        <Button variant="outline" className="w-full">
                            View All {pendingRequests.length} Approvals
                            <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                    </Link>
                )}
            </CardContent>
        </Card>
    );
}