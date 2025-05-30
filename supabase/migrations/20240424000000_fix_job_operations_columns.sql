-- Migration to fix job_operations table column names
ALTER TABLE job_operations RENAME COLUMN \
Sales
Document\ TO \Order\;

-- Create a temporary table with correct column names
CREATE TABLE temp_job_operations AS 
SELECT * FROM job_operations;

-- Drop and recreate job_operations table with correct constraints
DROP TABLE job_operations;

CREATE TABLE job_operations (
    \Order\ text NOT NULL,
    \Oper./Act.\ text NOT NULL,
    \Oper.WorkCenter\ text,
    \Description\ text,
    \Opr.
short
text\ text,
    \Work\ numeric,
    \Actual
work\ numeric,
    CONSTRAINT job_operations_pkey PRIMARY KEY (\Order\, \Oper./Act.\)
);
