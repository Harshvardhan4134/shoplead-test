import * as XLSX from "xlsx";
import { Job, PurchaseOrder, ShipmentLog, WorkCenter, NCR, JobTimeline, VendorOperation } from "@/shared/schema";
import { queryClient } from "@/lib/queryClient";
import { db } from '@/lib/db';
import { parseExcelFile } from '@/lib/excel';
import { NextApiRequest, NextApiResponse } from 'next';
import { parse } from 'csv-parse/browser/esm/sync';

interface WorkLogEntry {
  'Plant': string;
  'Order': string;
  'Sales Document': string;
  'Operation': string;
  'Adjustment': string;
  'Confirmation Text': string;
  'Acutal Work': number;
  'EmployeeName': string;
  'Permr': string;
  'NonProdCod': string;
  'Operation Short Text': string;
  'NppDesc': string;
  'PostingDate': string;
}

interface SAPEntry {
  'Sales Document': string;
  'List name': string;
  'Order': string;
  'Oper./Act.': string;
  'Oper.WorkCenter': string;
  'Description': string;
  'Opr. short text': string;
  'Work': number;
  'Actual work': number;
}

interface POEntry {
  'Req.Tracking Number': string;
  'Purchasing Document': string;
  'Item': string;
  'PO history/release documentation': string;
  'Purchasing Group': string;
  'Document Date': string;
  'Vendor/supplying plant': string;
  'Short Text': string;
  'Orde r Qua ntity': string; // Handle space in column name
  'Net price': number;
  'Still to be delivered (qty)': number;
  'Still to be delivered (value)': number;
  'Material': string;
  'Deletion Indicator': string;
}

// Add helper function to convert Excel dates
function convertExcelDate(excelDate: number | string): string {
  if (typeof excelDate === 'number') {
    // Excel dates are number of days since 1900-01-01
    const date = new Date(1900, 0, excelDate - 1);
    return date.toISOString();
  }
  return new Date(excelDate).toISOString();
}

