-- Add MatrixSales/Base44-compatible IDs to invoice printing metadata tables.

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'tenant_printing_preferences',
    'tenant_invoice_templates',
    'tenant_logo_assets',
    'generated_invoice_pdfs',
    'invoice_share_links',
    'invoice_share_logs'
  ] loop
    execute format('alter table if exists public.%I add column if not exists base44_id text', target_table);
    execute format(
      'create unique index if not exists %I on public.%I (base44_id) where base44_id is not null',
      target_table || '_base44_id_uidx',
      target_table
    );
  end loop;
end;
$$;
