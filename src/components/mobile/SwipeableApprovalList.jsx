import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, ChevronRight } from "lucide-react";
import moment from "moment";

export default function SwipeableApprovalList({ requests, onApprove, onReject, onView }) {
    const [swipedId, setSwipedId] = useState(null);

    const getTypeColor = (type) => {
        const colors = {
            quotation: "bg-blue-100 text-blue-700",
            sales_order: "bg-emerald-100 text-emerald-700",
            purchase_requisition: "bg-purple-100 text-purple-700",
            purchase_order: "bg-indigo-100 text-indigo-700",
            vendor_invoice: "bg-orange-100 text-orange-700",
            journal_entry: "bg-teal-100 text-teal-700",
            payment: "bg-pink-100 text-pink-700",
            leave_request: "bg-amber-100 text-amber-700",
            expense: "bg-violet-100 text-violet-700"
        };
        return colors[type] || "bg-gray-100 text-gray-700";
    };

    const formatType = (type) => {
        return type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '';
    };

    if (requests.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="font-medium">All caught up!</p>
                <p className="text-sm">No pending approvals</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {requests.map((request) => (
                <div key={request.id} className="relative overflow-hidden rounded-lg">
                    {/* Swipe Actions Background */}
                    <div className="absolute inset-y-0 left-0 w-20 bg-green-500 flex items-center justify-center">
                        <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                    <div className="absolute inset-y-0 right-0 w-20 bg-red-500 flex items-center justify-center">
                        <XCircle className="w-6 h-6 text-white" />
                    </div>

                    {/* Card */}
                    <Card 
                        className="relative bg-white cursor-pointer"
                        onClick={() => onView(request)}
                    >
                        <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Badge className={`${getTypeColor(request.document_type)} text-xs`}>
                                            {formatType(request.document_type)}
                                        </Badge>
                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {moment(request.request_date).fromNow()}
                                        </span>
                                    </div>
                                    <h3 className="font-semibold text-gray-900 truncate">
                                        {request.document_number}
                                    </h3>
                                    <p className="text-sm text-gray-600 truncate">
                                        {request.requested_by_name}
                                    </p>
                                    {request.document_summary && (
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                                            {request.document_summary}
                                        </p>
                                    )}
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="font-bold text-lg text-gray-900">
                                        LKR {request.document_amount?.toLocaleString() || 0}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        Level {request.approval_level}/{request.total_levels_required}
                                    </p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            </div>

                            {/* Quick Action Buttons */}
                            <div className="flex gap-2 mt-3 pt-3 border-t">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onApprove(request);
                                    }}
                                    className="flex-1 flex items-center justify-center gap-1 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium active:bg-green-100"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    Approve
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onReject(request);
                                    }}
                                    className="flex-1 flex items-center justify-center gap-1 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium active:bg-red-100"
                                >
                                    <XCircle className="w-4 h-4" />
                                    Reject
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ))}
        </div>
    );
}