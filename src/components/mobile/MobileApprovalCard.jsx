import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Clock, ChevronRight } from "lucide-react";
import moment from "moment";

export default function MobileApprovalCard({ request, onApprove, onReject, onView }) {
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

    return (
        <Card className="mb-3 overflow-hidden">
            <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                        <Badge className={`${getTypeColor(request.document_type)} mb-2`}>
                            {formatType(request.document_type)}
                        </Badge>
                        <h3 className="font-semibold text-gray-900">
                            {request.document_number}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                            {request.requested_by_name}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-lg text-gray-900">
                            LKR {request.document_amount?.toLocaleString() || 0}
                        </p>
                        <p className="text-xs text-gray-500 flex items-center justify-end gap-1 mt-1">
                            <Clock className="w-3 h-3" />
                            {moment(request.request_date).fromNow()}
                        </p>
                    </div>
                </div>

                {request.document_summary && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2 bg-gray-50 p-2 rounded">
                        {request.document_summary}
                    </p>
                )}

                <div className="flex items-center gap-2 pt-3 border-t">
                    <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700 h-10"
                        onClick={() => onApprove(request)}
                    >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                    </Button>
                    <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 h-10"
                        onClick={() => onReject(request)}
                    >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-10 px-3"
                        onClick={() => onView(request)}
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}