export async function handleImport(file: File) {
  try {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    let records: any[] = [];

    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      // Handle Excel files
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      records = XLSX.utils.sheet_to_json(worksheet);
    } else if (fileExtension === 'csv') {
      // Handle CSV files
      const content = await file.text();
      records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
    } else {
      throw new Error('Unsupported file format. Please upload a CSV or Excel file.');
    }

    // Process the data
    const processedData = {
      jobs: [] as Job[],
      workCenters: [] as WorkCenter[],
      purchaseOrders: [] as PurchaseOrder[],
      shipmentLogs: [] as ShipmentLog[],
      operations: [] as any[]
    };

    // Process each record based on file type
    if (file.name.includes('SAPDATA')) {
      // Process SAP data
      const jobMap = new Map<string, Job>();
      const workCenterMap = new Map<string, WorkCenter>();
      const operations: any[] = [];

      records.forEach((record: any) => {
        try {
          // Process work centers first
          if (record['Oper.WorkCenter']) {
            const workCenterName = record['Oper.WorkCenter'].toString().trim();
            if (workCenterName && !workCenterMap.has(workCenterName)) {
              workCenterMap.set(workCenterName, {
                name: workCenterName,
                type: 'Production',
                status: 'Available',
                utilization: 0
              });
            }
          }

          // Create operation record with both Sales Document and Order
          const operation = {
            "Sales Document": record['Sales Document'] || '',
            "Order": record['Order'] || '',  // Make sure to capture the Order field
            "Oper./Act.": record['Oper./Act.'] || '',
            "Oper.WorkCenter": record['Oper.WorkCenter'] || '',
            "Description": record['Description'] || '',
            "Opr. short text": record['Opr. short text'] || '',
            "Work": Number(record['Work']) || 0,
            "Actual work": Number(record['Actual work']) || 0
          };
          operations.push(operation);

          // Use Sales Document as the job number
          if (record['Sales Document']) {
            const jobNumber = record['Sales Document'].toString();
            const progress = Math.round(Number(record['Actual work']) || 0);

            // Get or create job
            let job = jobMap.get(jobNumber);
            const operationsData = job?.sap_data || [];

            // Add this record to operations array
            operationsData.push(operation);

            // Calculate total progress across all operations
            const totalPlanned = operationsData.reduce((sum, op) => sum + (Number(op['Work']) || 0), 0);
            const totalActual = operationsData.reduce((sum, op) => sum + (Number(op['Actual work']) || 0), 0);
            const totalProgress = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;

            // Create or update job
            jobMap.set(jobNumber, {
              ...(job || {}),
              job_number: jobNumber,
              title: record['Description'] || record['Opr. short text'] || '',
              description: record['Opr. short text'] || record['Description'] || '',
              status: totalProgress === 0 ? 'New' : totalProgress === 100 ? 'Completed' : 'In Progress',
              due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              scheduled_date: new Date().toISOString(),
              priority: totalProgress === 0 ? 'High' : totalProgress < 30 ? 'High' : totalProgress < 70 ? 'Medium' : 'Low',
              progress: totalProgress,
              work_center: record['Oper.WorkCenter'] || '',
              customer: record['List name'] || '',
              sap_data: operationsData,
              notes: job?.notes || [],
              reminders: job?.reminders || [],
              timeline: job?.timeline || [],
              ncr: job?.ncr || [],
              vendor_operations: job?.vendor_operations || []
            });
          }
        } catch (error) {
          console.error('Error processing SAP record:', record, error);
        }
      });

      // Convert maps to arrays
      processedData.workCenters = Array.from(workCenterMap.values());
      processedData.jobs = Array.from(jobMap.values());
      processedData.operations = operations;

      // Insert operations in batches
      const BATCH_SIZE = 100;
      for (let i = 0; i < operations.length; i += BATCH_SIZE) {
        const batch = operations.slice(i, i + BATCH_SIZE);
        await db.upsertJobOperations(batch);
      }

    } else if (file.name.includes('PURCHASEORDERS')) {
      // Process purchase orders
      const purchaseOrders = records.map((record: any) => {
        try {
          // Convert Excel date to ISO string
          const excelDate = record['Document Date'];
          const dateValue = typeof excelDate === 'number'
            ? new Date(Math.round((excelDate - 25569) * 86400 * 1000)).toISOString()
            : new Date().toISOString();

          return {
            purchasing_document: String(record['Purchasing Document'] || ''),
            req_tracking_number: String(record['Req. Tracking Number'] || ''),
            item: String(record['Item'] || ''),
            purchasing_group: String(record['Purchasing Group'] || ''),
            document_date: dateValue,
            vendor: String(record['Vendor/supplying plant'] || ''),
            short_text: String(record['Short Text'] || ''),
            order_quantity: Number(record['Order Quantity']) || 0,
            net_price: Number(record['Net price']) || 0,
            remaining_quantity: Number(record['Still to be delivered (qty)']) || 0,
            remaining_value: Number(record['Still to be delivered (value)']) || 0,
            material: String(record['Material'] || ''),
            status: record['Deletion Indicator'] ? 'Cancelled' :
              Number(record['Still to be delivered (qty)']) > 0 ? 'Open' : 'Completed'
          };
        } catch (error) {
          console.error('Error processing PO record:', record, error);
          return null;
        }
      }).filter(Boolean); // Remove any null entries from errors

      // Add purchase orders to processed data
      processedData.purchaseOrders = purchaseOrders;
    } else if (file.name.includes('WORKLOG')) {
      // Process work logs
      const workLogs = records.map((record: any) => {
        try {
          // Create a unique identifier from available fields
          const uniqueId = `${record['Plant'] || 'NOPLANT'}-${record['Pernr'] || 'NOID'}-${record['__rowNum__'] || Date.now()}`;

          return {
            job_number: uniqueId,
            status: 'Shipped' as const,
            date: record['PostingDate'] || new Date().toISOString(),
            description: `${record['Operation Short Text'] || ''} - ${record['Confirmation Text'] || ''}`,
            vendor: record['EmployeeName'] || '',
            shipment_date: record['PostingDate'] || new Date().toISOString(),
            severity: 'Normal' as const
          };
        } catch (error) {
          console.error('Error processing work log record:', record, error);
          return null;
        }
      }).filter(Boolean);

      // Add work logs to processed data
      processedData.shipmentLogs = workLogs;

      // Create jobs from work logs
      const jobMap = new Map<string, any>();
      workLogs.forEach(log => {
        if (!jobMap.has(log.job_number)) {
          jobMap.set(log.job_number, {
            job_number: log.job_number,
            title: log.description.split(' - ')[0] || 'Work Log Entry',
            description: log.description,
            status: 'In Progress',
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            scheduled_date: log.date,
            priority: 'Medium',
            progress: 50,
            work_center: log.vendor,
            customer: log.vendor,
            notes: [],
            reminders: [],
            timeline: [{
              date: log.date,
              description: log.description,
              status: 'Completed'
            }],
            ncr: [],
            vendor_operations: []
          });
        }
      });

      processedData.jobs = Array.from(jobMap.values());
    }

    // Log the processed data for debugging
    console.log('Processed data:', processedData);

    // Process jobs in smaller batches to avoid the duplicate key error
    const BATCH_SIZE = 100;
    for (let i = 0; i < processedData.jobs.length; i += BATCH_SIZE) {
      const batch = processedData.jobs.slice(i, i + BATCH_SIZE);
      await db.upsertJobs(batch, 'job_number');
    }

    // Update other data
    await Promise.all([
      db.upsertWorkCenters(processedData.workCenters),
      db.upsertPurchaseOrders(processedData.purchaseOrders),
      db.upsertShipmentLogs(processedData.shipmentLogs)
    ]);

    // Update last updated timestamp
    await db.updateLastUpdated('job_operations');

    return processedData;

  } catch (error) {
    console.error('Import error:', error);
    throw error;
  }
}

