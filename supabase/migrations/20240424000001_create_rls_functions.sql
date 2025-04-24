-- Function to disable RLS on sap_operations table
CREATE OR REPLACE FUNCTION public.disable_rls_for_sap_operations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  ALTER TABLE public.sap_operations DISABLE ROW LEVEL SECURITY;
END;
$$;

-- Function to enable RLS on sap_operations table
CREATE OR REPLACE FUNCTION public.enable_rls_for_sap_operations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  ALTER TABLE public.sap_operations ENABLE ROW LEVEL SECURITY;
END;
$$;