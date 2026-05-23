import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { matrixSales } from "@/api/matrixSalesClient";
import SearchableSelect from "@/components/shared/SearchableSelect";
import { useOrganization } from "@/components/utils/OrganizationContext";
import { calculateNextBillingDate } from "@/lib/serviceBilling";
import { Plus, Trash2 } from "lucide-react";

const emptyLine = {
  service_description: "Monthly IT Support Services",
  quantity: 1,
  unit: "month",
  unit_price: 0,
  vat_rate: 15,
  discount_percent: 0
};

export default function ServiceContractForm({ item, onClose }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currentOrg } = useOrganization();
  const [formData, setFormData] = useState(item || {
    contract_number: "",
    customer_code: "",
    customer_name: "",
    customer_email: "",
    customer_vat_number: "",
    customer_address: "",
    service_type: "managed_services",
    billing_cycle: "monthly",
    custom_billing_months: 1,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
    next_billing_date: new Date().toISOString().slice(0, 10),
    monthly_amount: 0,
    vat_rate: 15,
    payment_terms: "net_30",
    invoice_type: "standard_tax_invoice",
    auto_send_invoice: false,
    auto_reminders: true,
    auto_renew: true,
    preferred_language: "bilingual",
    preferred_delivery_method: "email",
    sla_details: "",
    notes: "",
    status: "active",
    organization_id: currentOrg?.id,
    tenant_id: currentOrg?.id,
    service_lines: [{ ...emptyLine }]
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", currentOrg?.id],
    queryFn: () => matrixSales.entities.Customer.list(),
    initialData: []
  });

  const update = (field, value) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (["billing_cycle", "custom_billing_months", "start_date"].includes(field)) {
        next.next_billing_date = calculateNextBillingDate(next, next.start_date);
      }
      return next;
    });
  };

  const updateLine = (index, field, value) => {
    setFormData((prev) => {
      const service_lines = [...(prev.service_lines || [])];
      service_lines[index] = { ...service_lines[index], [field]: value };
      const monthly_amount = service_lines.reduce((sum, line) => sum + (Number(line.quantity || 0) * Number(line.unit_price || 0)), 0);
      return { ...prev, service_lines, monthly_amount };
    });
  };

  const addLine = () => update("service_lines", [...(formData.service_lines || []), { ...emptyLine }]);
  const removeLine = (index) => update("service_lines", formData.service_lines.filter((_, i) => i !== index));

  const handleCustomerSelect = (customerCode) => {
    const customer = customers.find((row) => row.customer_code === customerCode);
    if (!customer) return;
    setFormData((prev) => ({
      ...prev,
      customer_code: customer.customer_code,
      customer_name: customer.customer_name,
      customer_email: customer.email,
      customer_vat_number: customer.vat_number,
      customer_address: customer.address,
      payment_terms: customer.payment_terms || prev.payment_terms,
      preferred_language: customer.preferred_language || prev.preferred_language,
      preferred_delivery_method: customer.preferred_delivery_method || prev.preferred_delivery_method
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const normalized = {
        ...payload,
        organization_id: currentOrg?.id || payload.organization_id,
        tenant_id: currentOrg?.id || payload.tenant_id,
        next_billing_date: payload.next_billing_date || payload.start_date
      };
      if (item?.id) return matrixSales.entities.ServiceContract.update(item.id, normalized);
      return matrixSales.entities.ServiceContract.create(normalized);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["serviceContracts"] });
      toast({ title: "Service contract saved", description: "Recurring billing settings are ready." });
      onClose();
    },
    onError: (error) => {
      toast({ title: "Unable to save contract", description: error.message || "Please try again.", variant: "destructive" });
    }
  });

  const submit = (event) => {
    event.preventDefault();
    if (!formData.customer_name || !formData.start_date || !formData.service_lines?.length) {
      toast({ title: "Missing contract data", description: "Customer, start date, and at least one service line are required.", variant: "destructive" });
      return;
    }
    saveMutation.mutate(formData);
  };

  const customerOptions = customers.map((customer) => ({
    value: customer.customer_code,
    label: `${customer.customer_code} - ${customer.customer_name}`
  }));

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Edit" : "New"} Service Contract</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Contract Number</Label>
              <Input value={formData.contract_number} onChange={(e) => update("contract_number", e.target.value)} placeholder="Auto if blank" />
            </div>
            <SearchableSelect
              label="Customer"
              value={formData.customer_code}
              onValueChange={handleCustomerSelect}
              options={customerOptions}
              placeholder="Select customer"
              searchPlaceholder="Search customers"
            />
            <div>
              <Label>Customer Name *</Label>
              <Input value={formData.customer_name} onChange={(e) => update("customer_name", e.target.value)} required />
            </div>
            <div>
              <Label>VAT Number</Label>
              <Input value={formData.customer_vat_number || ""} onChange={(e) => update("customer_vat_number", e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={formData.customer_email || ""} onChange={(e) => update("customer_email", e.target.value)} />
            </div>
            <div>
              <Label>Service Type</Label>
              <Select value={formData.service_type} onValueChange={(value) => update("service_type", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="managed_services">Managed Services</SelectItem>
                  <SelectItem value="support_contract">Support Contract</SelectItem>
                  <SelectItem value="cloud_services">Cloud Services</SelectItem>
                  <SelectItem value="amc_sla">AMC / SLA</SelectItem>
                  <SelectItem value="consulting">Consulting</SelectItem>
                  <SelectItem value="subscription">Subscription</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <Label>Billing Cycle</Label>
              <Select value={formData.billing_cycle} onValueChange={(value) => update("billing_cycle", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.billing_cycle === "custom" && (
              <div>
                <Label>Custom Months</Label>
                <Input type="number" min="1" value={formData.custom_billing_months} onChange={(e) => update("custom_billing_months", Number(e.target.value) || 1)} />
              </div>
            )}
            <div>
              <Label>Start Date *</Label>
              <Input type="date" value={formData.start_date} onChange={(e) => update("start_date", e.target.value)} required />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={formData.end_date || ""} onChange={(e) => update("end_date", e.target.value)} />
            </div>
            <div>
              <Label>Next Billing Date</Label>
              <Input type="date" value={formData.next_billing_date || ""} onChange={(e) => update("next_billing_date", e.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Recurring Service Lines</h3>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="mr-2 h-4 w-4" />
                Add Service
              </Button>
            </div>
            {(formData.service_lines || []).map((line, index) => (
              <div key={index} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_90px_100px_120px_90px_44px]">
                <Input value={line.service_description} onChange={(e) => updateLine(index, "service_description", e.target.value)} placeholder="Monthly IT Support Services" />
                <Input type="number" value={line.quantity} onChange={(e) => updateLine(index, "quantity", Number(e.target.value) || 0)} placeholder="Qty" />
                <Input value={line.unit} onChange={(e) => updateLine(index, "unit", e.target.value)} placeholder="Unit" />
                <Input type="number" value={line.unit_price} onChange={(e) => updateLine(index, "unit_price", Number(e.target.value) || 0)} placeholder="Unit price" />
                <Input type="number" value={line.vat_rate} onChange={(e) => updateLine(index, "vat_rate", Number(e.target.value) || 0)} placeholder="VAT %" />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(index)} disabled={formData.service_lines.length === 1}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <Label>Amount / Cycle</Label>
              <Input type="number" value={formData.monthly_amount} onChange={(e) => update("monthly_amount", Number(e.target.value) || 0)} />
            </div>
            <div>
              <Label>VAT %</Label>
              <Input type="number" value={formData.vat_rate} onChange={(e) => update("vat_rate", Number(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Payment Terms</Label>
              <Select value={formData.payment_terms} onValueChange={(value) => update("payment_terms", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="net_30">Net 30</SelectItem>
                  <SelectItem value="net_45">Net 45</SelectItem>
                  <SelectItem value="net_60">Net 60</SelectItem>
                  <SelectItem value="advance">Advance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(value) => update("status", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Preferred Language</Label>
              <Select value={formData.preferred_language} onValueChange={(value) => update("preferred_language", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">Arabic</SelectItem>
                  <SelectItem value="bilingual">Bilingual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Delivery Method</Label>
              <Select value={formData.preferred_delivery_method} onValueChange={(value) => update("preferred_delivery_method", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="pdf">PDF Download</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Auto Send</Label>
              <Select value={formData.auto_send_invoice ? "yes" : "no"} onValueChange={(value) => update("auto_send_invoice", value === "yes")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>SLA Details</Label>
            <Textarea value={formData.sla_details || ""} onChange={(e) => update("sla_details", e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={formData.notes || ""} onChange={(e) => update("notes", e.target.value)} rows={2} />
          </div>

          <div className="flex justify-end gap-3 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saveMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
              {saveMutation.isPending ? "Saving..." : "Save Contract"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
