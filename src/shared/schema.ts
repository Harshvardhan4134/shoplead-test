export interface SAPOperation {
  id: number;
  order_number: string;
  operation_number: string;
  work_center: string;
  description: string;
  short_text: string;
  planned_work: number;
  actual_work: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: number | string | string;
  job_number: string;
  title: string;
  description: string;
  status: "New" | "In Progress" | "Delayed" | "Completed" | "On Hold";
  due_date: string;
  scheduled_date: string;
  priority: "High" | "Medium" | "Low";
  progress: number;
  work_center: string;
  customer: string;
  created_at: string;
  updated_at: string;
  reference_name?: string;
  sap_data?: any[]; // Using any[] to accommodate different formats
  vendor_operations?: any[];
  notes?: any[];
  reminders?: any[];
  timeline?: any[];
  ncr?: any[];
}

export interface Note {
  title: string;
  content: string;
  createdAt: string;
}

export interface Reminder {
  date: string;
  description: string;
}

export interface PurchaseOrder {
  id?: number;
  purchasing_document: string;
  req_tracking_number: string;
  item: string;
  purchasing_group: string;
  document_date: string;
  vendor: string;
  short_text: string;
  order_quantity: number;
  net_price: number;
  remaining_quantity: number;
  remaining_value: number;
  material: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface ShipmentLog {
  id?: number;
  job_number: string;
  status: 'Pending' | 'Shipped' | 'Delivered';
  date: string;
  description: string;
  vendor: string;
  shipment_date: string;
  severity: 'Normal' | 'High' | 'Critical';
}

export interface WorkCenter {
  id?: number;
  name: string;
  type: string;
  status: 'Available' | 'In Use' | 'Maintenance';
  utilization: number;
}

export interface NCR {
  id: number;
  jobNumber: string;
  title: string;
  status: string;
  severity: string;
  description: string;
  createdDate: string;
  resolvedDate?: string;
}

export interface JobTimeline {
  id: number;
  jobId: number;
  date: string;
  status: string;
  description: string;
  vendor?: string;
}

export interface VendorOperation {
  id: number;
  jobId: number;
  operation: string;
  vendor: string;
  dateRange: string;
  status: string;
  notes?: string;
}