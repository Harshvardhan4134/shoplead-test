-- Rename Order column to Sales Document in job_operations table
ALTER TABLE public.job_operations 
RENAME COLUMN "Order" TO "Sales Document";

-- Update the index to use the new column name
DROP INDEX IF EXISTS job_operations_order_idx;
CREATE INDEX job_operations_sales_document_idx ON job_operations ("Sales Document");