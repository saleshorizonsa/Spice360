import React from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export default function CinnamonYieldReport() {
    const { data: batches = [] } = useQuery({
        queryKey: ["cinnamonBatches"],
        queryFn: () => matrixSales.entities.CinnamonBatch.list(),
        initialData: [],
    });

    const { data: gradingOutputs = [] } = useQuery({
        queryKey: ["cinnamonGradingOutputs"],
        queryFn: () => matrixSales.entities.CinnamonGradingOutput.list(),
        initialData: [],
    });

    // All grade codes present across all grading outputs (for dynamic columns)
    const allGrades = [...new Set(gradingOutputs.map((g) => g.grade_code))].sort();

    const reportRows = batches.map((batch) => {
        const batchOutputs = gradingOutputs.filter((g) => g.batch_number === batch.batch_number);
        const totalOutputKg = batchOutputs.reduce(
            (sum, g) => sum + (parseFloat(g.output_weight_kg) || 0),
            0
        );
        const inputKg = parseFloat(batch.input_weight_kg) || 0;
        const lossKg  = inputKg - totalOutputKg;
        const yieldPct = inputKg > 0 ? ((totalOutputKg / inputKg) * 100).toFixed(1) : null;

        const gradeBreakdown = batchOutputs.reduce((acc, g) => {
            acc[g.grade_code] = (acc[g.grade_code] || 0) + (parseFloat(g.output_weight_kg) || 0);
            return acc;
        }, {});

        return { ...batch, inputKg, totalOutputKg, lossKg, yieldPct, gradeBreakdown };
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-emerald-600" />
                    Yield Report
                </CardTitle>
            </CardHeader>
            <CardContent>
                {reportRows.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No batch data yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left">
                                    <th className="pb-2 pr-4 font-semibold whitespace-nowrap">Batch</th>
                                    <th className="pb-2 pr-4 font-semibold">Supplier</th>
                                    <th className="pb-2 pr-4 font-semibold text-right whitespace-nowrap">Input (kg)</th>
                                    <th className="pb-2 pr-4 font-semibold text-right whitespace-nowrap">Output (kg)</th>
                                    <th className="pb-2 pr-4 font-semibold text-right whitespace-nowrap">Loss (kg)</th>
                                    <th className="pb-2 pr-4 font-semibold text-right whitespace-nowrap">Yield %</th>
                                    {allGrades.map((g) => (
                                        <th key={g} className="pb-2 pr-4 font-semibold text-right whitespace-nowrap">
                                            {g} (kg)
                                        </th>
                                    ))}
                                    <th className="pb-2 font-semibold whitespace-nowrap">Stage</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportRows.map((row) => (
                                    <tr key={row.id} className="border-b hover:bg-gray-50">
                                        <td className="py-2 pr-4 font-mono text-xs whitespace-nowrap">
                                            {row.batch_number}
                                        </td>
                                        <td className="py-2 pr-4">{row.supplier}</td>
                                        <td className="py-2 pr-4 text-right">{row.inputKg.toFixed(3)}</td>
                                        <td className="py-2 pr-4 text-right">{row.totalOutputKg.toFixed(3)}</td>
                                        <td className="py-2 pr-4 text-right text-red-600">
                                            {row.lossKg.toFixed(3)}
                                        </td>
                                        <td className="py-2 pr-4 text-right font-semibold">
                                            {row.yieldPct !== null ? `${row.yieldPct}%` : "—"}
                                        </td>
                                        {allGrades.map((g) => (
                                            <td key={g} className="py-2 pr-4 text-right">
                                                {(row.gradeBreakdown[g] || 0).toFixed(3)}
                                            </td>
                                        ))}
                                        <td className="py-2 capitalize text-xs text-gray-600 whitespace-nowrap">
                                            {row.current_stage?.replace(/_/g, " ")}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
