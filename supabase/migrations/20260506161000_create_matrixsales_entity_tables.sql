-- MatrixSales entity tables generated from src/** base44.entities.* usage.
-- Each entity gets a dedicated table with common metadata columns plus a
-- flexible record JSONB payload for the current Base44-shaped records.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.matrix_entity_table_map (
  entity_name text primary key,
  table_name text not null unique,
  created_at timestamptz not null default now()
);

do $$
declare
  entity_tables text[][] := array[
    array['AccountsPayable', 'accounts_payable'],
    array['AccountsReceivable', 'accounts_receivable'],
    array['Activity', 'activity'],
    array['ActualCost', 'actual_cost'],
    array['ApprovalMatrix', 'approval_matrix'],
    array['ApprovalRequest', 'approval_request'],
    array['AssetAllocation', 'asset_allocation'],
    array['AssetDepreciation', 'asset_depreciation'],
    array['AssetDisposal', 'asset_disposal'],
    array['AssetMaintenance', 'asset_maintenance'],
    array['AssetUnderConstruction', 'asset_under_construction'],
    array['AssetVerification', 'asset_verification'],
    array['AssetVerificationTask', 'asset_verification_task'],
    array['AttendanceRecord', 'attendance_record'],
    array['AUCExpenditure', 'auc_expenditure'],
    array['AuditTrail', 'audit_trail'],
    array['BankAccount', 'bank_account'],
    array['BankStatement', 'bank_statement'],
    array['BOM', 'bom'],
    array['BOMItem', 'bom_item'],
    array['Budget', 'budget'],
    array['CAPA', 'capa'],
    array['CashFlowForecast', 'cash_flow_forecast'],
    array['CertificateOfAnalysis', 'certificate_of_analysis'],
    array['ChartOfAccounts', 'chart_of_accounts'],
    array['Coil', 'coil'],
    array['CoilSlitting', 'coil_slitting'],
    array['CoilSplit', 'coil_split'],
    array['Contact', 'contact'],
    array['CostCenter', 'cost_center'],
    array['CostPool', 'cost_pool'],
    array['CostVariance', 'cost_variance'],
    array['Customer', 'customer'],
    array['CycleCount', 'cycle_count'],
    array['Delivery', 'delivery'],
    array['DemandForecast', 'demand_forecast'],
    array['Document', 'document'],
    array['DocumentExpiryTracking', 'document_expiry_tracking'],
    array['DocumentNumberSeries', 'document_number_series'],
    array['Employee', 'employee'],
    array['EndOfService', 'end_of_service'],
    array['EOSSettlement', 'eos_settlement'],
    array['Equipment', 'equipment'],
    array['EquipmentDowntime', 'equipment_downtime'],
    array['FinancialTransaction', 'financial_transaction'],
    array['FixedAsset', 'fixed_asset'],
    array['GoodsReceiptNote', 'goods_receipt_note'],
    array['GOSIContribution', 'gosi_contribution'],
    array['InspectionLot', 'inspection_lot'],
    array['InspectionResult', 'inspection_result'],
    array['IntegrationConfig', 'integration_config'],
    array['IntegrationLog', 'integration_log'],
    array['Invoice', 'invoice'],
    array['JobCost', 'job_cost'],
    array['JournalEntry', 'journal_entry'],
    array['KPI', 'kpi'],
    array['Lead', 'lead'],
    array['LeaveRequest', 'leave_request'],
    array['LoanAdvance', 'loan_advance'],
    array['Location', 'location'],
    array['MaintenanceRecord', 'maintenance_record'],
    array['Material', 'material'],
    array['MaterialGroup', 'material_group'],
    array['MaterialSubGroup', 'material_sub_group'],
    array['MRPPlannedOrder', 'mrp_planned_order'],
    array['NitaqatSnapshot', 'nitaqat_snapshot'],
    array['NonConformance', 'non_conformance'],
    array['Notification', 'notification'],
    array['Opportunity', 'opportunity'],
    array['Organization', 'organization'],
    array['OverheadRate', 'overhead_rate'],
    array['Payment', 'payment'],
    array['PaymentAllocation', 'payment_allocation'],
    array['Payroll', 'payroll'],
    array['Plant', 'plant'],
    array['PMPlan', 'pm_plan'],
    array['POSTransaction', 'pos_transaction'],
    array['Product', 'product'],
    array['ProductCost', 'product_cost'],
    array['ProductionOrder', 'production_order'],
    array['ProductionVariance', 'production_variance'],
    array['Project', 'project'],
    array['ProjectExpense', 'project_expense'],
    array['ProjectInvoice', 'project_invoice'],
    array['ProjectMilestone', 'project_milestone'],
    array['ProjectTask', 'project_task'],
    array['PurchaseOrder', 'purchase_order'],
    array['PurchaseRequisition', 'purchase_requisition'],
    array['QCPlan', 'qc_plan'],
    array['Quotation', 'quotation'],
    array['QuotationLine', 'quotation_line'],
    array['ReportHistory', 'report_history'],
    array['ResourceAllocation', 'resource_allocation'],
    array['RFQ', 'rfq'],
    array['Role', 'role'],
    array['Routing', 'routing'],
    array['Salesman', 'salesman'],
    array['SalesOrder', 'sales_order'],
    array['SalesOrderLine', 'sales_order_line'],
    array['SalesReturn', 'sales_return'],
    array['ServiceOrder', 'service_order'],
    array['Shareholder', 'shareholder'],
    array['SparePart', 'spare_part'],
    array['SparePartConsumption', 'spare_part_consumption'],
    array['StandardCost', 'standard_cost'],
    array['StockLevel', 'stock_level'],
    array['StockMovement', 'stock_movement'],
    array['StockTransferOrder', 'stock_transfer_order'],
    array['StorageLocation', 'storage_location'],
    array['TestSpecification', 'test_specification'],
    array['Timesheet', 'timesheet'],
    array['UnitConversion', 'unit_conversion'],
    array['User', 'user'],
    array['VATReturn', 'vat_return'],
    array['Vendor', 'vendor'],
    array['VendorInvoice', 'vendor_invoice'],
    array['WarehouseBin', 'warehouse_bin'],
    array['WorkCenter', 'work_center'],
    array['WorkOrder', 'work_order'],
    array['ZakatAdjustment', 'zakat_adjustment'],
    array['ZakatComputation', 'zakat_computation'],
    array['ZakatConfiguration', 'zakat_configuration'],
    array['ZATCAConfiguration', 'zatca_configuration'],
    array['ZATCASubmissionLog', 'zatca_submission_log']
  ];
  item text[];
  policy_exists boolean;
begin
  foreach item slice 1 in array entity_tables loop
    execute format(
      'create table if not exists public.%I (
        id uuid primary key default gen_random_uuid(),
        base44_id text unique,
        organization_id uuid,
        organization_key text,
        record jsonb not null default ''{}''::jsonb,
        status text generated always as (record ->> ''status'') stored,
        created_by uuid,
        updated_by uuid,
        source text not null default ''matrixsales'',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )',
      item[2]
    );

    execute format('create index if not exists %I on public.%I using gin (record)', item[2] || '_record_gin_idx', item[2]);
    execute format('create index if not exists %I on public.%I (organization_id)', item[2] || '_organization_id_idx', item[2]);
    execute format('create index if not exists %I on public.%I (organization_key)', item[2] || '_organization_key_idx', item[2]);
    execute format('create index if not exists %I on public.%I (status)', item[2] || '_status_idx', item[2]);
    execute format('create index if not exists %I on public.%I (created_at desc)', item[2] || '_created_at_idx', item[2]);

    execute format('alter table public.%I enable row level security', item[2]);

    select exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = item[2]
        and policyname = 'authenticated_read_write'
    )
    into policy_exists;

    if not policy_exists then
      execute format(
        'create policy authenticated_read_write on public.%I
          for all
          to authenticated
          using (true)
          with check (true)',
        item[2]
      );
    end if;

    execute format('drop trigger if exists set_%I_updated_at on public.%I', item[2], item[2]);
    execute format(
      'create trigger set_%I_updated_at
        before update on public.%I
        for each row execute function public.set_updated_at()',
      item[2],
      item[2]
    );

    insert into public.matrix_entity_table_map (entity_name, table_name)
    values (item[1], item[2])
    on conflict (entity_name) do update
      set table_name = excluded.table_name;
  end loop;
end;
$$;
