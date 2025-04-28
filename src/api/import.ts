import * as XLSX from "xlsx";
import { db } from '@/lib/db';
import { serviceRoleClient } from '@/lib/supabaseClient';
import { parseExcelFile } from '@/lib/excel';
import { NextApiRequest, NextApiResponse } from 'next';
import { parse } from 'csv-parse/browser/esm/sync';
import { queryClient } from "@/lib/queryClient";

// Define types that match db.ts structure
interface Job {
  id?: number;
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
  reference_name?: string;
  sap_data?: any[];
  vendor_operations?: any[];
  notes?: any[];
  reminders?: any[];
  timeline?: any[];
  ncr?: any[];
}

interface WorkCenter {
  id?: number;
  name: string;
  type: string;
  status: string;
  utilization: number;
}

interface PurchaseOrder {
  id?: number;
  po_number: string;
  job_id: number | null;
  vendor: string;
  amount: number;
  status: string;
  issue_date: string;
  expected_date: string | null;
  received_date: string | null;
  notes: string | null;
  description: string | null;
  severity: string | null;
}

interface ShipmentLog {
  id?: number;
  po_number: string | null;
  vendor: string;
  shipment_date: string;
  received_date: string | null;
  status: string;
  tracking_number: string | null;
  carrier: string | null;
}

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
      operations: [] as any[],
      products: [] as any[],
      customers: [] as any[],
      orders: [] as any[],
      forecasts: [] as any[]
    };

    // Process each record based on file type
    if (file.name.includes('SAPDATA')) {
      // Process SAP data
      const jobMap = new Map<string, Job>();
      const workCenterMap = new Map<string, WorkCenter>();
      const operations: any[] = [];
      
      console.log(`Processing ${records.length} records from SAPDATA file`);

      // First pass: collect all distinct work center names with original casing
      const uniqueWorkCenters = new Set<string>();
      records.forEach((record: any) => {
        if (record['Oper.WorkCenter'] && record['Oper.WorkCenter'].trim()) {
          uniqueWorkCenters.add(record['Oper.WorkCenter'].trim());
        }
      });
      
      console.log(`Found ${uniqueWorkCenters.size} unique work centers in Excel file: ${Array.from(uniqueWorkCenters).join(', ')}`);

      // Second pass: Process operations
      records.forEach((record: any) => {
        try {
          // Process work centers first
          if (record['Oper.WorkCenter']) {
            const workCenterName = record['Oper.WorkCenter'].toString().trim();
            if (workCenterName && !workCenterMap.has(workCenterName)) {
              workCenterMap.set(workCenterName, {
                name: workCenterName,
                type: 'Manufacturing',
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
      
      console.log(`Processed ${processedData.workCenters.length} work centers`);
      console.log(`Processed ${processedData.jobs.length} jobs`);
      console.log(`Processed ${processedData.operations.length} operations`);

      // Extract real data for forecasting tables from the imported data
      // Create customers from the unique customer names in jobs
      const customerMap = new Map();
      processedData.jobs.forEach((job) => {
        if (job.customer && !customerMap.has(job.customer)) {
          customerMap.set(job.customer, {
            id: customerMap.size + 1,
            name: job.customer,
            industry: 'Manufacturing',
            contact_name: `Contact for ${job.customer}`,
            contact_email: `contact@${job.customer.toLowerCase().replace(/\s+/g, '')}.com`,
            contact_phone: `555-${Math.floor(1000 + Math.random() * 9000)}`,
            created_at: new Date().toISOString()
          });
        }
      });
      processedData.customers = Array.from(customerMap.values());
      
      // Create products based on job descriptions - extract real product names
      const productMap = new Map();
      processedData.jobs.forEach((job) => {
        // Extract potential product name from job description or title
        const productName = job.description || job.title || `Product from ${job.job_number}`;
        
        if (!productMap.has(productName)) {
          productMap.set(productName, {
            id: productMap.size + 1,
            name: productName,
            sku: `SKU-${job.job_number}`,
            category: 'Manufacturing',
            // Use actual job data to estimate prices instead of random numbers
            price: Number(job.sap_data?.reduce((sum, op) => sum + (Number(op['Work']) || 0), 0) * 10) || 100,
            cost: Number(job.sap_data?.reduce((sum, op) => sum + (Number(op['Work']) || 0), 0) * 5) || 50,
            inventory_level: Math.max(10, Math.floor(job.progress || 0)),
            reorder_point: 10,
            lead_time_days: 7,
            created_at: new Date().toISOString()
          });
        }
      });
      processedData.products = Array.from(productMap.values());
      
      // Create orders from job data using real job numbers and relationships
      processedData.orders = processedData.jobs.map((job, index) => {
        // Find the customer for this job
        const customer = processedData.customers.find(c => c.name === job.customer);
        return {
          id: index + 1,
          order_number: job.job_number,
          customer_id: customer?.id || 1,
          order_date: new Date(Date.parse(job.scheduled_date) || Date.now()).toISOString(),
          total_amount: Number(job.sap_data?.reduce((sum, op) => sum + (Number(op['Work']) || 0), 0) * 15) || 500,
          status: job.status,
          created_at: new Date().toISOString()
        };
      });
      
      // Create forecasts based on real job data and work histories
      processedData.forecasts = [];
      
      // Group jobs by product to create forecasts
      const productJobs = new Map();
      processedData.jobs.forEach(job => {
        // Find product associated with this job
        const productForJob = processedData.products.find(p => 
          job.description?.includes(p.name) || 
          job.title?.includes(p.name) || 
          p.name.includes(`Product from ${job.job_number}`)
        );
        
        if (productForJob) {
          if (!productJobs.has(productForJob.id)) {
            productJobs.set(productForJob.id, []);
          }
          productJobs.get(productForJob.id).push(job);
        }
      });
      
      // Create forecasts from job data
      let forecastId = 1;
      productJobs.forEach((jobs, productId) => {
        // Calculate actual and forecasted quantities based on job progress
        const completedJobs = jobs.filter(job => job.status === 'Completed').length;
        const inProgressJobs = jobs.filter(job => job.status === 'In Progress').length;
        const newJobs = jobs.filter(job => job.status === 'New').length;
        
        // Current quarter based on completed jobs
        processedData.forecasts.push({
          id: forecastId++,
          product_id: productId,
          period: `2023-Q1`,
          forecast_quantity: completedJobs + inProgressJobs + Math.round(newJobs * 0.5),
          actual_quantity: completedJobs + Math.round(inProgressJobs * 0.7),
          variance_percent: -5 + Math.random() * 10,
          trend: inProgressJobs > completedJobs ? 'increasing' : 'decreasing',
          confidence: 'high',
          created_at: new Date().toISOString()
        });
        
        // Future quarters with decreasing confidence
        processedData.forecasts.push({
          id: forecastId++,
          product_id: productId,
          period: `2023-Q2`,
          forecast_quantity: completedJobs + inProgressJobs + newJobs,
          actual_quantity: null,
          variance_percent: null,
          trend: 'stable',
          confidence: 'medium',
          created_at: new Date().toISOString()
        });
        
        processedData.forecasts.push({
          id: forecastId++,
          product_id: productId,
          period: `2023-Q3`,
          forecast_quantity: Math.round((completedJobs + inProgressJobs + newJobs) * 1.2),
          actual_quantity: null,
          variance_percent: null,
          trend: 'increasing',
          confidence: 'low',
          created_at: new Date().toISOString()
        });
      });

      // First, clear existing data to ensure consistency
      try {
        console.log('Clearing existing work centers and operations data...');
        await clearWorkCenters();
        await clearSAPOperations();
        await clearJobOperations();
        console.log('Cleared existing data successfully');
      } catch (clearError) {
        console.error('Error clearing existing data:', clearError);
      }

      // Insert operations in batches
      const BATCH_SIZE = 100;
      for (let i = 0; i < operations.length; i += BATCH_SIZE) {
        const batch = operations.slice(i, i + BATCH_SIZE);
        await upsertJobOperations(batch);
      }

      // Also update the sap_operations table which is needed for Work Centers page
      console.log('Updating sap_operations table...');
      await upsertSAPOperations(operations);
      
      // Update work centers table with exactly what's in the Excel file
      console.log('Updating work centers table...');
      await upsertWorkCenters(processedData.workCenters);
      
      // Update forecasting-related tables
      console.log('Updating forecasting tables...');
      await upsertForecasts(processedData.forecasts);
      await upsertProducts(processedData.products);
      await upsertCustomers(processedData.customers);
      await upsertOrders(processedData.orders);

      // Return the processed data
      return processedData;
    } else if (file.name.includes('PURCHASEORDERS')) {
      // Process purchase orders
      const purchaseOrders = records.map((record: any) => {
        try {
          // Convert Excel date to ISO string
          const excelDate = record['Document Date'];
          const dateValue = typeof excelDate === 'number'
            ? new Date(Math.round((excelDate - 25569) * 86400 * 1000)).toISOString()
            : new Date().toISOString();
            
          // Track the Req. Tracking Number to link POs to jobs
          const reqTrackingNumber = record['Req. Tracking Number'] || '';
          
          // This will be linked to jobs later using the job_number
          // Some tracking numbers directly correspond to job numbers
          return {
            purchasing_document: String(record['Purchasing Document'] || ''),
            req_tracking_number: String(reqTrackingNumber),
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
              Number(record['Still to be delivered (qty)']) > 0 ? 'Open' : 'Completed',
            // Try to link to job by matching tracking number to job number
            job_number: String(reqTrackingNumber)
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
      const shipmentLogs = records.map((record: any) => {
        try {
          // Create a unique identifier from available fields
          const poNumber = `PO-${record['Plant'] || 'NOPLANT'}-${record['Order'] || Date.now()}`;
          const postingDate = record['PostingDate'] || new Date().toISOString();
          
          // Store description in a separate variable to use for job creation
          const description = `${record['Operation Short Text'] || ''} - ${record['Confirmation Text'] || ''}`;

          return {
            id: null, // Will be generated by the database
            po_number: poNumber,
            vendor: record['EmployeeName'] || '',
            shipment_date: postingDate,
            received_date: null, // Not yet received
            status: 'In Transit',
            tracking_number: `TR-${Date.now()}`, // Generate a unique tracking number
            carrier: record['Plant'] || 'Default Carrier',
            // Adding a _temp field to store data we'll need for job creation 
            // (this won't be sent to database)
            _temp: {
              description
            }
          };
        } catch (error) {
          console.error('Error processing work log record:', record, error);
          return null;
        }
      }).filter(Boolean);

      // Add shipment logs to processed data
      // Remove the _temp field before saving to database
      processedData.shipmentLogs = shipmentLogs.map(log => {
        const { _temp, ...cleanLog } = log;
        return cleanLog;
      });

      // Create jobs from work logs
      const jobMap = new Map<string, any>();
      shipmentLogs.forEach(log => {
        if (!jobMap.has(log.po_number)) {
          jobMap.set(log.po_number, {
            id: null, // Will be assigned by database
            job_number: log.po_number,
            title: log._temp?.description?.split(' - ')[0] || 'Work Log Entry',
            description: log._temp?.description || '',
            status: 'In Progress',
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            scheduled_date: log.shipment_date,
            priority: 'Medium',
            progress: 50,
            work_center: log.vendor,
            customer: log.vendor,
            notes: [],
            reminders: [],
            timeline: [{
              date: log.shipment_date,
              description: log._temp?.description || '',
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
      await upsertJobs(batch);
    }

    // Update other data
    await Promise.all([
      upsertWorkCenters(processedData.workCenters),
      upsertPurchaseOrders(processedData.purchaseOrders),
      upsertShipmentLogs(processedData.shipmentLogs)
    ]);

    // Update last updated timestamp
    await db.updateLastUpdated('job_operations');

    return processedData;

  } catch (error) {
    console.error('Import error:', error);
    throw error;
  }
}

// Wrapper functions to handle type conversions
async function upsertJobs(jobs: any[]) {
  try {
    // Convert to the format expected by db.ts
    console.log(`Upserting ${jobs.length} jobs`);
    return await db.upsertJobs(jobs);
  } catch (error) {
    console.error('Error upserting jobs:', error);
    throw error;
  }
}

async function upsertWorkCenters(workCenters: any[]) {
  try {
    console.log(`Upserting ${workCenters.length} work centers`);
    return await db.upsertWorkCenters(workCenters);
  } catch (error) {
    console.error('Error upserting work centers:', error);
    throw error;
  }
}

async function upsertPurchaseOrders(purchaseOrders: any[]) {
  try {
    console.log(`Upserting ${purchaseOrders.length} purchase orders`);
    
    // First try the normal method
    const response = await db.upsertPurchaseOrders(purchaseOrders);
    console.log("Database response:", response);
    
    // If failed, try the manual import method as fallback
    if (!response) {
      console.log("Standard import failed, attempting manual import...");
      const manualResponse = await db.manualPurchaseOrderImport(purchaseOrders);
      console.log("Manual import response:", manualResponse);
      
      if (manualResponse.success) {
        console.log(`Manual import succeeded with ${manualResponse.successCount} records`);
      } else {
        console.error("Manual import also failed:", manualResponse.error);
      }
      
      // Return true if any records were successfully imported
      return manualResponse.success;
    }
    
    // Verify data is in the database by querying it back
    try {
      // This assumes you have access to supabase client like this
      const result = await db.getPurchaseOrders();
      console.log("Verification - POs in database:", result?.length || 0);
    } catch (e) {
      console.error("Verification failed:", e);
    }
    
    return response;
  } catch (error) {
    console.error('Error upserting purchase orders:', error);
    
    // Try manual import as a last resort after catching errors
    try {
      console.log("Trying emergency manual import after error...");
      const emergencyResponse = await db.manualPurchaseOrderImport(purchaseOrders);
      console.log("Emergency manual import response:", emergencyResponse);
      return emergencyResponse.success;
    } catch (manualError) {
      console.error("Emergency manual import also failed:", manualError);
      throw error; // Throw the original error
    }
  }
}

async function upsertShipmentLogs(shipmentLogs: any[]) {
  try {
    console.log(`Upserting ${shipmentLogs.length} shipment logs`);
    
    // Add date conversion for shipment logs if needed
    const processedLogs = shipmentLogs.map(log => {
      // Try to convert dates if they're in wrong format
      try {
        if (log.shipment_date && typeof log.shipment_date === 'string') {
          // Check if the date is already in ISO format
          if (!log.shipment_date.includes('T')) {
            const dateParts = log.shipment_date.split('/');
            if (dateParts.length === 3) {
              // Format appears to be DD/MM/YYYY
              const day = parseInt(dateParts[0]);
              const month = parseInt(dateParts[1]) - 1; // JS months are 0-based
              const year = parseInt(dateParts[2]);
              if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                log.shipment_date = new Date(year, month, day).toISOString();
              }
            }
          }
        }
      } catch (e) {
        console.warn('Error converting date:', e);
      }
      return log;
    });
    
    // First try the normal method
    const response = await db.upsertShipmentLogs(processedLogs);
    console.log("Database response:", response);
    
    // If failed, try the manual import method as fallback
    if (!response) {
      console.log("Standard import failed, attempting manual import...");
      const manualResponse = await db.manualShipmentLogImport(processedLogs);
      console.log("Manual import response:", manualResponse);
      
      if (manualResponse.success) {
        console.log(`Manual import succeeded with ${manualResponse.successCount} records`);
      } else {
        console.error("Manual import also failed:", manualResponse.error);
      }
      
      // Return true if any records were successfully imported
      return manualResponse.success;
    }
    
    return response;
  } catch (error) {
    console.error('Error upserting shipment logs:', error);
    
    // Try manual import as a last resort after catching errors
    try {
      console.log("Trying emergency manual import after error...");
      const emergencyResponse = await db.manualShipmentLogImport(shipmentLogs);
      console.log("Emergency manual import response:", emergencyResponse);
      return emergencyResponse.success;
    } catch (manualError) {
      console.error("Emergency manual import also failed:", manualError);
      throw error; // Throw the original error
    }
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

// Add new wrapper functions for the SAP operations and job operations
async function upsertSAPOperations(operations: any[]) {
  try {
    console.log(`Upserting ${operations.length} SAP operations`);
    return await db.upsertSAPOperations(operations);
  } catch (error) {
    console.error('Error upserting SAP operations:', error);
    throw error;
  }
}

async function upsertJobOperations(operations: any[]) {
  try {
    console.log(`Upserting ${operations.length} job operations`);
    return await db.upsertJobOperations(operations);
  } catch (error) {
    console.error('Error upserting job operations:', error);
    throw error;
  }
}

// Add wrapper functions for clearing tables
async function clearWorkCenters() {
  try {
    console.log('Clearing work centers');
    return await db.clearWorkCenters();
  } catch (error) {
    console.error('Error clearing work centers:', error);
    throw error;
  }
}

async function clearSAPOperations() {
  try {
    console.log('Clearing SAP operations');
    return await db.clearSAPOperations();
  } catch (error) {
    console.error('Error clearing SAP operations:', error);
    throw error;
  }
}

async function clearJobOperations() {
  try {
    console.log('Clearing job operations');
    return await db.clearJobOperations();
  } catch (error) {
    console.error('Error clearing job operations:', error);
    throw error;
  }
}

export async function checkDatabaseTables() {
  try {
    // Use serviceRoleClient directly
    const { data: poResult, error: poError } = await serviceRoleClient.from('purchase_orders').select('count').single() || {};
    console.log("purchase_orders count:", poResult?.count || 0);
    if (poError) console.error("Error checking purchase_orders:", poError);
    
    // Check shipmentlogs table
    const { data: slResult, error: slError } = await serviceRoleClient.from('shipmentlogs').select('count').single() || {};
    console.log("shipmentlogs count:", slResult?.count || 0);
    if (slError) console.error("Error checking shipmentlogs:", slError);
    
    return {
      purchaseOrdersCount: poResult?.count || 0,
      shipmentlogsCount: slResult?.count || 0
    };
  } catch (error) {
    console.error("Database check error:", error);
    return { error };
  }
}

// Add new helper functions for the forecasting tables

async function upsertForecasts(forecasts: any[]) {
  try {
    console.log(`Upserting ${forecasts.length} forecasts`);
    
    const { error } = await serviceRoleClient
      .from('forecasts')
      .upsert(forecasts, {
        onConflict: 'id',
        ignoreDuplicates: false
      });
      
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error upserting forecasts:', error);
    return false;
  }
}

async function upsertProducts(products: any[]) {
  try {
    console.log(`Upserting ${products.length} products`);
    
    const { error } = await serviceRoleClient
      .from('products')
      .upsert(products, {
        onConflict: 'id',
        ignoreDuplicates: false
      });
      
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error upserting products:', error);
    return false;
  }
}

async function upsertCustomers(customers: any[]) {
  try {
    console.log(`Upserting ${customers.length} customers`);
    
    const { error } = await serviceRoleClient
      .from('customers')
      .upsert(customers, {
        onConflict: 'id',
        ignoreDuplicates: false
      });
      
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error upserting customers:', error);
    return false;
  }
}

async function upsertOrders(orders: any[]) {
  try {
    console.log(`Upserting ${orders.length} orders`);
    
    const { error } = await serviceRoleClient
      .from('orders')
      .upsert(orders, {
        onConflict: 'id',
        ignoreDuplicates: false
      });
      
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error upserting orders:', error);
    return false;
  }
}