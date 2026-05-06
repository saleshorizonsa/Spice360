import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../../utils";

export default function PermissionDenied({ module, action, returnPath = "Dashboard" }) {
    return (
        <div className="p-6">
            <Card className="border-red-200">
                <CardContent className="pt-6">
                    <div className="text-center py-12">
                        <Lock className="w-16 h-16 text-red-400 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
                        <p className="text-gray-600 mb-2">
                            You don't have permission to {action} {module}.
                        </p>
                        <p className="text-sm text-gray-500 mb-6">
                            Please contact your system administrator to request access.
                        </p>
                        <Link to={createPageUrl(returnPath)}>
                            <Button variant="outline">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Return to {returnPath}
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}