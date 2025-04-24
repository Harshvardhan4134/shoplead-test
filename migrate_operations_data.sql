-- Migrate data from sap_operations to job_operations
INSERT INTO job_operations ("Sales Document", "Oper./Act.", "Oper.WorkCenter", "Description", "Opr. short text", "Work", "Actual work")
SELECT 
  order_number AS "Sales Document",
  operation_number AS "Oper./Act.",
  work_center AS "Oper.WorkCenter",
  description AS "Description",
  short_text AS "Opr. short text",
  planned_work AS "Work",
  actual_work AS "Actual work"
FROM sap_operations;