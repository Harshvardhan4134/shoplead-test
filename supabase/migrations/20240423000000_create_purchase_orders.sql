-- Create purchase orders table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES public.jobs(id),
    vendor TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    issue_date TIMESTAMP WITH TIME ZONE NOT NULL,
    po_number TEXT UNIQUE NOT NULL,
    expected_date TIMESTAMP WITH TIME ZONE,
    received_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    description TEXT,
    severity TEXT CHECK (severity IN ('Normal', 'High', 'Critical')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create updated_at trigger
CREATE TRIGGER update_purchase_orders_updated_at
    BEFORE UPDATE ON public.purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add some initial test data
INSERT INTO public.purchase_orders (job_id, vendor, amount, status, issue_date, po_number)
VALUES 
    (NULL, 'Test Vendor 1', 1000.00, 'Pending', CURRENT_TIMESTAMP, 'PO-001'),
    (NULL, 'Test Vendor 2', 2500.00, 'Pending', CURRENT_TIMESTAMP, 'PO-002')
ON CONFLICT (po_number) DO NOTHING;