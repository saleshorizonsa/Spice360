import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { Calculator, Users, Loader2 } from "lucide-react";

const GOSI_MAX_WAGE = 45000;

export default function GOSIBulkCalculation({ onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [month, setMonth] = useState(new Date().toISOString().substring(0, 7));
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [results, setResults] = useState(null);

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => matrixSales.entities.Employee.list(),
        initialData: []
    });

    const activeEmployees = employees.filter(e => e.status === 'active');

    const calculateBulkGOSI = async () => {
        setIsProcessing(true);
        setProgress(0);
        
        const contributions = [];
        const errors = [];
        
        for (let i = 0; i < activeEmployees.length; i++) {
            const employee = activeEmployees[i];
            setProgress(((i + 1) / activeEmployees.length) * 100);
            
            try {
                const basicSalary = employee.basic_salary || 0;
                const housingAllowance = employee.housing_allowance || 0;
                const totalWage = basicSalary + housingAllowance;
                const gosiWage = Math.min(totalWage, GOSI_MAX_WAGE);
                
                const isSaudi = employee.nationality === 'Saudi';
                const employeeRate = isSaudi ? 10 : 2;
                const employerRate = isSaudi ? 12 : 2;
                
                const employeeContrib = (gosiWage * employeeRate) / 100;
                const employerContrib = (gosiWage * employerRate) / 100;
                const occupationalHazards = isSaudi ? (gosiWage * 0.75) / 100 : 0;
                const sanid = isSaudi ? (gosiWage * 2) / 100 : 0;
                
                const contribution = await matrixSales.entities.GOSIContribution.create({
                    contribution_id: `GOSI-${month}-${employee.employee_id}`,
                    month: month,
                    employee_id: employee.employee_id,
                    employee_name: employee.full_name,
                    employee_iqama_number: employee.iqama_number || employee.national_id,
                    nationality: employee.nationality,
                    is_saudi: isSaudi,
                    basic_salary: basicSalary,
                    housing_allowance: housingAllowance,
                    gosi_wage: gosiWage,
                    employee_contribution_rate: employeeRate,
                    employer_contribution_rate: employerRate,
                    employee_contribution: employeeContrib,
                    employer_contribution: employerContrib,
                    total_contribution: employeeContrib + employerContrib + occupationalHazards + sanid,
                    occupational_hazards: occupationalHazards,
                    sanid_scheme: sanid,
                    contribution_type: 'regular',
                    department: employee.department,
                    cost_center: employee.cost_center,
                    branch_code: employee.branch_code,
                    status: 'calculated'
                });
                
                contributions.push(contribution);
            } catch (error) {
                errors.push({ employee: employee.full_name, error: error.message });
            }
        }
        
        setResults({
            total: activeEmployees.length,
            successful: contributions.length,
            errors: errors.length,
            errorDetails: errors
        });
        
        setIsProcessing(false);
        queryClient.invalidateQueries({ queryKey: ['gosiContributions'] });
        
        toast({
            title: "GOSI Calculation Complete",
            description: `${contributions.length} contributions calculated successfully`,
        });
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-emerald-600" />
                        Bulk GOSI Calculation
                    </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-6">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h4 className="font-semibold">Active Employees</h4>
                                    <p className="text-sm text-gray-600">
                                        {activeEmployees.length} employees eligible for GOSI
                                    </p>
                                </div>
                                <Users className="w-8 h-8 text-blue-600" />
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <Label>Contribution Month</Label>
                                    <Input
                                        type="month"
                                        value={month}
                                        onChange={(e) => setMonth(e.target.value)}
                                        disabled={isProcessing}
                                    />
                                </div>
                                
                                {isProcessing && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span>Processing...</span>
                                            <span>{Math.round(progress)}%</span>
                                        </div>
                                        <Progress value={progress} />
                                    </div>
                                )}
                                
                                {results && (
                                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                        <h5 className="font-semibold mb-2">Results</h5>
                                        <div className="space-y-1 text-sm">
                                            <p>Total Employees: {results.total}</p>
                                            <p className="text-green-700">Successful: {results.successful}</p>
                                            {results.errors > 0 && (
                                                <p className="text-red-700">Errors: {results.errors}</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                    
                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={onClose} disabled={isProcessing}>
                            {results ? 'Close' : 'Cancel'}
                        </Button>
                        <Button
                            onClick={calculateBulkGOSI}
                            disabled={isProcessing || !month}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Calculator className="w-4 h-4 mr-2" />
                                    Calculate GOSI
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}