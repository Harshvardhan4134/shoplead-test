-- Fix sap_operations table schema
ALTER TABLE IF EXISTS public.sap_operations
DROP COLUMN IF EXISTS "Oper./Act.",
ADD COLUMN IF NOT EXISTS operation_number text;
