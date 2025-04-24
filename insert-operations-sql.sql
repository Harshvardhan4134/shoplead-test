-- Temporarily disable RLS on sap_operations table
ALTER TABLE public.sap_operations DISABLE ROW LEVEL SECURITY;

-- Insert operations data
INSERT INTO public.sap_operations 
(order_number, operation_number, work_center, description, short_text, planned_work, actual_work)
VALUES
('100575126', '0010', 'DNI', 'Dismantle pump and inspect', 'Dismantling & Inspection', 8.0, 4.0),
('100575126', '0020', 'SR', 'Send pump shaft to vendor', 'Vendor - Shaft Repair', 24.0, 0.0),
('100575126', '0030', 'NDE PMI', 'Non-destructive testing', 'NDE Testing', 4.0, 0.0),
('100575126', '0040', 'SR', 'Send impeller to vendor', 'Vendor - Impeller Balance', 16.0, 0.0),
('100575126', '0050', 'ASM', 'Reassemble pump with repaired parts', 'Reassembly', 12.0, 0.0);

-- Re-enable RLS on sap_operations table
ALTER TABLE public.sap_operations ENABLE ROW LEVEL SECURITY;