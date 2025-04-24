-- Create NCRs table if it doesn't exist
CREATE TABLE IF NOT EXISTS ncrs (
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