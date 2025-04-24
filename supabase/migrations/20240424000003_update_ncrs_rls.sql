-- Drop existing policies if any
DROP POLICY IF EXISTS ncrs_policy ON ncrs;

-- Enable RLS on the table
ALTER TABLE ncrs ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations for authenticated users
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

-- Grant all privileges on the table to authenticated users
GRANT ALL ON ncrs TO authenticated;
GRANT ALL ON ncrs TO postgres;
GRANT ALL ON ncrs TO service_role;
GRANT USAGE ON SEQUENCE ncrs_id_seq TO authenticated;