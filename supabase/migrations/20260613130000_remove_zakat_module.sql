-- Step 5: Remove Saudi Zakat module from the database.
-- The ZakatManagement page and all associated components have been removed
-- from the UI. These tables are Saudi-specific and not applicable to the
-- Sri Lanka deployment.

-- 1. Remove Zakat-related fields from chart_of_accounts records.
--    zakat_category, zakat_subcategory, and is_related_party_account were
--    set by GLZakatMappingForm which is now removed.
UPDATE public.chart_of_accounts
  SET record = record - 'zakat_category' - 'zakat_subcategory' - 'is_related_party_account'
  WHERE record ?| ARRAY['zakat_category','zakat_subcategory','is_related_party_account'];

-- 2. Remove is_saudi_gcc from shareholder records (if any exist before table drop).
UPDATE public.shareholder
  SET record = record - 'is_saudi_gcc'
  WHERE record ? 'is_saudi_gcc';

-- 3. Drop Zakat-specific tables.
DROP TABLE IF EXISTS public.zakat_adjustment;
DROP TABLE IF EXISTS public.zakat_computation;
DROP TABLE IF EXISTS public.zakat_configuration;
DROP TABLE IF EXISTS public.shareholder;

-- 4. Remove entity map entries so the ORM no longer references these tables.
DELETE FROM public.matrix_entity_table_map
  WHERE entity_name IN (
    'ZakatAdjustment',
    'ZakatComputation',
    'ZakatConfiguration',
    'Shareholder'
  );
