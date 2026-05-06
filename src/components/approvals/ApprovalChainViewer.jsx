import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, ChevronRight, User } from "lucide-react";
import { format } from "date-fns";

export default function ApprovalChainViewer({ approvalRequest }) {
    if (!approvalRequest?.approval_chain) return null;

    const getStatusIcon = (status, isCurrentLevel) => {
        if (status === 'approved') return <CheckCircle className="w-5 h-5 text-green-600" />;
        if (status === 'rejected') return <XCircle className="w-5 h-5 text-red-600" />;
        if (isCurrentLevel) return <Clock className="w-5 h-5 text-amber-600" />;
        return <Clock className="w-5 h-5 text-gray-400" />;
    };

    const getStatusColor = (status, isCurrentLevel) => {
        if (status === 'approved') return 'bg-green-50 border-green-200';
        if (status === 'rejected') return 'bg-red-50 border-red-200';
        if (isCurrentLevel) return 'bg-amber-50 border-amber-300';
        return 'bg-gray-50 border-gray-200';
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Approval Chain</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {approvalRequest.approval_chain.map((level, index) => {
                        const isCurrentLevel = level.level === approvalRequest.approval_level;
                        const isPending = level.status === 'pending';
                        
                        return (
                            <div key={index}>
                                <div className={`p-4 rounded-lg border-2 ${getStatusColor(level.status, isCurrentLevel)}`}>
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5">
                                            {getStatusIcon(level.status, isCurrentLevel)}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Badge variant="outline">Level {level.level}</Badge>
                                                <span className="font-semibold text-sm">
                                                    {level.role?.replace(/_/g, ' ').toUpperCase()}
                                                </span>
                                                {isCurrentLevel && isPending && (
                                                    <Badge className="bg-amber-500">Current</Badge>
                                                )}
                                            </div>
                                            
                                            {level.approver_name && (
                                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                                    <User className="w-4 h-4" />
                                                    <span>{level.approver_name}</span>
                                                    {level.approver_email && (
                                                        <span className="text-gray-500">({level.approver_email})</span>
                                                    )}
                                                </div>
                                            )}
                                            
                                            {level.action_date && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {level.status === 'approved' ? 'Approved' : 'Rejected'} on {format(new Date(level.action_date), 'MMM dd, yyyy HH:mm')}
                                                </p>
                                            )}
                                            
                                            {level.comments && (
                                                <div className="mt-2 p-2 bg-white rounded border">
                                                    <p className="text-xs text-gray-600 italic">"{level.comments}"</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                {index < approvalRequest.approval_chain.length - 1 && (
                                    <div className="flex justify-center py-1">
                                        <ChevronRight className="w-5 h-5 text-gray-400 rotate-90" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}