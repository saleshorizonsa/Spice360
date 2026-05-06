import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

export default function StatCard({ title, value, icon: Icon, trend, color = "emerald" }) {
    const colorClasses = {
        emerald: "bg-emerald-500",
        blue: "bg-blue-500",
        amber: "bg-amber-500",
        red: "bg-red-500",
        indigo: "bg-indigo-500"
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <Card className="hover:shadow-lg transition-shadow">
                <CardContent className="p-3 md:p-6">
                    <div className="flex items-start md:items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs md:text-sm font-medium text-gray-600 truncate">{title}</p>
                            <p className="text-xl md:text-3xl font-bold text-gray-900 mt-1 md:mt-2">{value}</p>
                            {trend && (
                                <p className="text-xs md:text-sm text-gray-500 mt-1 truncate hidden md:block">{trend}</p>
                            )}
                        </div>
                        <div className={`${colorClasses[color]} p-2 md:p-3 rounded-lg flex-shrink-0`}>
                            <Icon className="w-4 h-4 md:w-6 md:h-6 text-white" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}