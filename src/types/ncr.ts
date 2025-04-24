export interface NCR {
  id: number;
  ncr_number?: string;
  job_number: string;
  work_order: string;
  operation_number: string;
  part_name: string;
  customer_name: string;
  equipment_type?: string;
  drawing_number?: string;
  issue_category?: string;
  issue_description?: string;
  root_cause?: string;
  corrective_action?: string;
  financial_impact?: number;
  planned_hours?: number;
  actual_hours?: number;
  status?: string;
  pdf_report_url?: string;
  drawing_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface NCRFormData {
  ncr_number: string;
  issue_category: string;
  financial_impact: number;
  issue_description: string;
  root_cause: string;
  corrective_action: string;
  equipment_type: string;
  drawing_number: string;
}

export const NCR_STATUS = {
  SUBMITTED: "Submitted",
  IN_PROGRESS: "In Progress",
  UNDER_REVIEW: "Under Review",
  CORRECTIVE_ACTION: "Corrective Action",
  COMPLETED: "Completed",
  CLOSED: "Closed"
} as const;

export const NCR_CATEGORIES = {
  MATERIAL: "Material Defect",
  DIMENSIONAL: "Dimensional Issue",
  PROCESS: "Process Issue",
  EQUIPMENT: "Equipment Failure",
  OPERATOR: "Operator Error"
} as const;
