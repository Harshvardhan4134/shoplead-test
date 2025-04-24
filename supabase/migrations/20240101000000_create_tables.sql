-- Create jobs table
CREATE TABLE IF NOT EXISTS public.jobs (
    id SERIAL PRIMARY KEY,
    job_number TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL CHECK (status IN ('New', 'In Progress', 'Completed', 'On Hold', 'Delayed')),
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_date TIMESTAMP WITH TIME ZONE,
    priority TEXT CHECK (priority IN ('High', 'Medium', 'Low')),
    progress INTEGER NOT NULL DEFAULT 0,
    work_center TEXT,
    customer TEXT,
    notes JSONB DEFAULT '[]',
    reminders JSONB DEFAULT '[]',
    timeline JSONB DEFAULT '[]',
    ncr JSONB DEFAULT '[]',
    vendor_operations JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create work centers table
CREATE TABLE IF NOT EXISTS public.workcenters (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    utilization INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create purchase orders table
CREATE TABLE IF NOT EXISTS public.purchaseorders (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES public.jobs(id),
    vendor TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL,
    issue_date TIMESTAMP WITH TIME ZONE NOT NULL,
    po_number TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create shipment logs table
CREATE TABLE IF NOT EXISTS public.shipmentlogs (
    id SERIAL PRIMARY KEY,
    job_number TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Pending', 'Shipped', 'Delivered')),
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    description TEXT NOT NULL,
    vendor TEXT,
    shipment_date TIMESTAMP WITH TIME ZONE,
    severity TEXT CHECK (severity IN ('Normal', 'High', 'Critical')),
    tracking_number TEXT,
    carrier TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create NCRs table
DROP TABLE IF EXISTS public.ncrs CASCADE;
DROP SEQUENCE IF EXISTS public.ncrs_id_seq;

-- Create sequence
CREATE SEQUENCE public.ncrs_id_seq START WITH 1;

-- Create table using the sequence
CREATE TABLE public.ncrs (
    id INTEGER PRIMARY KEY DEFAULT nextval('public.ncrs_id_seq'),
    ncr_number TEXT,
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
    financial_impact DECIMAL(10,2) DEFAULT 0,
    planned_hours DECIMAL(10,2) DEFAULT 0,
    actual_hours DECIMAL(10,2) DEFAULT 0,
    status TEXT DEFAULT 'Submitted',
    pdf_report_url TEXT,
    drawing_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_ncrs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ncrs_timestamp
    BEFORE UPDATE ON public.ncrs
    FOR EACH ROW
    EXECUTE FUNCTION update_ncrs_updated_at();

-- Create metadata table for tracking last updates
CREATE TABLE IF NOT EXISTS public.metadata (
    id SERIAL PRIMARY KEY,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial metadata record
INSERT INTO public.metadata (last_updated) VALUES (CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating timestamps
CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workcenters_updated_at
    BEFORE UPDATE ON public.workcenters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchaseorders_updated_at
    BEFORE UPDATE ON public.purchaseorders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for shipmentlogs updated_at
CREATE TRIGGER update_shipmentlogs_updated_at
    BEFORE UPDATE ON public.shipmentlogs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert initial sample NCR data
INSERT INTO public.ncrs (job_number, work_order, operation_number, part_name, customer_name, equipment_type, issue_category, status)
VALUES 
    ('100539161', '4977794', '10', 'Pump Shaft', 'COLORADO SPRINGS UTILITIES', 'Lathe', 'MATERIAL', 'Submitted'),
    ('100539161', '4977794', '20', 'Valve Assembly', 'COLORADO SPRINGS UTILITIES', 'Mill', 'PROCESS', 'Submitted')
ON CONFLICT DO NOTHING;