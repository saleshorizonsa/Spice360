import React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, TrendingUp, TrendingDown } from "lucide-react";

export default function MobileDashboardWidget({ 
    title, 
    value, 
    subValue, 
    icon: Icon, 
    trend,
    trendDirection,
    color = "emerald", 
    linkTo,
    linkUrl,
    badge
}) {
    const colorClasses = {
        emerald: { bg: "bg-emerald-100", text: "text-emerald-600", icon: "bg-emerald-600" },
        blue: { bg: "bg-blue-100", text: "text-blue-600", icon: "bg-blue-600" },
        amber: { bg: "bg-amber-100", text: "text-amber-600", icon: "bg-amber-600" },
        red: { bg: "bg-red-100", text: "text-red-600", icon: "bg-red-600" },
        purple: { bg: "bg-purple-100", text: "text-purple-600", icon: "bg-purple-600" },
        indigo: { bg: "bg-indigo-100", text: "text-indigo-600", icon: "bg-indigo-600" }
    };

    const colors = colorClasses[color] || colorClasses.emerald;

    const content = (
        <Card className="overflow-hidden active:scale-[0.98] transition-transform">
            <CardContent className="p-4">
                <div className="flex items-center gap-3">
                    <div className={`${colors.icon} p-2.5 rounded-xl`}>
                        <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-500 truncate">{title}</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xl font-bold text-gray-900">{value}</p>
                            {badge && (
                                <Badge className="bg-red-500 text-white text-xs px-1.5 py-0">
                                    {badge}
                                </Badge>
                            )}
                        </div>
                        {subValue && (
                            <p className="text-xs text-gray-500 truncate">{subValue}</p>
                        )}
                    </div>
                    {trend && (
                        <div className={`flex items-center gap-1 text-xs ${
                            trendDirection === 'up' ? 'text-green-600' : 
                            trendDirection === 'down' ? 'text-red-600' : 'text-gray-500'
                        }`}>
                            {trendDirection === 'up' && <TrendingUp className="w-3 h-3" />}
                            {trendDirection === 'down' && <TrendingDown className="w-3 h-3" />}
                            <span>{trend}</span>
                        </div>
                    )}
                    {linkTo && <ChevronRight className="w-5 h-5 text-gray-400" />}
                </div>
            </CardContent>
        </Card>
    );

    if (linkUrl) {
        return (
            <Link to={linkUrl}>
                {content}
            </Link>
        );
    }

    return content;
}