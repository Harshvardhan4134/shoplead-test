-- Add Sales Document column
ALTER TABLE public.job_operations 
ADD COLUMN "Sales Document" TEXT;

-- Copy data from Order to Sales Document
UPDATE public.job_operations 
SET "Sales Document" = "Order";

-- Make Sales Document NOT NULL
ALTER TABLE public.job_operations 
ALTER COLUMN "Sales Document" SET NOT NULL;

-- Drop old Order column
ALTER TABLE public.job_operations 
DROP COLUMN "Order";

-- Update the index
DROP INDEX IF EXISTS job_operations_order_idx;
CREATE INDEX job_operations_sales_document_idx ON job_operations ("Sales Document");