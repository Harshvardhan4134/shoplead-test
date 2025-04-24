-- Create a new table for job operations with the column names expected by the frontend
CREATE TABLE job_operations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "Order" TEXT NOT NULL,
  "Oper./Act." TEXT,
  "Oper.WorkCenter" TEXT,
  "Description" TEXT,
  "Opr. short text" TEXT,
  "Work" NUMERIC DEFAULT 0,
  "Actual work" NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on the Order column for faster lookups
CREATE INDEX job_operations_order_idx ON job_operations ("Order");

-- Add a comment to the table
COMMENT ON TABLE job_operations IS 'Table for storing job operations with column names expected by the frontend';