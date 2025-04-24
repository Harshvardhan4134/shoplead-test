-- Create the stored procedure for applying NCR policies
CREATE OR REPLACE FUNCTION apply_ncr_policies()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Drop existing policies
    DROP POLICY IF EXISTS ncrs_policy ON ncrs;
    DROP POLICY IF EXISTS ncrs_select_policy ON ncrs;
    DROP POLICY IF EXISTS ncrs_insert_policy ON ncrs;
    DROP POLICY IF EXISTS ncrs_update_policy ON ncrs;
    DROP POLICY IF EXISTS ncrs_delete_policy ON ncrs;

    -- Enable RLS
    ALTER TABLE ncrs ENABLE ROW LEVEL SECURITY;

    -- Create new policies
    CREATE POLICY ncrs_select_policy ON ncrs
        FOR SELECT
        TO authenticated
        USING (true);

    CREATE POLICY ncrs_insert_policy ON ncrs
        FOR INSERT
        TO authenticated
        WITH CHECK (true);

    CREATE POLICY ncrs_update_policy ON ncrs
        FOR UPDATE
        TO authenticated
        USING (true)
        WITH CHECK (true);

    CREATE POLICY ncrs_delete_policy ON ncrs
        FOR DELETE
        TO authenticated
        USING (true);

    -- Grant privileges
    GRANT ALL ON ncrs TO authenticated;
    GRANT ALL ON ncrs TO postgres;
    GRANT ALL ON ncrs TO service_role;
    GRANT USAGE ON SEQUENCE ncrs_id_seq TO authenticated;
END;
$$;