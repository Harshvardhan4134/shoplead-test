import { 
  mockJobs, 
  mockPurchaseOrders, 
  mockShipmentLogs, 
  mockWorkCenters, 
  mockNCRs,
  mockJobTimelines,
  mockVendorOperations
} from "@/data/mock-data";
import { Job, PurchaseOrder, ShipmentLog, WorkCenter, NCR, JobTimeline, VendorOperation } from "@/shared/schema";

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const api = {
  // Jobs
  getJobs: async (): Promise<Job[]> => {
    await delay(500);
    return mockJobs;
  },

  // Purchase Orders
  getPurchaseOrders: async (): Promise<PurchaseOrder[]> => {
    await delay(500);
    return mockPurchaseOrders;
  },

  // Shipment Logs
  getShipmentLogs: async (): Promise<ShipmentLog[]> => {
    await delay(500);
    return mockShipmentLogs;
  },

  // Work Centers
  getWorkCenters: async (): Promise<WorkCenter[]> => {
    await delay(500);
    return mockWorkCenters;
  },

  // NCRs
  getNCRs: async (): Promise<NCR[]> => {
    await delay(500);
    return mockNCRs;
  },

  // Job Timelines
  getJobTimelines: async (jobId: number): Promise<JobTimeline[]> => {
    await delay(500);
    return mockJobTimelines.filter(timeline => timeline.jobId === jobId);
  },

  // Vendor Operations
  getVendorOperations: async (jobId: number): Promise<VendorOperation[]> => {
    await delay(500);
    return mockVendorOperations.filter(op => op.jobId === jobId);
  },

  // Add Note
  addNote: async (note: { title: string; content: string }) => {
    const response = await fetch('/api/notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: note.title,
        content: note.content,
        createdAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to add note');
    }

    return response.json();
  },

  // Add Reminder
  addReminder: async (jobId: number, reminder: { date: string; description: string }): Promise<void> => {
    await delay(500);
    const job = mockJobs.find(j => j.id === jobId);
    if (job) {
      if (!job.reminders) {
        job.reminders = [];
      }
      job.reminders.push(reminder);
    }
  }
}; 