import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuditTrailForDocument } from "../utils/auditTrail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, User } from "lucide-react";
import { format } from "date-fns";
import { formatActionType, getActionColor, formatFieldName } from "../utils/auditTrail";

export default function DocumentAuditHistory({ documentNumber, entityType }) {
    const { data: auditTrails = [], isLoading } = useQuery({
        queryKey: ['documentAudit', documentNumber],
        queryFn: () => getAuditTrailForDocument(documentNumber),
        enabled: !!documentNumber
    });

    if (!documentNumber) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <History className="w-5 h-5 text-emerald-600" />
                    Change History
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="text-center py-4 text-gray-500">Loading history...</div>
                ) : auditTrails.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">No change history available</div>
                ) : (
                    <ScrollArea className="h-[300px]">
                        <div className="space-y-3">
                            {auditTrails.map((audit, index) => (
                                <div
                                    key={audit.id || index}
                                    className="border-l-4 border-emerald-500 pl-4 py-2 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-start justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <Badge className={getActionColor(audit.action_type)}>
                                                {formatActionType(audit.action_type)}
                                            </Badge>
                                            {audit.severity !== 'info' && (
                                                <Badge variant="outline" className="text-xs">
                                                    {audit.severity}
                                                </Badge>
                                            )}
                                        </div>
                                        <span className="text-xs text-gray-500">
                                            {format(new Date(audit.action_timestamp), 'MMM dd, yyyy HH:mm')}
                                        </span>
                                    </div>

                                    <p className="text-sm text-gray-700 mb-1">
                                        {audit.change_summary}
                                    </p>

                                    <div className="flex items-center gap-3 text-xs text-gray-500">
                                        <div className="flex items-center gap-1">
                                            <User className="w-3 h-3" />
                                            <span>{audit.user_name}</span>
                                        </div>
                                        {audit.branch_code && (
                                            <span>Branch: {audit.branch_code}</span>
                                        )}
                                    </div>

                                    {audit.fields_changed && audit.fields_changed.length > 0 && (
                                        <div className="mt-2 text-xs">
                                            <span className="text-gray-500">Changed: </span>
                                            <span className="text-gray-700">
                                                {audit.fields_changed.map(formatFieldName).join(', ')}
                                            </span>
                                        </div>
                                    )}

                                    {audit.reason && (
                                        <div className="mt-2 bg-yellow-50 p-2 rounded text-xs">
                                            <strong>Reason:</strong> {audit.reason}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
}