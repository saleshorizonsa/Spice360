import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  DEFAULT_PRINTING_PREFERENCES,
  PRINT_FIELD_LABELS,
  mergePrintingPreferences,
  validateZatcaPrintPreferences
} from "@/components/printing/invoicePrintUtils";
import {
  getTenantLogoAsset,
  getTenantPrintingPreferences,
  saveTenantLogoAsset,
  saveTenantPrintingPreferences
} from "@/components/printing/invoicePrintService";

export default function PrintingPreferences() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: existingPreference } = useQuery({
    queryKey: ["tenantPrintingPreferences"],
    queryFn: getTenantPrintingPreferences
  });
  const { data: logoAsset } = useQuery({
    queryKey: ["tenantLogoAsset"],
    queryFn: getTenantLogoAsset
  });
  const [draft, setDraft] = useState(DEFAULT_PRINTING_PREFERENCES);

  React.useEffect(() => {
    setDraft(mergePrintingPreferences(existingPreference || DEFAULT_PRINTING_PREFERENCES));
  }, [existingPreference]);

  const saveMutation = useMutation({
    mutationFn: () => saveTenantPrintingPreferences(existingPreference, draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenantPrintingPreferences"] });
      toast({ title: "Printing preferences saved" });
    },
    onError: (error) => toast({ title: "Save failed", description: error.message, variant: "destructive" })
  });

  const logoMutation = useMutation({
    mutationFn: saveTenantLogoAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenantLogoAsset"] });
      toast({ title: "Logo uploaded" });
    },
    onError: (error) => toast({ title: "Logo upload failed", description: error.message, variant: "destructive" })
  });

  const validation = validateZatcaPrintPreferences(draft, { tax_percent: 15 });

  const setField = (key, value) => setDraft((current) => ({
    ...current,
    fields: {
      ...current.fields,
      [key]: value
    }
  }));

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader>
          <CardTitle>Printing Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Default template style</Label>
              <Select value={draft.default_template_style} onValueChange={(value) => setDraft({ ...draft, default_template_style: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="zatca_standard">ZATCA Standard</SelectItem>
                  <SelectItem value="compact">Compact</SelectItem>
                  <SelectItem value="executive">Executive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Default language</Label>
              <Select value={draft.default_language} onValueChange={(value) => setDraft({ ...draft, default_language: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">Arabic</SelectItem>
                  <SelectItem value="bilingual">Bilingual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Paper size</Label>
              <Select value={draft.paper_size} onValueChange={(value) => setDraft({ ...draft, paper_size: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="a4">A4</SelectItem>
                  <SelectItem value="thermal">Thermal receipt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Orientation</Label>
              <Select value={draft.orientation} onValueChange={(value) => setDraft({ ...draft, orientation: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Font size</Label>
              <Select value={draft.font_size} onValueChange={(value) => setDraft({ ...draft, font_size: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {PRINT_FIELD_LABELS.map(([key, label]) => (
              <div key={key} className="flex items-center justify-between rounded border border-slate-200 p-3">
                <Label htmlFor={key}>{label}</Label>
                <Switch id={key} checked={draft.fields[key] !== false} onCheckedChange={(value) => setField(key, value)} />
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between rounded border border-slate-200 p-3">
              <Label>Header visibility</Label>
              <Switch checked={draft.show_header} onCheckedChange={(show_header) => setDraft({ ...draft, show_header })} />
            </div>
            <div className="flex items-center justify-between rounded border border-slate-200 p-3">
              <Label>Footer visibility</Label>
              <Switch checked={draft.show_footer} onCheckedChange={(show_footer) => setDraft({ ...draft, show_footer })} />
            </div>
          </div>

          <div>
            <Label>Footer text</Label>
            <Input value={draft.footer_text || ""} onChange={(event) => setDraft({ ...draft, footer_text: event.target.value })} />
          </div>
          <div>
            <Label>Terms and conditions text</Label>
            <Textarea rows={4} value={draft.terms_and_conditions || ""} onChange={(event) => setDraft({ ...draft, terms_and_conditions: event.target.value })} />
          </div>
          <div>
            <Label>Bank details</Label>
            <Textarea rows={3} value={draft.bank_details || ""} onChange={(event) => setDraft({ ...draft, bank_details: event.target.value })} />
          </div>

          {!validation.valid && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {validation.errors.map((error) => <p key={error}>{error}</p>)}
            </div>
          )}

          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !validation.valid} className="bg-emerald-600 hover:bg-emerald-700">
            Save Preferences
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company Logo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {logoAsset?.data_url ? (
            <img src={logoAsset.data_url} alt="Company logo" className="max-h-32 rounded border border-slate-200 object-contain p-3" />
          ) : (
            <div className="rounded border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No logo uploaded</div>
          )}
          <Input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) logoMutation.mutate(file);
            }}
          />
          <p className="text-xs text-slate-500">PNG, JPEG, WEBP, or SVG. Maximum size 1 MB. Logos are saved per tenant through tenant-scoped records.</p>
        </CardContent>
      </Card>
    </div>
  );
}

