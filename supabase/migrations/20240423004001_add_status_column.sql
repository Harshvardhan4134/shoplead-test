-- Add status column to sap_operations table
ALTER TABLE public.sap_operations
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('Pending', 'Not Started', 'In Progress', 'Completed'));

-- Update existing rows to have a default status
UPDATE public.sap_operations
SET status = 'Not Started'
WHERE status IS NULL;