// Helper function to merge arrays while avoiding duplicates
function mergeArrays<T>(existing: T[], imported: T[], key: keyof T): T[] {
  const merged = [...existing];
  const existingKeys = new Set(existing.map(item => String(item[key])));

  imported.forEach(item => {
    if (!existingKeys.has(String(item[key]))) {
      merged.push(item);
      existingKeys.add(String(item[key]));
    }
  });

  return merged;
}

function handleSAPData(workbook: XLSX.WorkBook, existingData: any) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<SAPEntry>(sheet);
  console.log("Processing SAP data:", data);

  // Process jobs
  const jobs = data.map((row, index) => {
    const existingJob = existingData.jobs.find(j => j.jobNumber === row["Sales Document"]);
    const progress = Number(row["Actual work"]) || 0;

    if (existingJob) {
      return {
        ...existingJob,
        title: row["Operation Short Text"] || row["Opr. short text"] || existingJob.title,
        description: row["Opr. short text"] || existingJob.description,
        progress: progress,
        priority: progress === 0 ? 'High' : progress < 30 ? 'High' : progress < 70 ? 'Medium' : 'Low',
        notes: existingJob.notes || "[]",
        reminders: existingJob.reminders || "[]"
      };
    }
    return {
      id: Number(row["Sales Document"]) || index + 1,
      jobNumber: row["Sales Document"],
      title: row["Operation Short Text"] || row["Opr. short text"] || "",
      description: row["Opr. short text"] || "",
      customer: row["List name"] || "",
      status: "New",
      progress: progress,
      priority: progress === 0 ? 'High' : progress < 30 ? 'High' : progress < 70 ? 'Medium' : 'Low',
      startDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      notes: "[]",
      reminders: "[]"
    };
  });

  // Process work centers
  const workCentersMap = new Map<string, WorkCenter>();
  data.forEach(entry => {
    const wcName = entry['Oper.WorkCenter'];
    if (!wcName) return;

    const existingWorkCenter = existingData.workCenters.find(wc => wc.name === wcName);
    if (existingWorkCenter) {
      workCentersMap.set(wcName, existingWorkCenter);
    } else if (!workCentersMap.has(wcName)) {
      workCentersMap.set(wcName, {
        id: existingData.workCenters.length + workCentersMap.size + 1,
        name: wcName,
        type: 'Production',
        status: 'Available',
        utilization: 0
      });
    }
  });

  return {
    jobs,
    workCenters: Array.from(workCentersMap.values()),
    purchaseOrders: [],
    shipmentLogs: [],
    ncrs: [],
    jobTimelines: [],
    vendorOperations: []
  };
}

