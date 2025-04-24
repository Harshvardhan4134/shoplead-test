-- Add work_order column to sap_operations table
ALTER TABLE sap_operations ADD COLUMN IF NOT EXISTS work_order TEXT;