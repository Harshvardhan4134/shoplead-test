import { supabase, serviceRoleClient } from './supabaseClient';
import { config } from '@/config/env';

// Define types
interface Job {
  id: number;
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
  sap_data: Array<{
    'Sales Document': string;
    'Oper./Act.': string;
    'Oper.WorkCenter': string;
    Description: string;
    'Opr. short text': string;
    Work: number;
    'Actual work': number;
  }>;
  vendor_operations?: Array<{
    'Sales Document': string;
    'Oper./Act.': string;
    'Oper.WorkCenter': string;
    Description: string;
    'Opr. short text': string;
    Work: number;
    'Actual work': number;
  }>;
  notes?: any[];
  reminders?: any[];
  timeline?: any[];
  ncr?: any[];
}

interface WorkCenter {
  id: number;
  name: string;
  type: string;
  status: string;
  utilization: number;
}

interface PurchaseOrder {
  id: number;
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
  id: number;
  po_number: string | null;
  vendor: string;
  shipment_date: string;
  received_date: string | null;
  status: string;
  tracking_number: string | null;
  carrier: string | null;
}

interface JobTimeline {
  id: number;
  job_id: number;
  title: string;
  date: string;
  description: string;
  status: 'completed' | 'in-progress' | 'pending';
  vendor?: string;
}

interface VendorOperation {
  id: number;
  job_id: number;
  operation: string;
  vendor: string;
  date_range: string;
  status: string;
  notes: string | null;
}

interface NCR {
  id?: number;
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

interface SAPOperation {
  order_number: string;
  operation_number: string;
  work_center: string;
  description?: string;
  short_text?: string;
  planned_work: number;
  actual_work: number;
  status?: string;
}

function handleDbError(error: any, source: string) {
  console.error(`Database error in ${source}:`, error);
}

class Database {
  async getWorkCenters() {
    try {
      // Get all SAP operations first
      const { data: sapOps, error: sapError } = await supabase
        .from('sap_operations')
        .select('*');

      if (sapError) throw sapError;

      // Group operations by work center
      const workCenterGroups = (sapOps as SAPOperation[]).reduce((acc, op) => {
        const wcName = op.work_center;
        if (!acc[wcName]) {
          acc[wcName] = [];
        }
        acc[wcName].push(op);
        return acc;
      }, {} as Record<string, SAPOperation[]>);

      // Create work centers from real data
      const workCenters = Object.entries(workCenterGroups).map(([name, ops]) => {
        const totalPlanned = ops.reduce((sum, op) => sum + (Number(op.planned_work) || 0), 0);
        const totalActual = ops.reduce((sum, op) => sum + (Number(op.actual_work) || 0), 0);

        // Calculate active jobs (those with actual work > 0 but < planned)
        const activeJobs = new Set(
          ops.filter(op => {
            const actual = Number(op.actual_work) || 0;
            const planned = Number(op.planned_work) || 0;
            return actual > 0 && actual < planned;
          }).map(op => op.order_number)
        ).size;

        // Calculate utilization based on actual vs planned work
        // Ensure it's an integer by rounding
        const utilization = Math.min(100, Math.round(totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0));

        return {
          name,
          type: 'Manufacturing',
          status: activeJobs > 0 ? 'Running' : 'Idle',
          utilization,  // Now guaranteed to be an integer
          active_jobs: activeJobs,
          total_capacity: Math.round(Math.max(100, totalPlanned)), // Ensure integer
          operator_count: Math.max(1, Math.ceil(totalPlanned / 40)), // At least 1 operator
          last_maintenance: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          next_maintenance: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000).toISOString()
        };
      });

      // Update the work centers table
      const { error: upsertError } = await supabase
        .from('work_centers')
        .upsert(workCenters, { onConflict: 'name' });

      if (upsertError) throw upsertError;

      return workCenters;
    } catch (error) {
      handleDbError(error, 'getWorkCenters');
      return [];
    }
  }
  async updateWorkCentersFromOperations() {
    try {
      const workCenters = await this.getWorkCenters();
      console.log(`Updated ${workCenters.length} work centers from operations data`);
      return true;
    } catch (error) {
      handleDbError(error, 'updateWorkCentersFromOperations');
      return false;
    }
  }

