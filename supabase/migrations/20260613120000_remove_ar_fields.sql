-- Phase 2d: Remove Arabic (_ar) JSONB fields from all entity tables.
-- UI inputs for these fields were removed in phases 2a–2c. This migration
-- cleans existing stored data so the _ar keys no longer appear in records.

UPDATE public.organization
  SET record = record
    - 'organization_name_ar'
    - 'trade_name_ar'
    - 'headquarters_address_ar'
    - 'street_name_ar'
    - 'district_ar'
    - 'city_ar'
    - 'ceo_name_ar'
  WHERE record ?| ARRAY[
    'organization_name_ar','trade_name_ar','headquarters_address_ar',
    'street_name_ar','district_ar','city_ar','ceo_name_ar'
  ];

UPDATE public.chart_of_accounts
  SET record = record - 'account_name_ar'
  WHERE record ? 'account_name_ar';

UPDATE public.employee
  SET record = record - 'address_ar'
  WHERE record ? 'address_ar';

UPDATE public.service_order
  SET record = record - 'customer_name_ar' - 'service_description_ar' - 'notes_ar'
  WHERE record ?| ARRAY['customer_name_ar','service_description_ar','notes_ar'];

UPDATE public.sales_return
  SET record = record - 'customer_name_ar' - 'product_name_ar' - 'notes_ar'
  WHERE record ?| ARRAY['customer_name_ar','product_name_ar','notes_ar'];

UPDATE public.role
  SET record = record - 'role_name_ar'
  WHERE record ? 'role_name_ar';

UPDATE public.material_group
  SET record = record - 'group_name_ar'
  WHERE record ? 'group_name_ar';

UPDATE public.material_sub_group
  SET record = record - 'subgroup_name_ar'
  WHERE record ? 'subgroup_name_ar';

UPDATE public.salesman
  SET record = record - 'salesman_name_ar'
  WHERE record ? 'salesman_name_ar';

UPDATE public.plant
  SET record = record - 'plant_name_ar'
  WHERE record ? 'plant_name_ar';

UPDATE public.storage_location
  SET record = record - 'storage_location_name_ar'
  WHERE record ? 'storage_location_name_ar';

UPDATE public.rfq
  SET record = record - 'material_name_ar'
  WHERE record ? 'material_name_ar';

UPDATE public.project_milestone
  SET record = record - 'milestone_name_ar'
  WHERE record ? 'milestone_name_ar';

UPDATE public.approval_request
  SET record = record - 'document_summary_ar'
  WHERE record ? 'document_summary_ar';

-- Note: qc_plan.test_parameter_ar lives inside a nested test_specifications
-- JSON array. That field was write-only dead code from Phase 2b and any
-- existing values are harmless; no bulk SQL update is issued for it.
