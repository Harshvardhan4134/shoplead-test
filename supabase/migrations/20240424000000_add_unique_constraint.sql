-- Add unique constraint for job_operations table
ALTER TABLE job_operations
ADD CONSTRAINT job_operations_unique_operation UNIQUE ("Sales Document", "Oper./Act.");