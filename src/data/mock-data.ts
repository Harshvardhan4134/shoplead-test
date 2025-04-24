import { Job, PurchaseOrder, ShipmentLog, WorkCenter, NCR, JobTimeline, VendorOperation } from "@/shared/schema";

// Mock Jobs
export const mockJobs: Job[] = [
  {
    id: 1,
    job_number: "JOB-2023-001",
    title: "Custom Machined Parts",
    description: "Custom machined parts for Acme Corp",
    customer: "Acme Corp",
    status: "In Progress",
    progress: 65,
    due_date: "2023-08-15",
    scheduled_date: "2023-07-01",
    priority: "Medium",
    work_center: "CNC-1",
    notes: [
      "Material delivery delayed by 2 days",
      "Customer requested additional quality checks",
      "Machine maintenance scheduled for next week"
    ],
    reminders: [
      {
        date: "2023-08-10T09:00:00",
        description: "Final quality inspection due"
      },
      {
        date: "2023-08-12T14:00:00",
        description: "Customer review meeting"
      }
    ],
    timeline: [],
    ncr: [],
    vendor_operations: []
  },
  {
    id: 2,
    job_number: "JOB-2023-002",
    title: "Assembly Components",
    description: "Assembly components for TechSystems Inc",
    customer: "TechSystems Inc",
    status: "In Progress",
    progress: 30,
    due_date: "2023-08-20",
    scheduled_date: "2023-07-10",
    priority: "High",
    work_center: "Assembly-1",
    notes: [
      "Additional parts ordered",
      "Assembly instructions updated"
    ],
    reminders: [
      {
        date: "2023-08-15T10:00:00",
        description: "Assembly line setup"
      }
    ],
    timeline: [],
    ncr: [],
    vendor_operations: []
  }
];

// Mock Purchase Orders
export const mockPurchaseOrders: PurchaseOrder[] = [
  {
    id: 1,
    job_id: 1,
    po_number: "PO-2023-001",
    vendor: "Supplier A",
    amount: 5000,
    status: "Pending",
    issue_date: "2023-07-01"
  },
  {
    id: 2,
    job_id: 2,
    po_number: "PO-2023-002",
    vendor: "Supplier B",
    amount: 7500,
    status: "Approved",
    issue_date: "2023-07-05"
  }
];

// Mock Shipment Logs
export const mockShipmentLogs: ShipmentLog[] = [
  {
    id: 1,
    job_number: "JOB-2023-001",
    status: "Pending",
    date: "2023-07-15",
    description: "Initial shipment",
    vendor: "Supplier A",
    shipment_date: "2023-07-15",
    severity: "Normal"
  },
  {
    id: 2,
    job_number: "JOB-2023-002",
    status: "Shipped",
    date: "2023-07-20",
    description: "Partial shipment",
    vendor: "Supplier B",
    shipment_date: "2023-07-20",
    severity: "High"
  }
];

// Mock Work Centers
export const mockWorkCenters: WorkCenter[] = [
  {
    id: 1,
    name: "CNC-1",
    type: "CNC Machine",
    status: "In Use",
    utilization: 85
  },
  {
    id: 2,
    name: "Assembly-1",
    type: "Assembly Line",
    status: "Available",
    utilization: 60
  },
  {
    id: 3,
    name: "Finishing-1",
    type: "Finishing Station",
    status: "Maintenance",
    utilization: 0
  }
];

// Mock NCRs
export const mockNCRs: NCR[] = [
  {
    id: 1,
    jobNumber: "JOB-2023-001",
    title: "Dimensional Out of Spec",
    status: "Open",
    severity: "High",
    description: "Part dimensions do not meet specifications",
    createdDate: "2023-07-10",
    resolvedDate: undefined
  },
  {
    id: 2,
    jobNumber: "JOB-2023-002",
    title: "Surface Finish Issue",
    status: "In Review",
    severity: "Medium",
    description: "Surface finish does not meet requirements",
    createdDate: "2023-07-15",
    resolvedDate: undefined
  }
];

// Mock Job Timelines
export const mockJobTimelines: JobTimeline[] = [
  {
    id: 1,
    jobId: 1,
    date: "2023-07-01",
    status: "Started",
    description: "Job initiated",
    vendor: undefined
  },
  {
    id: 2,
    jobId: 1,
    date: "2023-07-05",
    status: "Materials Ordered",
    description: "Purchase order placed for raw materials",
    vendor: "Steel Suppliers Inc"
  }
];

// Mock Vendor Operations
export const mockVendorOperations: VendorOperation[] = [
  {
    id: 1,
    jobId: 1,
    operation: "Heat Treatment",
    vendor: "HeatPro Inc",
    dateRange: "2023-07-25 to 2023-07-27",
    status: "Scheduled",
    notes: "Parts require hardening"
  },
  {
    id: 2,
    jobId: 2,
    operation: "Surface Coating",
    vendor: "CoatTech LLC",
    dateRange: "2023-07-28 to 2023-07-29",
    status: "Pending",
    notes: "Black oxide coating required"
  }
]; 