function handlePurchaseOrders(workbook: XLSX.WorkBook, existingData: any) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<POEntry>(sheet);
  console.log("Processing purchase orders:", data);

  const purchaseOrders = data.map((row, index) => {
    const existingPO = existingData.purchaseOrders.find(
      po => po.poNumber === row["Purchasing Document"]
    );
    if (existingPO) {
      return {
        ...existingPO,
        amount: Number(row["Net price"]) || existingPO.amount,
        quantity: Number(row["Orde r Qua ntity"]) || existingPO.quantity
      };
    }
    return {
      id: existingData.purchaseOrders.length + index + 1,
      poNumber: row["Purchasing Document"],
      jobId: 0,
      vendor: row["Vendor/supplying plant"] || "",
      amount: Number(row["Net price"]) || 0,
      status: "New",
      issueDate: row["Document Date"] || new Date().toISOString(),
      material: row["Material"] || "",
      quantity: Number(row["Orde r Qua ntity"]) || 0,
      shortText: row["Short Text"] || ""
    };
  });

  return {
    jobs: [],
    workCenters: [],
    purchaseOrders: purchaseOrders.filter(po =>
      !existingData.purchaseOrders.some(existing => existing.poNumber === po.poNumber)
    ),
    shipmentLogs: [],
    ncrs: [],
    jobTimelines: [],
    vendorOperations: []
  };
}

function handleWorkLog(workbook: XLSX.WorkBook, existingData: any) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<WorkLogEntry>(sheet);
  console.log("Processing work logs:", data);

  // Create work logs
  const workLogs = data.map(row => ({
    jobNumber: row["Sales Document"] || row["Order"], // Try Sales Document first, fall back to Order
    operation: row["Operation Short Text"] || row["Operation"] || "",
    actualWork: Number(row["Acutal Work"]) || 0,
    employee: row["EmployeeName"],
    date: row["PostingDate"],
    confirmationText: row["Confirmation Text"] || "",
    plant: row["Plant"]
  }));

  // Calculate job progress
  const jobProgress = new Map<string, number>();
  workLogs.forEach(log => {
    const currentProgress = jobProgress.get(log.jobNumber) || 0;
    jobProgress.set(log.jobNumber, currentProgress + log.actualWork);
  });

  // Update jobs with progress
  const updatedJobs = existingData.jobs.map(job => {
    const progress = jobProgress.get(job.jobNumber);
    if (progress !== undefined) {
      return {
        ...job,
        progress: Math.min(Math.round((progress / 8) * 100), 100)
      };
    }
    return job;
  });

  // Create shipment logs
  const shipmentLogs = workLogs.map((log, index) => ({
    id: existingData.shipmentLogs.length + index + 1,
    jobNumber: log.jobNumber,
    status: 'Completed',
    date: log.date,
    description: `${log.operation} - By: ${log.employee} - ${log.confirmationText}`
  }));

  return {
    jobs: updatedJobs,
    workCenters: [],
    purchaseOrders: [],
    shipmentLogs,
    ncrs: [],
    jobTimelines: [],
    vendorOperations: []
  };
}

// Helper function to safely parse JSON fields
function parseJsonField(field: any) {
  if (!field) return null;
  try {
    return typeof field === 'string' ? JSON.parse(field) : field;
  } catch (error) {
    console.warn('Error parsing JSON field:', error);
    return null;
  }
}