  async getNCRs() {
    try {
      const { data, error } = await serviceRoleClient
        .from('ncrs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      handleDbError(error, 'getNCRs');
      return [];
    }
  }

  async getJobs() {
    try {
      // First get all SAP operations to determine real work centers and job numbers
      const { data: sapOps, error: sapError } = await supabase
        .from('sap_operations')
        .select('*');

      if (sapError) throw sapError;

      // Group operations by order number to create jobs if they don't exist
      const orderGroups = sapOps.reduce((acc, op) => {
        if (!acc[op.order_number]) {
          acc[op.order_number] = [];
        }
        acc[op.order_number].push(op);
        return acc;
      }, {});

      // Create or update jobs for each order
      const jobs = Object.entries(orderGroups).map(([orderNumber, ops]: [string, any[]]) => {
        const firstOp = ops[0];
        const totalPlanned = ops.reduce((sum, op) => sum + (Number(op.planned_work) || 0), 0);
        const totalActual = ops.reduce((sum, op) => sum + (Number(op.actual_work) || 0), 0);
        const progress = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;

        return {
          job_number: orderNumber,
          title: firstOp.description || firstOp.short_text || `Job ${orderNumber}`,
          description: firstOp.description || '',
          status: progress >= 100 ? 'Completed' : progress > 0 ? 'In Progress' : 'New',
          due_date: new Date().toISOString(),
          scheduled_date: new Date().toISOString(),
          priority: 'Medium',
          progress: Math.round(progress),
          work_center: firstOp.work_center,
          customer: 'Customer',
          sap_data: ops.map(op => ({
            'Sales Document': op.order_number,
            'Oper./Act.': op.operation_number,
            'Oper.WorkCenter': op.work_center,
            'Description': op.description,
            'Opr. short text': op.short_text,
            'Work': op.planned_work,
            'Actual work': op.actual_work
          }))
        };
      });

      // Upsert the jobs to the database
      const { error: upsertError } = await supabase
        .from('jobs')
        .upsert(
          jobs.map(job => ({
            ...job,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })),
          { onConflict: 'job_number' }
        );

      if (upsertError) throw upsertError;

      // Return the jobs with their operations
      return jobs;
    } catch (error) {
      handleDbError(error, 'getJobs');
      return [];
    }
  }

  async getJobsByWorkCenter(workCenterName: string, status?: 'Available' | 'In Progress' | 'Backlog') {
    try {
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .eq('work_center', workCenterName);

      if (jobsError) throw jobsError;

      // Get all operations for these jobs
      let allOperations = [];
      const { data: sapOps, error: sapError } = await supabase
        .from('sap_operations')
        .select('*');

      if (!sapError && sapOps && sapOps.length > 0) {
        allOperations = sapOps;
      }

      // Filter and format jobs based on status
      const filteredJobs = jobs.map(job => {
        const jobOperations = allOperations.filter(op =>
          op.order_number === job.job_number &&
          op.work_center === workCenterName
        );

        const totalWork = jobOperations.reduce((sum, op) => sum + (Number(op.planned_work) || 0), 0);
        const actualWork = jobOperations.reduce((sum, op) => sum + (Number(op.actual_work) || 0), 0);

        let operationStatus = 'Available';
        if (actualWork > 0 && actualWork < totalWork) {
          operationStatus = 'In Progress';
        } else if (actualWork === 0 && totalWork > 0) {
          operationStatus = 'Backlog';
        }

        return {
          ...job,
          operationStatus,
          planned_hours: totalWork,
          actual_hours: actualWork,
          remaining_hours: totalWork - actualWork
        };
      });

      // Return jobs based on requested status
      if (status) {
        return filteredJobs.filter(job => job.operationStatus === status);
      }

      return filteredJobs;
    } catch (error) {
      handleDbError(error, 'getJobsByWorkCenter');
      return [];
    }
  }

  async getSAPOperations() {
    try {
      const { data, error } = await supabase
        .from('sap_operations')
        .select('*');

      if (error) throw error;

      return data ? data.sort((a, b) => a.order_number.localeCompare(b.order_number)) : [];
    } catch (error) {
      handleDbError(error, 'getSAPOperations');
      return [];
    }
  }

  async getWorkCenterMetrics(workCenterName: string) {
    try {
      // Get operations from SAP data
      const { data: operations, error } = await supabase
        .from('sap_operations')
        .select('*')
        .eq('work_center', workCenterName);

      if (error) throw error;

      const uniqueOrders = new Set(operations.map(op => op.order_number));

      const totalPlanned = operations.reduce((sum, op) => sum + (Number(op.planned_work) || 0), 0);
      const totalActual = operations.reduce((sum, op) => sum + (Number(op.actual_work) || 0), 0);

      const inProgress = operations.filter(op => {
        const actual = Number(op.actual_work) || 0;
        const planned = Number(op.planned_work) || 0;
        return actual > 0 && actual < planned;
      });

      const backlog = operations.filter(op => {
        const actual = Number(op.actual_work) || 0;
        return actual === 0;
      });

      const inProgressHours = inProgress.reduce((sum, op) =>
        sum + ((Number(op.planned_work) || 0) - (Number(op.actual_work) || 0)), 0);

      const backlogHours = backlog.reduce((sum, op) =>
        sum + (Number(op.planned_work) || 0), 0);

      return {
        total_operations: operations.length,
        total_orders: uniqueOrders.size,
        planned_hours: totalPlanned,
        actual_hours: totalActual,
        efficiency: totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0,
        in_progress_hours: inProgressHours,
        backlog_hours: backlogHours,
        available_work_hours: Math.max(0, totalPlanned - inProgressHours - backlogHours)
      };

    } catch (error) {
      handleDbError(error, 'getWorkCenterMetrics');
      return null;
    }
  }

  async getOrderOperations(orderNumber: string) {
    try {
      // Try SAP operations first
      const { data: sapOps, error: sapError } = await supabase
        .from('sap_operations')
        .select('*')
        .eq('order_number', orderNumber)
        .order('operation_number');

      if (!sapError && sapOps && sapOps.length > 0) {
        return sapOps.map(op => ({
          'Sales Document': op.order_number,
          'Oper./Act.': op.operation_number,
          'Oper.WorkCenter': op.work_center,
          'Description': op.description,
          'Opr. short text': op.short_text,
          'Work': op.planned_work,
          'Actual work': op.actual_work
        }));
      }

      // Fallback to job_operations if no SAP operations found
      const { data: jobOps, error: jobError } = await supabase
        .from('job_operations')
        .select('*')
        .eq('Sales Document', orderNumber);

      if (jobError) throw jobError;
      return jobOps || [];
    } catch (error) {
      handleDbError(error, 'getOrderOperations');
      return [];
    }
  }

  async getJobByNumber(jobNumber: string) {
    try {
      console.log('getJobByNumber called with jobNumber:', jobNumber);

      // First get the job details
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('job_number', jobNumber)
        .single();

      if (jobError) {
        console.error('Error fetching job details:', jobError);
        throw jobError;
      }

      if (!job) {
        console.log('No job found with job number:', jobNumber);
        return null;
      }

      // Try job_operations table first using OR condition
      const { data: jobOps, error: jobOpsError } = await supabase
        .from('job_operations')
        .select('*')
        .or(`Order.eq.${jobNumber},Sales Document.eq.${jobNumber}`);

      let formattedOperations = [];

      if (jobOpsError) {
        console.error('Error fetching from job_operations:', jobOpsError);
      } else if (jobOps && jobOps.length > 0) {
        console.log('Found operations in job_operations:', jobOps.length);
        formattedOperations = jobOps.map(op => ({
          'Sales Document': op['Sales Document'] || op['Order'] || jobNumber,
          'Order': op['Order'] || op['Sales Document'] || jobNumber,
          'Oper./Act.': op['Oper./Act.'],
          'Oper.WorkCenter': op['Oper.WorkCenter'],
          'Description': op['Description'],
          'Opr. short text': op['Opr. short text'],
          'Work': Number(op['Work']) || 0,
          'Actual work': Number(op['Actual work']) || 0
        }));
      }

      console.log('Total operations found:', formattedOperations.length);
      console.log('Sample operation:', formattedOperations[0]);

      // Filter vendor operations
      const vendorOperations = formattedOperations.filter(op => {
        const workCenter = op['Oper.WorkCenter'] || '';
        const description = (op['Opr. short text'] || '').toLowerCase();
        return workCenter === 'SR' || description.includes('vendor');
      });

      console.log('Vendor operations found:', vendorOperations.length);

      // Return enriched job data
      return {
        ...job,
        sap_data: formattedOperations,
        vendor_operations: vendorOperations,
        notes: [],
        reminders: [],
        timeline: [],
        ncr: []
      };
    } catch (error) {
      console.error('Error in getJobByNumber:', error);
      throw error;
    }
  }

  async upsertJobs(jobs: Job[]) {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .upsert(
          jobs.map(job => ({
            job_number: job.job_number,
            title: job.title || '',
            description: job.description || '',
            status: job.status || 'New',
            due_date: job.due_date,
            scheduled_date: job.scheduled_date,
            priority: job.priority || 'Medium',
            progress: job.progress || 0,
            work_center: job.work_center,
            customer: job.customer || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })),
          { onConflict: 'job_number' }
        );

      if (error) throw error;
      return data;
    } catch (error) {
      handleDbError(error, 'upsertJobs');
      return null;
    }
  }

