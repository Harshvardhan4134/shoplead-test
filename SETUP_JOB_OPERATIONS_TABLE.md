# Setting Up the Job Operations Table in Supabase

Follow these steps to create the new `job_operations` table in Supabase and migrate data from the existing `sap_operations` table.

## Step 1: Create the New Table

1. Log in to your Supabase dashboard
2. Go to the SQL Editor
3. Create a new query and paste the contents of the `create_job_operations_table.sql` file:

```sql
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
```

4. Run the query to create the table

## Step 2: Migrate Data from the Existing Table

1. In the SQL Editor, create a new query and paste the contents of the `migrate_operations_data.sql` file:

```sql
-- Migrate data from sap_operations to job_operations
INSERT INTO job_operations ("Order", "Oper./Act.", "Oper.WorkCenter", "Description", "Opr. short text", "Work", "Actual work")
SELECT 
  order_number AS "Order",
  operation_number AS "Oper./Act.",
  work_center AS "Oper.WorkCenter",
  description AS "Description",
  short_text AS "Opr. short text",
  planned_work AS "Work",
  actual_work AS "Actual work"
FROM sap_operations;
```

2. Run the query to migrate the data

## Step 3: Verify the Data

1. Go to the Table Editor
2. Select the `job_operations` table
3. Verify that the data has been migrated correctly

## Step 4: Set Up Row-Level Security (Optional)

If you have row-level security set up for the `sap_operations` table, you may want to set up similar policies for the `job_operations` table.

## Step 5: Update Your Application

The application code has already been updated to use the new `job_operations` table. After setting up the table in Supabase, your application should work correctly.

## Troubleshooting

If you encounter any issues:

1. Check the browser console for error messages
2. Verify that the table and column names match exactly as specified
3. Make sure the data has been migrated correctly
4. Check that the application is connecting to the correct Supabase project