import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export default function CostCenterForm({ item, onClose }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    cost_center_code: "",
    cost_center_name: "",
    description: "",
    manager: "",
    budget_amount: 0,
    status: "active",
  });

  useEffect(() => {
    if (item) setFormData(item);
  }, [item]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (item) return matrixSales.entities.CostCenter.update(item.id, data);
      return matrixSales.entities.CostCenter.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["costCenters"] });
      toast({ title: "Success", description: `Cost center ${item ? "updated" : "created"} successfully` });
      onClose();
    },
    onError: (err) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const handleChange = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Edit Cost Center" : "New Cost Center"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Code *</Label>
              <Input
                value={formData.cost_center_code}
                onChange={(e) => handleChange("cost_center_code", e.target.value.toUpperCase())}
                required
                placeholder="CC001"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(val) => handleChange("status", val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Name *</Label>
            <Input
              value={formData.cost_center_name}
              onChange={(e) => handleChange("cost_center_name", e.target.value)}
              required
              placeholder="e.g. Production / Administration / Marketing"
            />
          </div>

          <div>
            <Label>Manager</Label>
            <Input
              value={formData.manager}
              onChange={(e) => handleChange("manager", e.target.value)}
              placeholder="Responsible manager"
            />
          </div>

          <div>
            <Label>Annual Budget (LKR)</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.budget_amount}
              onChange={(e) => handleChange("budget_amount", parseFloat(e.target.value) || 0)}
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              rows={2}
              placeholder="Optional notes about this cost center"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={saveMutation.isPending}
            >
              {item ? "Update" : "Create"} Cost Center
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
