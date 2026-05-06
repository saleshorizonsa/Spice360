import React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, XCircle, AlertTriangle } from "lucide-react";

export default function ApprovalStatusBadge({ status, currentLevel, totalLevels }) {
    const statusConfig = {
        pending: {
            icon: Clock,
            color: "bg-amber-100 text-amber-800",
            label: `Pending (Level ${currentLevel}/${totalLevels})`
        },
        approved: {
            icon: CheckCircle,
            color: "bg-green-100 text-green-800",
            label: "Approved"
        },
        rejected: {
            icon: XCircle,
            color: "bg-red-100 text-red-800",
            label: "Rejected"
        },
        escalated: {
            icon: AlertTriangle,
            color: "bg-orange-100 text-orange-800",
            label: "Escalated"
        },
        cancelled: {
            icon: XCircle,
            color: "bg-gray-100 text-gray-800",
            label: "Cancelled"
        }
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
        <Badge className={config.color}>
            <Icon className="w-3 h-3 mr-1" />
            {config.label}
        </Badge>
    );
}