  async upsertWorkCenters(workCenters: WorkCenter[]) {
    try {
      const { error } = await supabase
        .from('work_centers')
        .upsert(workCenters, {
          onConflict: 'name',
          ignoreDuplicates: false
        });

      if (error) throw error;
      return true;
    } catch (error) {
      handleDbError(error, 'upsertWorkCenters');
      return false;
    }
  }

  async upsertPurchaseOrders(purchaseOrders: PurchaseOrder[]) {
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .upsert(purchaseOrders, {
          onConflict: 'po_number',
          ignoreDuplicates: false
        });

      if (error) throw error;
      return true;
    } catch (error) {
      handleDbError(error, 'upsertPurchaseOrders');
      return false;
    }
  }

  async upsertShipmentLogs(shipmentLogs: ShipmentLog[]) {
    try {
      const { error } = await supabase
        .from('shipmentlogs')
        .upsert(shipmentLogs, {
          onConflict: 'id',
          ignoreDuplicates: false
        });

      if (error) throw error;
      return true;
    } catch (error) {
      handleDbError(error, 'upsertShipmentLogs');
      return false;
    }
  }

  async upsertSAPOperations(operations: any[]) {
    try {
      const operationsToInsert = operations.map(op => ({
        order_number: op['Order'] || op['Sales Document'] || '',
        operation_number: op['Oper./Act.'] || '',
        work_center: op['Oper.WorkCenter'] || '',
        description: op['Description'] || '',
        short_text: op['Opr. short text'] || '',
        planned_work: Number(op['Work']) || 0,
        actual_work: Number(op['Actual work']) || 0,
        status: 'Not Started'
      }));

      console.log('Upserting SAP operations:', operationsToInsert);

      const { error } = await supabase
        .from('sap_operations')
        .upsert(operationsToInsert, {
          onConflict: 'order_number,operation_number',
          ignoreDuplicates: false
        });

      if (error) throw error;
      return true;
    } catch (error) {
      handleDbError(error, 'upsertSAPOperations');
      return false;
    }
  }

  async upsertJobOperations(operations: any[]): Promise<boolean> {
    try {
      const jobOperations = operations.map(op => ({
        "Sales Document": op['Sales Document'],
        "Order": op['Order'],
        "Oper./Act.": op['Oper./Act.'],
        "Oper.WorkCenter": op['Oper.WorkCenter'],
        "Description": op['Description'],
        "Opr. short text": op['Opr. short text'],
        "Work": op['Work'],
        "Actual work": op['Actual work']
      }));

      console.log('Upserting job operations:', jobOperations);

      const { error } = await supabase
        .from('job_operations')
        .upsert(jobOperations, {
          onConflict: 'Order,Oper./Act.',
          ignoreDuplicates: false
        });

      if (error) throw error;
      return true;
    } catch (error) {
      handleDbError(error, 'upsertJobOperations');
      return false;
    }
  }

  async updateLastUpdated(tableName: string) {
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: `${tableName}_last_updated`,
          value: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('updateLastUpdated: Unexpected error:', error);
      throw error;
    }
  }

  async debugTableData(tableName: string) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(5);

      if (error) {
        console.error(`Debug ${tableName} error:`, error);
        throw error;
      }

      console.log(`Debug ${tableName} data:`, data);
      console.log(`Debug ${tableName} count:`, data?.length || 0);
      return data;
    } catch (error) {
      console.error(`Debug ${tableName} unexpected error:`, error);
      throw error;
    }
  }

  async checkTablesExist() {
    try {
      console.log('Checking if tables exist and have data...');

      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('count');

      if (jobsError) {
        console.error('Error checking jobs table:', jobsError);
      } else {
        console.log('Jobs table exists with count:', jobs);
      }

      const { data: jobOps, error: jobOpsError } = await supabase
        .from('job_operations')
        .select('count');

      if (jobOpsError) {
        console.error('Error checking job_operations table:', jobOpsError);
      } else {
        console.log('job_operations table exists with count:', jobOps);
      }

      const { data: sapOps, error: sapOpsError } = await supabase
        .from('sap_operations')
        .select('count');

      if (sapOpsError) {
        console.error('Error checking sap_operations table:', sapOpsError);
      } else {
        console.log('sap_operations table exists with count:', sapOps);
      }

      return {
        jobs: !jobsError,
        jobOps: !jobOpsError,
        sapOps: !sapOpsError
      };
    } catch (error) {
      console.error('Error checking tables:', error);
      return {
        jobs: false,
        jobOps: false,
        sapOps: false
      };
    }
  }

  async uploadFile(file: File, bucket: string) {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (error) {
        console.error('uploadFile: Storage error:', error);
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('uploadFile: Unexpected error:', error);
      throw error;
    }
  }

  async upsertNCRs(ncrs: NCR[] | NCR) {
    try {
      const ncrsArray = Array.isArray(ncrs) ? ncrs : [ncrs];

      const { data, error } = await serviceRoleClient
        .from('ncrs')
        .upsert(
          ncrsArray.map(ncr => ({
            ...ncr,
            updated_at: new Date().toISOString(),
            created_at: ncr.created_at || new Date().toISOString()
          })),
          { onConflict: 'ncr_number' }
        );

      if (error) throw error;
      return data;
    } catch (error) {
      handleDbError(error, 'upsertNCRs');
      return null;
    }
  }

  async getPurchaseOrders() {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .order('issue_date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      handleDbError(error, 'getPurchaseOrders');
      return [];
    }
  }

  async getShipmentLogs() {
    try {
      const { data, error } = await supabase
        .from('shipmentlogs')
        .select('*')
        .order('shipment_date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      handleDbError(error, 'getShipmentLogs');
      return [];
    }
  }
}

export const db = new Database();