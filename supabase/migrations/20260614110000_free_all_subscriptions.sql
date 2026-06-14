-- Remove paywall: set all subscriptions to active with unlimited limits.
-- Run this in Supabase SQL Editor to fix any existing trialing/expired rows.

UPDATE public.subscription
SET record = record
  || jsonb_build_object(
       'status',            'active',
       'plan',              'enterprise',
       'plan_name',         'Enterprise',
       'billing_cycle',     'custom',
       'monthly_price',     0,
       'support_level',     'Full access',
       'limits',            '{"users":999999,"invoices_per_month":999999,"tenants":999999}'::jsonb,
       'included_modules',  '["sales","finance","inventory","purchasing","operations","hr","projects","compliance","reports","approvals","admin"]'::jsonb
     )
  - 'trial_end_date'
  - 'renewal_date'
WHERE (record ->> 'status') IN ('trialing', 'expired', 'cancelled', 'past_due', 'suspended');
