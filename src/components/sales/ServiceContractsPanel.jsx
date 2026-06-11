import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DataTable from "@/components/erp/DataTable";
import ServiceContractForm from "@/components/sales/ServiceContractForm";
import InvoicePrintPreview from "@/components/printing/InvoicePrintPreview";
import { matrixSales } from "@/api/matrixSalesClient";
import { useToast } from "@/components/ui/use-toast";
import { getTenantLogoAsset, getTenantPrintingPreferences } from "@/components/printing/invoicePrintService";
import {
  buildServiceInvoiceFromContract,
  calculateServiceBusinessKpis,
  generateRecurringInvoices,
  isMissingRecurringBillingRunTableError,
  isServiceInvoice
} from "@/lib/serviceBilling";
import { createNotification } from "@/components/utils/notificationService";
import { CalendarClock, Edit, FilePlus2, Plus, Printer, RefreshCw } from "lucide-react";

export default function ServiceContractsPanel({ invoices = [] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [generatedInvoices, setGeneratedInvoices] = useState([]);
  const [printInvoice, setPrintInvoice] = useState(null);

  const { data: contracts = [] } = useQuery({
    queryKey: ["serviceContracts"],
    queryFn: () => matrixSales.entities.ServiceContract.list("-next_billing_date"),
    initialData: []
  });

  const { data: organizations = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => matrixSales.entities.Organization.list(),
    initialData: []
  });

  const { data: printingPreference } = useQuery({
    queryKey: ["tenantPrintingPreferences"],
    queryFn: getTenantPrintingPreferences
  });

  const { data: logoAsset } = useQuery({
    queryKey: ["tenantLogoAsset"],
    queryFn: getTenantLogoAsset
  });

  const kpis = calculateServiceBusinessKpis(contracts, invoices);
  const recentServiceInvoices = invoices
    .filter(isServiceInvoice)
    .sort((a, b) => String(b.invoice_date || "").localeCompare(String(a.invoice_date || "")))
    .slice(0, 5);
  const printableInvoices = generatedInvoices.length > 0 ? generatedInvoices : recentServiceInvoices;

  const generateMutation = useMutation({
    mutationFn: async () => {
      const generated = await generateRecurringInvoices({
        contracts,
        existingInvoices: invoices,
        createInvoice: (invoice) => matrixSales.entities.Invoice.create(invoice),
        updateContract: (contract, payload) => matrixSales.entities.ServiceContract.update(contract.id, payload),
        createNotification
      });

      try {
        await matrixSales.entities.RecurringBillingRun.create({
          run_date: new Date().toISOString(),
          generated_count: generated.length,
          status: "completed",
          notes: `Generated ${generated.length} recurring invoice(s)`
        });
      } catch (error) {
        if (!isMissingRecurringBillingRunTableError(error)) throw error;
        console.warn("Recurring billing run log skipped because the database migration is not applied yet.", error);
      }

      return generated;
    },
    onSuccess: (generated) => {
      setGeneratedInvoices(generated);
      queryClient.invalidateQueries({ queryKey: ["serviceContracts"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({
        title: generated.length > 0 ? "Recurring billing complete" : "No due invoices",
        description: generated.length > 0
          ? `${generated.length} service invoice(s) generated.`
          : "No active contracts are due for billing today."
      });
    },
    onError: (error) => {
      toast({ title: "Recurring billing failed", description: error.message || "Please try again.", variant: "destructive" });
    }
  });

  const findInvoiceForContract = (contract) =>
    invoices
      .filter((invoice) => invoice.service_contract_id === contract.id && isServiceInvoice(invoice))
      .sort((a, b) => String(b.invoice_date || "").localeCompare(String(a.invoice_date || "")))[0];

  const generateAndPrintMutation = useMutation({
    mutationFn: async (contract) => {
      const existingInvoice = findInvoiceForContract(contract);
      if (existingInvoice) return existingInvoice;

      const invoice = buildServiceInvoiceFromContract(contract, new Date());
      const savedInvoice = await matrixSales.entities.Invoice.create(invoice);
      setGeneratedInvoices((prev) => [savedInvoice, ...prev]);
      return savedInvoice;
    },
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setPrintInvoice(invoice);
    },
    onError: (error) => {
      toast({ title: "Unable to open invoice print", description: error.message || "Please try again.", variant: "destructive" });
    }
  });

  const columns = [
    { header: "Contract #", key: "contract_number" },
    { header: "Customer", key: "customer_name" },
    { header: "Service Type", key: "service_type", isBadge: true },
    { header: "Cycle", key: "billing_cycle" },
    { header: "Amount", key: "monthly_amount", render: (value) => `LKR ${Number(value || 0).toLocaleString()}` },
    { header: "Next Billing", key: "next_billing_date" },
    { header: "End Date", key: "end_date" },
    { header: "Status", key: "status", isBadge: true }
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card><CardContent className="p-4"><p className="text-sm text-slate-500">MRR</p><p className="text-xl font-bold">LKR {kpis.monthlyRecurringRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-slate-500">ARR</p><p className="text-xl font-bold">LKR {kpis.annualRecurringRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-slate-500">Active Contracts</p><p className="text-xl font-bold">{kpis.activeContracts}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-slate-500">Renewals 30d</p><p className="text-xl font-bold">{kpis.upcomingRenewals}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-slate-500">Overdue Invoices</p><p className="text-xl font-bold">{kpis.overdueInvoices}</p></CardContent></Card>
      </div>

      {printableInvoices.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-emerald-950">
                {generatedInvoices.length > 0 ? "Generated invoices ready to print" : "Recent service invoices ready to print"}
              </p>
              <p className="text-sm text-emerald-800">Open the ZATCA print preview, download PDF, email, or share by WhatsApp.</p>
            </div>
            {printableInvoices.length === 1 && (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => setPrintInvoice(printableInvoices[0])}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print Preview
              </Button>
            )}
          </div>
          {printableInvoices.length > 1 && (
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              {printableInvoices.map((invoice) => (
                <div key={invoice.id || invoice.invoice_number} className="flex flex-col gap-3 rounded-md border bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{invoice.invoice_number || "Generated invoice"}</p>
                    <p className="truncate text-xs text-slate-500">{invoice.customer_name} · LKR {Number(invoice.total_amount || 0).toLocaleString()}</p>
                  </div>
                  <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => setPrintInvoice(invoice)}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">Service Contracts & Recurring Billing</h3>
          <p className="text-sm text-slate-500">Managed services, cloud subscriptions, AMC/SLA, consulting, and support retainers.</p>
        </div>
        <div className="grid gap-2 sm:flex sm:justify-end">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${generateMutation.isPending ? "animate-spin" : ""}`} />
            Generate Due Invoices
          </Button>
          <Button className="w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto" onClick={() => { setEditingContract(null); setShowForm(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            New Contract
          </Button>
        </div>
      </div>

      <div className="hidden md:block">
        <DataTable
          data={contracts}
          columns={columns}
          searchFields={["contract_number", "customer_name", "service_type"]}
          onPrint={(contract) => generateAndPrintMutation.mutate(contract)}
          getPrintTitle={(contract) => findInvoiceForContract(contract) ? "Print latest invoice" : "Generate invoice and print"}
          onEdit={(contract) => { setEditingContract(contract); setShowForm(true); }}
        />
      </div>

      <div className="space-y-3 md:hidden">
        {contracts.length === 0 ? (
          <div className="rounded-lg border bg-white p-6 text-center text-sm text-slate-500">
            No service contracts found.
          </div>
        ) : (
          contracts.map((contract) => (
            <div key={contract.id || contract.contract_number} className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{contract.contract_number || "Service contract"}</p>
                  <p className="mt-1 text-sm text-slate-600">{contract.customer_name || "-"}</p>
                </div>
                <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white">
                  {contract.status || "active"}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Service</p>
                  <p className="font-medium">{contract.service_type || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Cycle</p>
                  <p className="font-medium">{contract.billing_cycle || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Amount</p>
                  <p className="font-medium">LKR {Number(contract.monthly_amount || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Next billing</p>
                  <p className="font-medium">{contract.next_billing_date || "-"}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generateAndPrintMutation.mutate(contract)}
                  disabled={generateAndPrintMutation.isPending}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setEditingContract(contract); setShowForm(true); }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg border bg-slate-50 p-4">
          <FilePlus2 className="mb-2 h-5 w-5 text-[#24466f]" />
          <p className="font-semibold">Service-only invoices</p>
          <p className="text-sm text-slate-600">No item stock, warehouse, delivery, or PGI validation is required.</p>
        </div>
        <div className="rounded-lg border bg-slate-50 p-4">
          <CalendarClock className="mb-2 h-5 w-5 text-[#24466f]" />
          <p className="font-semibold">Recurring schedules</p>
          <p className="text-sm text-slate-600">Monthly, quarterly, annual, and custom billing cycles are supported.</p>
        </div>
        <div className="rounded-lg border bg-slate-50 p-4">
          <FilePlus2 className="mb-2 h-5 w-5 text-[#24466f]" />
          <p className="font-semibold">ZATCA ready</p>
          <p className="text-sm text-slate-600">Generated invoices use standard tax invoice defaults and existing QR/PDF templates.</p>
        </div>
      </div>

      {showForm && (
        <ServiceContractForm
          item={editingContract}
          onClose={() => {
            setShowForm(false);
            setEditingContract(null);
          }}
        />
      )}

      {printInvoice && (
        <InvoicePrintPreview
          invoice={printInvoice}
          organization={organizations[0] || {}}
          preferences={printingPreference}
          logoAsset={logoAsset}
          onClose={() => setPrintInvoice(null)}
        />
      )}
    </div>
  );
}
