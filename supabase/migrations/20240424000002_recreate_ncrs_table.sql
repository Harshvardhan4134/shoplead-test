-- Drop the existing table if it exists
DROP TABLE IF EXISTS ncrs;

-- Create the NCRs table with all required columns
CREATE TABLE ncrs (
    id BIGSERIAL PRIMARY KEY,
    ncr_number TEXT UNIQUE,
    job_number TEXT NOT NULL,
    work_order TEXT NOT NULL,
    operation_number TEXT NOT NULL,
    part_name TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    equipment_type TEXT,
    drawing_number TEXT,
    issue_category TEXT,
    issue_description TEXT,
    root_cause TEXT,
    corrective_action TEXT,
    financial_impact DECIMAL,
    planned_hours DECIMAL,
    actual_hours DECIMAL,
    status TEXT,
    pdf_report_url TEXT,
    drawing_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add any necessary indexes
CREATE INDEX IF NOT EXISTS idx_ncrs_job_number ON ncrs(job_number);
CREATE INDEX IF NOT EXISTS idx_ncrs_customer_name ON ncrs(customer_name);

-- Grant necessary permissions
ALTER TABLE ncrs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON ncrs TO postgres, service_role;

-- Create a policy to allow all operations for authenticated users
CREATE POLICY ncrs_policy ON ncrs
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);