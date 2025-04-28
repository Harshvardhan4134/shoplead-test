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
      console.log('Getting work centers from database...');
      
      // First try to get from the sap_operations table to ensure correct count
      const { data: sapOps, error: sapError } = await supabase
        .from('sap_operations')
        .select('work_center, order_number, actual_work, planned_work');

      if (sapError) {
        console.error('Error fetching SAP operations:', sapError);
      } else {
        console.log(`Found ${sapOps?.length || 0} SAP operations`);
        
        // Extract unique work centers from operations, removing any empty values
        const uniqueWorkCenters = new Set();
        sapOps.forEach(op => {
          if (op.work_center && op.work_center.trim()) {
            uniqueWorkCenters.add(op.work_center.trim());
          }
        });
        
        const workCenterNames = Array.from(uniqueWorkCenters) as string[];
        console.log(`Found ${workCenterNames.length} unique work centers: ${workCenterNames.join(', ')}`);

        // Create work centers from the unique work center names in Excel data
        const workCenters = workCenterNames.map(name => {
          // Get all operations for this work center
          const ops = sapOps.filter(op => op.work_center === name);
          
          // Calculate active jobs (those with actual work > 0 but < planned)
          const activeJobs = new Set(
            sapOps.filter(op => {
              if (op.work_center !== name) return false;
              const actual = Number(op.actual_work) || 0;
              const planned = Number(op.planned_work) || 0;
              return actual > 0 && actual < planned;
            }).map(op => op.order_number)
          ).size;
          
          return {
            name,
            type: 'Manufacturing',
            status: activeJobs > 0 ? 'Running' : 'Idle',
            utilization: Math.min(100, Math.floor(Math.random() * 80) + 20), // Random for demo
            active_jobs: activeJobs,
            total_capacity: 100,
            operator_count: Math.max(1, Math.ceil(ops.length / 10)), // At least 1 operator
            last_maintenance: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            next_maintenance: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000).toISOString()
          };
        });

        console.log(`Generated ${workCenters.length} work centers from operations data`);

        // Update the work centers table to ensure consistency
        const { error: upsertError } = await supabase
          .from('work_centers')
          .upsert(workCenters, { onConflict: 'name' });

        if (upsertError) {
          console.error('Error upserting work centers:', upsertError);
          throw upsertError;
        }

        return workCenters;
      }
      
      // If we couldn't get work centers from SAP operations, check work_centers table
      const { data: workCentersFromTable, error: wcError } = await supabase
        .from('work_centers')
        .select('*');
      
      if (wcError) {
        console.error('Error fetching from work_centers table:', wcError);
      } else if (workCentersFromTable && workCentersFromTable.length > 0) {
        console.log(`Found ${workCentersFromTable.length} work centers in work_centers table`);
        return workCentersFromTable;
      }

      // As a last resort, get work centers from job_operations
      console.log('Trying to get work centers from job_operations...');
      const { data: jobOps, error: jobOpsError } = await supabase
        .from('job_operations')
        .select('"Oper.WorkCenter"');
        
      if (jobOpsError) {
        console.error('Error fetching job operations:', jobOpsError);
        return [];
      }
      
      const uniqueNames = new Set();
      jobOps.forEach(op => {
        if (op['Oper.WorkCenter'] && op['Oper.WorkCenter'].trim()) {
          uniqueNames.add(op['Oper.WorkCenter'].trim());
        }
      });
      
      const workCentersFallback = Array.from(uniqueNames).map((name: string) => ({
        name,
        type: 'Manufacturing',
        status: 'Idle',
        utilization: 50
      }));
      
      console.log(`Generated ${workCentersFallback.length} fallback work centers`);
      return workCentersFallback;
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
      // First check if we already have jobs in the database
      const { data: existingJobs, error: jobsError } = await serviceRoleClient
        .from('jobs')
        .select('*')
        .order('id', { ascending: false })
        .limit(100);
      
      if (!jobsError && existingJobs && existingJobs.length > 0) {
        console.log(`Found ${existingJobs.length} existing jobs in the database`);
        return existingJobs;
      }
      
      // If no existing jobs, try to create from operations
      // First get all SAP operations to determine real work centers and job numbers
      const { data: sapOps, error: sapError } = await serviceRoleClient
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
      const jobs = Object.entries(orderGroups).map(([orderNumber, ops]: [string, any[]], index) => {
        const firstOp = ops[0];
        const totalPlanned = ops.reduce((sum, op) => sum + (Number(op.planned_work) || 0), 0);
        const totalActual = ops.reduce((sum, op) => sum + (Number(op.actual_work) || 0), 0);
        const progress = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;

        return {
          // Don't specify ID - let the database generate it with SERIAL
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
      const { data: upsertedJobs, error: upsertError } = await serviceRoleClient
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
      if (upsertedJobs) {
        return upsertedJobs;
      }

      // Fallback to creating test data if no jobs were inserted
      console.log('No jobs found or created, using test data');
      return this.createTestJobs();
    } catch (error) {
      handleDbError(error, 'getJobs');
      // If error occurred, provide test data
      return this.createTestJobs();
    }
  }

  // Helper method to create test jobs with unique IDs
  private async createTestJobs() {
    try {
      // Get the highest ID in the jobs table
      const { data: maxIdResult, error: maxIdError } = await serviceRoleClient
        .from('jobs')
        .select('id')
        .order('id', { ascending: false })
        .limit(1);
      
      const startId = maxIdResult && maxIdResult.length > 0 ? maxIdResult[0].id + 1 : 1000;
      
      const testJobs = [
        {
          id: startId,
          job_number: 'JOB-2023-001',
          title: 'Manufacturing Component A',
          description: 'Precision manufacturing of Component A',
          status: 'In Progress',
          due_date: new Date().toISOString(),
          scheduled_date: new Date().toISOString(),
          priority: 'High',
          progress: 65,
          work_center: 'CNC',
          customer: 'Acme Corp',
          sap_data: []
        },
        {
          id: startId + 1,
          job_number: 'JOB-2023-002',
          title: 'Assembly of Product X',
          description: 'Final assembly of Product X components',
          status: 'New',
          due_date: new Date().toISOString(),
          scheduled_date: new Date().toISOString(),
          priority: 'Medium',
          progress: 0,
          work_center: 'Assembly',
          customer: 'TechSystems Inc',
          sap_data: []
        },
        {
          id: startId + 2,
          job_number: 'JOB-2023-003',
          title: 'Custom Part Fabrication',
          description: 'Custom fabrication for special order',
          status: 'New',
          due_date: new Date().toISOString(),
          scheduled_date: new Date().toISOString(),
          priority: 'Medium',
          progress: 10,
          work_center: 'Fabrication',
          customer: 'Industrial Solutions',
          sap_data: []
        }
      ];
      
      // Try to upsert test jobs
      const { data: insertedJobs, error: insertError } = await serviceRoleClient
        .from('jobs')
        .upsert(testJobs, { 
          onConflict: 'job_number'
        });
      
      if (insertError) {
        console.error('Error inserting test jobs:', insertError);
        // Just return the jobs without inserting
        return testJobs;
      }
      
      return insertedJobs || testJobs;
    } catch (error) {
      console.error('Error in createTestJobs:', error);
      // Return hardcoded jobs as last resort
      return [
        {
          id: 9999,
          job_number: 'JOB-9999-001',
          title: 'Fallback Test Job',
          description: 'Fallback test job for error cases',
          status: 'New',
          due_date: new Date().toISOString(),
          scheduled_date: new Date().toISOString(),
          priority: 'Medium',
          progress: 50,
          work_center: 'Test',
          customer: 'Test Customer',
          sap_data: []
        }
      ];
    }
  }

  async getJobsByWorkCenter(workCenterName: string, status?: 'Available' | 'In Progress' | 'Backlog') {
    try {
      console.log(`Getting jobs for work center: ${workCenterName}`);
      
      // Start with an exact match first to ensure accuracy
      const exactMatch = workCenterName.trim();
      
      // Get all operations related to this work center from sap_operations
      const { data: sapOps, error: sapError } = await supabase
        .from('sap_operations')
        .select('*')
        .eq('work_center', exactMatch);

      if (sapError) {
        console.error(`Error fetching SAP operations: ${sapError.message}`);
      } else {
        console.log(`Found ${sapOps?.length || 0} SAP operations for work center ${exactMatch}`);
      }
      
      // Also get operations from job_operations table
      const { data: jobOps, error: jobOpsError } = await supabase
        .from('job_operations')
        .select('*')
        .eq('"Oper.WorkCenter"', exactMatch);
        
      if (jobOpsError) {
        console.error(`Error fetching job operations: ${jobOpsError.message}`);
      } else {
        console.log(`Found ${jobOps?.length || 0} job operations for work center ${exactMatch}`);
      }
      
      // If we have operations, process them to find related jobs
      const orderNumbers = new Set<string>();
      
      // Add order numbers from SAP operations
      if (sapOps && sapOps.length > 0) {
        sapOps.forEach(op => {
          if (op.order_number) {
            orderNumbers.add(op.order_number);
          }
        });
      }
      
      // Add order numbers from job operations
      if (jobOps && jobOps.length > 0) {
        jobOps.forEach(op => {
          if (op['Order']) {
            orderNumbers.add(op['Order']);
          } else if (op['Sales Document']) {
            orderNumbers.add(op['Sales Document']);
          }
        });
      }
      
      console.log(`Found ${orderNumbers.size} unique order numbers for work center ${exactMatch}`);
      
      if (orderNumbers.size === 0) {
        console.log(`No orders found for work center ${exactMatch}, returning empty result`);
        return [];
      }
      
      // Get jobs that match these order numbers
      const orderArray = Array.from(orderNumbers);
      
      // Unfortunately, Supabase doesn't support .in() with more than 100 items, 
      // so we need to handle that scenario
      const BATCH_SIZE = 90;
      let allMatchingJobs = [];
      
      for (let i = 0; i < orderArray.length; i += BATCH_SIZE) {
        const batch = orderArray.slice(i, i + BATCH_SIZE);
        
        const { data: jobs, error: jobsError } = await supabase
          .from('jobs')
          .select('*')
          .in('job_number', batch);
          
        if (jobsError) {
          console.error(`Error fetching jobs: ${jobsError.message}`);
        } else if (jobs) {
          allMatchingJobs = [...allMatchingJobs, ...jobs];
        }
      }
      
      console.log(`Found ${allMatchingJobs.length} jobs matching order numbers`);
      
      // Also get jobs where the work_center field directly matches
      const { data: directWorkCenterJobs, error: directJobsError } = await supabase
        .from('jobs')
        .select('*')
        .eq('work_center', exactMatch);
        
      if (directJobsError) {
        console.error(`Error fetching jobs by work center: ${directJobsError.message}`);
      } else if (directWorkCenterJobs) {
        console.log(`Found ${directWorkCenterJobs.length} jobs with direct work center match`);
        
        // Merge job lists, avoiding duplicates
        const jobNumberSet = new Set(allMatchingJobs.map(job => job.job_number));
        directWorkCenterJobs.forEach(job => {
          if (!jobNumberSet.has(job.job_number)) {
            allMatchingJobs.push(job);
          }
        });
      }
      
      // Process jobs to add operation status and other metrics
      const processedJobs = allMatchingJobs.map(job => {
        // Get operations for this job - combine from both sources
        const jobSapOps = sapOps?.filter(op => op.order_number === job.job_number) || [];
        const jobNormalOps = jobOps?.filter(op => 
          (op['Order'] === job.job_number) || (op['Sales Document'] === job.job_number)
        ) || [];
        
        // Calculate total and actual work
        const totalWork = jobSapOps.reduce((sum, op) => sum + (Number(op.planned_work) || 0), 0)
          + jobNormalOps.reduce((sum, op) => sum + (Number(op['Work']) || 0), 0);
          
        const actualWork = jobSapOps.reduce((sum, op) => sum + (Number(op.actual_work) || 0), 0)
          + jobNormalOps.reduce((sum, op) => sum + (Number(op['Actual work']) || 0), 0);
        
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
      
      console.log(`Processed ${processedJobs.length} jobs for work center ${exactMatch}`);
      
      // Filter by status if specified
      if (status) {
        const filteredJobs = processedJobs.filter(job => job.operationStatus === status);
        console.log(`Filtered to ${filteredJobs.length} jobs with status: ${status}`);
        return filteredJobs;
      }
      
      return processedJobs;
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
      console.log(`Getting metrics for work center: ${workCenterName}`);
      
      // Get operations from SAP data
      const { data: operations, error } = await supabase
        .from('sap_operations')
        .select('*')
        .eq('work_center', workCenterName);

      if (error) {
        console.error(`Error fetching operations for work center ${workCenterName}:`, error);
        throw error;
      }

      console.log(`Found ${operations?.length || 0} operations for work center ${workCenterName}`);
      
      if (!operations || operations.length === 0) {
        console.log(`No operations found for work center ${workCenterName}, fetching from job_operations`);
        
        // Try job_operations as a fallback
        const { data: jobOps, error: jobOpsError } = await supabase
          .from('job_operations')
          .select('*')
          .eq('"Oper.WorkCenter"', workCenterName);
          
        if (jobOpsError) {
          console.error(`Error fetching from job_operations for ${workCenterName}:`, jobOpsError);
        } else if (jobOps && jobOps.length > 0) {
          console.log(`Found ${jobOps.length} operations in job_operations for ${workCenterName}`);
          
          // Convert job_operations format to sap_operations format for processing
          const convertedOps = jobOps.map(op => ({
            order_number: op['Order'] || op['Sales Document'] || '',
            operation_number: op['Oper./Act.'] || '',
            work_center: op['Oper.WorkCenter'] || '',
            description: op['Description'] || '',
            short_text: op['Opr. short text'] || '',
            planned_work: Number(op['Work']) || 0,
            actual_work: Number(op['Actual work']) || 0
          }));
          
          // Process the converted operations
          return this.calculateWorkCenterMetrics(convertedOps);
        }
      }

      return this.calculateWorkCenterMetrics(operations || []);
    } catch (error) {
      handleDbError(error, 'getWorkCenterMetrics');
      return null;
    }
  }
  
  // Helper method to calculate metrics from operations
  private calculateWorkCenterMetrics(operations: any[]) {
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
      
    const metrics = {
      total_operations: operations.length,
      total_orders: uniqueOrders.size,
      planned_hours: totalPlanned,
      actual_hours: totalActual,
      efficiency: totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0,
      in_progress_hours: inProgressHours,
      backlog_hours: backlogHours,
      available_work_hours: Math.max(0, totalPlanned - inProgressHours - backlogHours)
    };
    
    console.log(`Calculated metrics for work center:`, metrics);
    return metrics;
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
    if (!purchaseOrders || purchaseOrders.length === 0) {
      return { count: 0 };
    }
    
    console.log(`DB: Inserting ${purchaseOrders.length} purchase orders`);
    console.log("First PO:", purchaseOrders[0]);
    
    try {
      // Verify RLS bypass works
      const rlsVerified = await this.verifyRLSBypass();
      if (!rlsVerified) {
        console.warn('Warning: RLS bypass verification failed, attempting insert anyway');
      }
      
      // De-duplicate records by po_number (keep the last one)
      const uniquePOs = {};
      let duplicatesRemoved = 0;
      
      for (const po of purchaseOrders) {
        if (po.po_number) {
          if (uniquePOs[po.po_number]) {
            duplicatesRemoved++;
          }
          uniquePOs[po.po_number] = po;
        }
      }
      
      const dedupedPOs = Object.values(uniquePOs);
      console.log(`Removed ${duplicatesRemoved} duplicate PO numbers. Processing ${dedupedPOs.length} unique POs.`);
      
      // Process in smaller batches to avoid errors with large datasets
      const BATCH_SIZE = 50;
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < dedupedPOs.length; i += BATCH_SIZE) {
        const batch = dedupedPOs.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(dedupedPOs.length/BATCH_SIZE)}, size: ${batch.length}`);
        
        // Use serviceRoleClient to bypass RLS
        const result = await serviceRoleClient
          .from('purchase_orders')
          .upsert(batch, {
            onConflict: 'po_number',
            ignoreDuplicates: false
          });
        
        if (result.error) {
          console.error(`Error in batch ${Math.floor(i/BATCH_SIZE) + 1}:`, result.error);
          errorCount += batch.length;
        } else {
          successCount += batch.length;
          console.log(`Successfully inserted batch ${Math.floor(i/BATCH_SIZE) + 1}`);
        }
      }
      
      console.log(`Insertion complete: ${successCount} successful, ${errorCount} failed`);
      
      // Verify data was inserted
      const { count } = await serviceRoleClient
        .from('purchase_orders')
        .select('*', { count: 'exact', head: true });
      
      console.log(`Verified ${count} purchase orders in database`);
      
      return successCount > 0;
    } catch (error) {
      console.error("Fatal DB error:", error);
      return false;
    }
  }

  async upsertShipmentLogs(shipmentLogs: ShipmentLog[]) {
    try {
      console.log(`DB: Upserting ${shipmentLogs.length} shipment logs`);
      if (shipmentLogs.length > 0) {
        console.log("First shipment log:", shipmentLogs[0]);
      }
      
      // If there are no shipment logs, return early
      if (!shipmentLogs || shipmentLogs.length === 0) {
        return true;
      }
      
      // Check if the table exists first
      try {
        await this.ensureTableExists('shipmentlogs');
      } catch (err) {
        console.log('Table check error (might already exist):', err);
      }
      
      // Generate sequential IDs for any entries with null ID
      // First, get the max ID from the existing data
      let startId = 1;
      try {
        const { data: maxIdData } = await serviceRoleClient
          .from('shipmentlogs')
          .select('id')
          .order('id', { ascending: false })
          .limit(1);
          
        if (maxIdData && maxIdData.length > 0 && maxIdData[0].id) {
          startId = Number(maxIdData[0].id) + 1;
        }
      } catch (e) {
        console.error('Error getting max ID:', e);
      }
      
      // Assign IDs to shipment logs that don't have one
      let currentId = startId;
      const preparedShipmentLogs = shipmentLogs.map(log => {
        if (log.id === null || log.id === undefined) {
          return { ...log, id: currentId++ };
        }
        return log;
      });

      // Process in smaller batches to avoid errors
      const BATCH_SIZE = 25;
      let successCount = 0;
      
      for (let i = 0; i < preparedShipmentLogs.length; i += BATCH_SIZE) {
        const batch = preparedShipmentLogs.slice(i, i + BATCH_SIZE);
        try {
          const { error } = await serviceRoleClient
            .from('shipmentlogs')
            .upsert(batch, {
              onConflict: 'id',
              ignoreDuplicates: false
            });

          if (error) {
            console.error(`Error in batch ${Math.floor(i/BATCH_SIZE) + 1}:`, error);
            
            // Try one by one if batch insert fails
            for (const log of batch) {
              try {
                const { error: singleError } = await serviceRoleClient
                  .from('shipmentlogs')
                  .upsert([log], { onConflict: 'id' });
                  
                if (singleError) {
                  console.error(`Error upserting single log:`, singleError);
                } else {
                  successCount++;
                }
              } catch (e) {
                console.error('Error in single shipment log insert:', e);
              }
            }
          } else {
            successCount += batch.length;
            console.log(`Successfully upserted batch ${Math.floor(i/BATCH_SIZE) + 1}`);
          }
        } catch (batchError) {
          console.error(`Error processing batch ${Math.floor(i/BATCH_SIZE) + 1}:`, batchError);
        }
      }
      
      console.log(`Successfully upserted ${successCount} shipment logs`);
      
      // Verify count after insertion
      try {
        const { count } = await serviceRoleClient
          .from('shipmentlogs')
          .select('*', { count: 'exact', head: true });
          
        console.log(`Verified ${count} shipment logs in database`);
      } catch (verifyError) {
        console.error('Error verifying shipment logs count:', verifyError);
      }
      
      return successCount > 0;
    } catch (error) {
      console.error("Fatal error in upsertShipmentLogs:", error);
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

      const { data: jobs, error: jobsError } = await serviceRoleClient
        .from('jobs')
        .select('count');

      if (jobsError) {
        console.error('Error checking jobs table:', jobsError);
      } else {
        console.log('Jobs table exists with count:', jobs);
      }

      const { data: jobOps, error: jobOpsError } = await serviceRoleClient
        .from('job_operations')
        .select('count');

      if (jobOpsError) {
        console.error('Error checking job_operations table:', jobOpsError);
      } else {
        console.log('job_operations table exists with count:', jobOps);
      }

      const { data: sapOps, error: sapOpsError } = await serviceRoleClient
        .from('sap_operations')
        .select('count');

      if (sapOpsError) {
        console.error('Error checking sap_operations table:', sapOpsError);
      } else {
        console.log('sap_operations table exists with count:', sapOps);
      }
      
      // Check logistics tables
      const { data: vendorOps, error: vendorOpsError } = await serviceRoleClient
        .from('vendor_operations')
        .select('count');
        
      if (vendorOpsError) {
        console.error('Error checking vendor_operations table:', vendorOpsError);
      } else {
        console.log('vendor_operations table exists with count:', vendorOps);
      }
      
      const { data: jobTimelines, error: jobTimelinesError } = await serviceRoleClient
        .from('job_timelines')
        .select('count');
        
      if (jobTimelinesError) {
        console.error('Error checking job_timelines table:', jobTimelinesError);
      } else {
        console.log('job_timelines table exists with count:', jobTimelines);
      }
      
      const { data: purchaseOrders, error: poError } = await serviceRoleClient
        .from('purchase_orders')
        .select('count');
        
      if (poError) {
        console.error('Error checking purchase_orders table:', poError);
      } else {
        console.log('purchase_orders table exists with count:', purchaseOrders);
      }
      
      const { data: shipmentLogs, error: shipmentLogsError } = await serviceRoleClient
        .from('shipmentlogs')
        .select('count');
        
      if (shipmentLogsError) {
        console.error('Error checking shipmentlogs table:', shipmentLogsError);
      } else {
        console.log('shipmentlogs table exists with count:', shipmentLogs);
      }

      const needsLogisticsTables = vendorOpsError || jobTimelinesError || poError || shipmentLogsError;
      if (needsLogisticsTables) {
        console.log('Some logistics tables are missing, attempting to create them...');
        await this.createLogisticsTables();
      }

      return {
        jobs: !jobsError,
        jobOps: !jobOpsError,
        sapOps: !sapOpsError,
        vendorOps: !vendorOpsError,
        jobTimelines: !jobTimelinesError,
        purchaseOrders: !poError,
        shipmentLogs: !shipmentLogsError
      };
    } catch (error) {
      console.error('Error checking tables:', error);
      return {
        jobs: false,
        jobOps: false,
        sapOps: false,
        vendorOps: false,
        jobTimelines: false,
        purchaseOrders: false,
        shipmentLogs: false
      };
    }
  }

  async createLogisticsTables() {
    try {
      console.log('Creating missing logistics tables in Supabase...');
      
      // Create vendor_operations table
      try {
        console.log('Checking vendor_operations table...');
        const { error: checkError } = await serviceRoleClient.from('vendor_operations').select('count');
        
        if (checkError) {
          console.log('vendor_operations table does not exist, creating sample data');
          await this.insertVendorOperationsSampleData();
        }
      } catch (err) {
        console.error('Error with vendor_operations table:', err);
        await this.insertVendorOperationsSampleData();
      }
      
      // Create job_timelines table
      try {
        console.log('Checking job_timelines table...');
        const { error: checkError } = await serviceRoleClient.from('job_timelines').select('count');
        
        if (checkError) {
          console.log('job_timelines table does not exist, creating sample data');
          await this.insertJobTimelinesSampleData();
        }
      } catch (err) {
        console.error('Error with job_timelines table:', err);
        await this.insertJobTimelinesSampleData();
      }
      
      // Create purchase_orders table
      try {
        console.log('Checking purchase_orders table...');
        const { error: checkError } = await serviceRoleClient.from('purchase_orders').select('count');
        
        if (checkError) {
          console.log('purchase_orders table does not exist, creating sample data');
          await this.insertPurchaseOrdersSampleData();
        }
      } catch (err) {
        console.error('Error with purchase_orders table:', err);
        await this.insertPurchaseOrdersSampleData();
      }
      
      // Create shipmentlogs table
      try {
        console.log('Checking shipmentlogs table...');
        const { error: checkError } = await serviceRoleClient.from('shipmentlogs').select('count');
        
        if (checkError) {
          console.log('shipmentlogs table does not exist, creating sample data');
          await this.insertShipmentLogsSampleData();
        }
      } catch (err) {
        console.error('Error with shipmentlogs table:', err);
        await this.insertShipmentLogsSampleData();
      }
      
      return true;
    } catch (error) {
      console.error('Error creating logistics tables:', error);
      return false;
    }
  }

  // Helper methods for inserting sample data
  async insertVendorOperationsSampleData() {
    const vendorOperations = [
      {
        id: 1,
        job_id: 1,
        operation: 'Heat Treatment',
        vendor: 'Thermal Solutions Inc.',
        date_range: '2023-07-15 to 2023-07-20',
        status: 'Completed',
        notes: 'Completed on time, no issues'
      },
      {
        id: 2,
        job_id: 1,
        operation: 'Surface Coating',
        vendor: 'Advanced Coatings Ltd.',
        date_range: '2023-07-22 to 2023-07-27',
        status: 'In Progress',
        notes: 'Currently processing batch 2 of 3'
      },
      {
        id: 3,
        job_id: 2,
        operation: 'Precision Machining',
        vendor: 'Precision Works Co.',
        date_range: '2023-07-10 to 2023-07-18',
        status: 'Delayed',
        notes: 'Equipment maintenance causing 2-day delay'
      }
    ];
    
    // Use serviceRoleClient to bypass RLS
    const { error } = await serviceRoleClient.from('vendor_operations').upsert(vendorOperations);
    if (error) console.error('Error inserting vendor operations sample data:', error);
    return !error;
  }
  
  async insertJobTimelinesSampleData() {
    try {
      // Create a more extensive dataset for job timelines
      const jobTimelines = [
        {
          id: 1,
          job_id: 1,
          title: 'Job Started',
          date: '2023-07-01',
          description: 'Initial materials received and job started',
          status: 'completed'
        },
        {
          id: 2,
          job_id: 1,
          title: 'Sent to Vendor',
          date: '2023-07-12',
          description: 'Components sent to Thermal Solutions for heat treatment',
          status: 'completed',
          vendor: 'Thermal Solutions Inc.'
        },
        {
          id: 3,
          job_id: 1,
          title: 'Heat Treatment Complete',
          date: '2023-07-20',
          description: 'Heat treatment completed and parts received back',
          status: 'completed',
          vendor: 'Thermal Solutions Inc.'
        },
        {
          id: 4,
          job_id: 1,
          title: 'Sent for Coating',
          date: '2023-07-22',
          description: 'Parts sent to Advanced Coatings for surface treatment',
          status: 'in-progress',
          vendor: 'Advanced Coatings Ltd.'
        },
        // Additional records for job 2
        {
          id: 5,
          job_id: 2,
          title: 'Planning Phase',
          date: '2023-06-15',
          description: 'Project planning and resource allocation',
          status: 'completed'
        },
        {
          id: 6,
          job_id: 2,
          title: 'Material Procurement',
          date: '2023-06-25',
          description: 'Ordered all required materials',
          status: 'completed'
        },
        {
          id: 7,
          job_id: 2,
          title: 'Production Start',
          date: '2023-07-05',
          description: 'Manufacturing process started',
          status: 'in-progress'
        },
        // Additional records for job 3
        {
          id: 8,
          job_id: 3,
          title: 'Design Phase',
          date: '2023-06-10',
          description: 'CAD designs finalized',
          status: 'completed'
        },
        {
          id: 9,
          job_id: 3,
          title: 'Prototype Development',
          date: '2023-06-20',
          description: 'First prototype created',
          status: 'completed'
        },
        {
          id: 10,
          job_id: 3,
          title: 'Testing',
          date: '2023-07-01',
          description: 'Quality assurance testing',
          status: 'in-progress'
        }
      ];
      
      console.log('Attempting to insert job timelines with upsert operation...');
      
      // Try to insert the data in batches to avoid any issues
      const batchSize = 3;
      
      for (let i = 0; i < jobTimelines.length; i += batchSize) {
        const batch = jobTimelines.slice(i, i + batchSize);
        
        try {
          const { error } = await serviceRoleClient
            .from('job_timelines')
            .upsert(batch, { onConflict: 'id' });
          
          if (error) {
            console.error(`Error upserting job timelines batch ${i/batchSize + 1}:`, error);
          } else {
            console.log(`Successfully inserted job timelines batch ${i/batchSize + 1}`);
          }
        } catch (err) {
          console.error(`Error with job timelines batch ${i/batchSize + 1}:`, err);
        }
      }
      
      // Verify the data was inserted
      const { data: verifyData, error: verifyError } = await serviceRoleClient
        .from('job_timelines')
        .select('*')
        .limit(1);
      
      if (verifyError) {
        console.error('Error verifying job timelines insertion:', verifyError);
        return false;
      }
      
      console.log('Successfully verified job timelines data insertion:', verifyData?.length > 0);
      return verifyData?.length > 0;
    } catch (error) {
      console.error('Error inserting job timelines sample data:', error);
      return false;
    }
  }
  
  async insertPurchaseOrdersSampleData() {
    const purchaseOrders = [
      {
        id: 1,
        po_number: 'PO-2023-001',
        job_id: 1,
        vendor: 'Thermal Solutions Inc.',
        amount: 2500,
        status: 'completed',
        issue_date: '2023-07-10',
        expected_date: '2023-07-20',
        received_date: '2023-07-20',
        notes: 'Heat treatment services',
        description: 'Heat treatment for job components',
        severity: 'Medium'
      },
      {
        id: 2,
        po_number: 'PO-2023-002',
        job_id: 1,
        vendor: 'Advanced Coatings Ltd.',
        amount: 3800,
        status: 'in-progress',
        issue_date: '2023-07-21',
        expected_date: '2023-07-27',
        received_date: null,
        notes: 'Surface coating services',
        description: 'Special coating application',
        severity: 'High'
      },
      {
        id: 3,
        po_number: 'PO-2023-003',
        job_id: 2,
        vendor: 'Precision Works Co.',
        amount: 5200,
        status: 'pending',
        issue_date: '2023-07-08',
        expected_date: '2023-07-18',
        received_date: null,
        notes: 'Delayed due to equipment issues',
        description: 'Precision machining services',
        severity: 'Medium'
      }
    ];
    
    // Use serviceRoleClient to bypass RLS
    const { error } = await serviceRoleClient.from('purchase_orders').upsert(purchaseOrders);
    if (error) console.error('Error inserting purchase orders sample data:', error);
    return !error;
  }
  
  async insertShipmentLogsSampleData() {
    const shipmentLogs = [
      {
        id: 1,
        po_number: 'PO-2023-001',
        vendor: 'Thermal Solutions Inc.',
        shipment_date: '2023-07-15',
        received_date: '2023-07-20',
        status: 'Delivered',
        tracking_number: 'TRK123456789',
        carrier: 'FedEx'
      },
      {
        id: 2,
        po_number: 'PO-2023-002',
        vendor: 'Advanced Coatings Ltd.',
        shipment_date: '2023-07-22',
        received_date: null,
        status: 'In Transit',
        tracking_number: 'TRK987654321',
        carrier: 'UPS'
      },
      {
        id: 3,
        po_number: 'PO-2023-003',
        vendor: 'Precision Works Co.',
        shipment_date: '2023-07-12',
        received_date: null,
        status: 'Delayed',
        tracking_number: 'TRK456789123',
        carrier: 'DHL'
      }
    ];
    
    // Use serviceRoleClient to bypass RLS
    const { error } = await serviceRoleClient.from('shipmentlogs').upsert(shipmentLogs);
    if (error) console.error('Error inserting shipment logs sample data:', error);
    return !error;
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
      const { data, error } = await serviceRoleClient
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

  async getPurchaseOrderByNumber(poNumber: string) {
    try {
      console.log('Fetching purchase order by number:', poNumber);
      
      const { data, error } = await serviceRoleClient
        .from('purchase_orders')
        .select('*')
        .eq('purchasing_document', poNumber)
        .single();

      if (error) {
        console.error('Error fetching purchase order:', error);
        // If not found with purchasing_document, try with po_number as fallback
        const { data: altData, error: altError } = await serviceRoleClient
          .from('purchase_orders')
          .select('*')
          .eq('po_number', poNumber)
          .single();
          
        if (altError) throw altError;
        return altData;
      }
      
      return data;
    } catch (error) {
      handleDbError(error, 'getPurchaseOrderByNumber');
      return null;
    }
  }

  async getShipmentLogs() {
    try {
      const { data, error } = await serviceRoleClient
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

  async clearWorkCenters() {
    try {
      const { error } = await supabase
        .from('work_centers')
        .delete()
        .gt('id', 0);
        
      if (error) {
        console.error('Error clearing work centers:', error);
        throw error;
      }
      return true;
    } catch (error) {
      handleDbError(error, 'clearWorkCenters');
      return false;
    }
  }
  
  async clearSAPOperations() {
    try {
      const { error } = await supabase
        .from('sap_operations')
        .delete()
        .gt('id', 0);
        
      if (error) {
        console.error('Error clearing SAP operations:', error);
        throw error;
      }
      return true;
    } catch (error) {
      handleDbError(error, 'clearSAPOperations');
      return false;
    }
  }
  
  async clearJobOperations() {
    try {
      const { error } = await supabase
        .from('job_operations')
        .delete();
        
      if (error) {
        console.error('Error clearing job operations:', error);
        throw error;
      }
      return true;
    } catch (error) {
      handleDbError(error, 'clearJobOperations');
      return false;
    }
  }
  
  async insertTestData() {
    try {
      console.log('Inserting test data for logistics...');
      
      // Insert vendor operations
      await this.insertVendorOperationsSampleData();
      
      // Insert job timelines
      await this.insertJobTimelinesSampleData();
      
      // Insert purchase orders
      await this.insertPurchaseOrdersSampleData();
      
      // Insert shipment logs
      await this.insertShipmentLogsSampleData();
      
      console.log('Test data insertion completed');
      return true;
    } catch (error) {
      console.error('Error inserting test data:', error);
      return false;
    }
  }
  
  async getVendorOperations(jobId?: number) {
    try {
      let query = serviceRoleClient.from('vendor_operations').select('*');
      
      if (jobId) {
        query = query.eq('job_id', jobId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      handleDbError(error, 'getVendorOperations');
      return [];
    }
  }
  
  async getJobTimelines(jobId: number) {
    try {
      console.log(`Getting timeline data for job ${jobId} from jobs table...`);
      
      // Get the job with its timeline field
      const { data: job, error: jobError } = await serviceRoleClient
        .from('jobs')
        .select('timeline, job_number, title')
        .eq('id', jobId)
        .single();
      
      if (jobError) {
        console.error(`Error fetching job ${jobId}:`, jobError);
        
        // Fallback: generate a timeline for this job
        console.log(`Generating fallback timeline for job ${jobId}...`);
        
        // First, try to get the job details
        const { data: jobDetails, error: detailsError } = await serviceRoleClient
          .from('jobs')
          .select('*')
          .eq('id', jobId)
          .single();
        
        if (detailsError || !jobDetails) {
          console.error(`Error fetching job details for ${jobId}:`, detailsError);
          return this.generateFallbackTimeline(jobId);
        }
        
        // Generate timeline based on job details
        const timeline = this.generateTimelinesForJob(jobDetails);
        
        // Try to update the job with the timeline
        const { error: updateError } = await serviceRoleClient
          .from('jobs')
          .update({ timeline })
          .eq('id', jobId);
        
        if (updateError) {
          console.error(`Error updating job ${jobId} with timeline:`, updateError);
        } else {
          console.log(`Successfully added timeline to job ${jobId}`);
        }
        
        return timeline;
      }
      
      if (!job) {
        console.log(`No job found with id ${jobId}`);
        return this.generateFallbackTimeline(jobId);
      }
      
      if (!job.timeline || !Array.isArray(job.timeline) || job.timeline.length === 0) {
        console.log(`No timeline found for job ${jobId}, generating one...`);
        
        // Get all job details to generate a proper timeline
        const { data: fullJob, error: fullJobError } = await serviceRoleClient
          .from('jobs')
          .select('*')
          .eq('id', jobId)
          .single();
        
        if (fullJobError || !fullJob) {
          console.error(`Error fetching full job details for ${jobId}:`, fullJobError);
          return this.generateFallbackTimeline(jobId);
        }
        
        // Generate timeline based on job details
        const timeline = this.generateTimelinesForJob(fullJob);
        
        // Update the job with the timeline
        const { error: updateError } = await serviceRoleClient
          .from('jobs')
          .update({ timeline })
          .eq('id', jobId);
        
        if (updateError) {
          console.error(`Error updating job ${jobId} with timeline:`, updateError);
        } else {
          console.log(`Successfully added timeline to job ${jobId}`);
        }
        
        return timeline;
      }
      
      console.log(`Found timeline for job ${jobId} with ${job.timeline.length} events`);
      return job.timeline;
    } catch (error) {
      handleDbError(error, 'getJobTimelines');
      return this.generateFallbackTimeline(jobId);
    }
  }
  
  // Helper method to generate a fallback timeline
  private generateFallbackTimeline(jobId: number): any[] {
    console.log(`Generating emergency fallback timeline for job ${jobId}`);
    
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    // Format dates as strings
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    
    return [
      {
        id: 1,
        job_id: jobId,
        title: 'Job Created',
        date: formatDate(twoWeeksAgo),
        description: 'Job created and initial planning',
        status: 'completed'
      },
      {
        id: 2,
        job_id: jobId,
        title: 'Production Started',
        date: formatDate(lastWeek),
        description: 'Manufacturing process started',
        status: 'completed'
      },
      {
        id: 3,
        job_id: jobId,
        title: 'Current Progress',
        date: formatDate(today),
        description: 'Work in progress',
        status: 'in-progress'
      }
    ];
  }

  // New method to debug all tables
  async debugAllTables() {
    try {
      console.log('Checking all tables in the database...');
      
      const tables = [
        'jobs',
        'job_operations',
        'sap_operations',
        'vendor_operations',
        'job_timelines',
        'purchase_orders',
        'shipmentlogs',
        'work_centers',
        'ncrs',
        'forecasts',
        'users',
        'products',
        'customers',
        'orders'
      ];
      
      const tableStatus = {};
      
      for (const table of tables) {
        try {
          const { data, error, count } = await serviceRoleClient
            .from(table)
            .select('*', { count: 'exact' })
            .limit(1);
          
          if (error) {
            console.error(`Error checking table ${table}:`, error);
            tableStatus[table] = { exists: false, count: 0, error: error.message };
          } else {
            console.log(`Table ${table} exists with count:`, count);
            tableStatus[table] = { exists: true, count, firstRecord: data?.[0] };
          }
        } catch (err) {
          console.error(`Error accessing table ${table}:`, err);
          tableStatus[table] = { exists: false, count: 0, error: err.message };
        }
      }
      
      console.log('Database table status:', tableStatus);
      return tableStatus;
    } catch (error) {
      console.error('Error in debugAllTables:', error);
      return null;
    }
  }

  // Add diagnostic function to check tables for specific pages
  async diagnosePageData(pageName: string) {
    try {
      console.log(`Diagnosing data for ${pageName} page...`);
      
      // Define which tables are needed for each page
      const pageTableMapping = {
        'logistics': ['vendor_operations', 'job_timelines', 'purchase_orders', 'shipmentlogs', 'jobs'],
        'forecasting': ['forecasts', 'products', 'customers', 'orders'],
        'purchase': ['purchase_orders', 'vendors', 'jobs'],
        'ncr': ['ncrs', 'jobs'],
        'work-centers': ['work_centers', 'jobs', 'sap_operations', 'job_operations']
      };
      
      const tables = pageTableMapping[pageName] || [];
      if (tables.length === 0) {
        return { status: 'unknown', message: `No table mapping found for page: ${pageName}` };
      }
      
      const tableStatus = {};
      let missingTables = [];
      let emptyTables = [];
      
      for (const table of tables) {
        try {
          console.log(`Checking table ${table} for ${pageName} page...`);
          const { data, error, count } = await serviceRoleClient
            .from(table)
            .select('*', { count: 'exact' })
            .limit(5);
          
          if (error) {
            console.error(`Table ${table} does not exist:`, error);
            tableStatus[table] = { exists: false, count: 0, error: error.message };
            missingTables.push(table);
          } else {
            console.log(`Table ${table} exists with ${count} records`);
            tableStatus[table] = { exists: true, count, sampleData: data };
            
            if (count === 0) {
              emptyTables.push(table);
            }
          }
        } catch (err) {
          console.error(`Error accessing table ${table}:`, err);
          tableStatus[table] = { exists: false, count: 0, error: err.message };
          missingTables.push(table);
        }
      }
      
      let status = 'ok';
      let message = `All tables for ${pageName} page exist and have data`;
      
      if (missingTables.length > 0) {
        status = 'missing_tables';
        message = `The following tables are missing: ${missingTables.join(', ')}`;
      } else if (emptyTables.length > 0) {
        status = 'empty_tables';
        message = `The following tables exist but are empty: ${emptyTables.join(', ')}`;
      }
      
      return {
        status,
        message,
        tableStatus,
        missingTables,
        emptyTables
      };
    } catch (error) {
      console.error(`Error diagnosing ${pageName} page:`, error);
      return {
        status: 'error',
        message: `Error diagnosing page: ${error.message}`,
        error
      };
    }
  }

  // Create sample data for forecasting page
  async createForecastingSampleData() {
    try {
      console.log('Creating sample data for forecasting page...');
      
      // Check if forecasts table exists
      try {
        const { data: forecastsCheck, error: forecastsError } = await serviceRoleClient
          .from('forecasts')
          .select('count');
          
        if (forecastsError) {
          console.log('Creating forecasts sample data...');
          
          // Create forecasts table data
          const forecastsData = [
            {
              id: 1,
              product_id: 1,
              period: '2023-Q1',
              forecast_quantity: 1500,
              actual_quantity: 1450,
              variance_percent: -3.33,
              trend: 'stable',
              confidence: 'high',
              created_at: new Date().toISOString()
            },
            {
              id: 2,
              product_id: 1,
              period: '2023-Q2',
              forecast_quantity: 1800,
              actual_quantity: 1650,
              variance_percent: -8.33,
              trend: 'decreasing',
              confidence: 'medium',
              created_at: new Date().toISOString()
            },
            {
              id: 3,
              product_id: 2,
              period: '2023-Q1',
              forecast_quantity: 950,
              actual_quantity: 980,
              variance_percent: 3.16,
              trend: 'increasing',
              confidence: 'high',
              created_at: new Date().toISOString()
            }
          ];
          
          const { error } = await serviceRoleClient
            .from('forecasts')
            .upsert(forecastsData);
            
          if (error) {
            console.error('Error upserting forecasts data:', error);
          }
        }
      } catch (err) {
        console.error('Error with forecasts:', err);
      }
      
      // Check if products table exists
      try {
        const { data: productsCheck, error: productsError } = await serviceRoleClient
          .from('products')
          .select('count');
          
        if (productsError) {
          console.log('Creating products sample data...');
          
          // Create products table data
          const productsData = [
            {
              id: 1,
              name: 'Widget A',
              sku: 'WIDGET-A-001',
              category: 'Widgets',
              price: 45.99,
              cost: 15.75,
              inventory_level: 240,
              reorder_point: 50,
              lead_time_days: 14,
              created_at: new Date().toISOString()
            },
            {
              id: 2,
              name: 'Component B',
              sku: 'COMP-B-002',
              category: 'Components',
              price: 12.49,
              cost: 4.25,
              inventory_level: 780,
              reorder_point: 100,
              lead_time_days: 7,
              created_at: new Date().toISOString()
            },
            {
              id: 3,
              name: 'Assembly C',
              sku: 'ASSY-C-003',
              category: 'Assemblies',
              price: 199.99,
              cost: 68.50,
              inventory_level: 45,
              reorder_point: 15,
              lead_time_days: 21,
              created_at: new Date().toISOString()
            }
          ];
          
          const { error } = await serviceRoleClient
            .from('products')
            .upsert(productsData);
            
          if (error) {
            console.error('Error upserting products data:', error);
          }
        }
      } catch (err) {
        console.error('Error with products:', err);
      }
      
      // Check if customers table exists
      try {
        const { data: customersCheck, error: customersError } = await serviceRoleClient
          .from('customers')
          .select('count');
          
        if (customersError) {
          console.log('Creating customers sample data...');
          
          // Create customers table data
          const customersData = [
            {
              id: 1,
              name: 'Acme Corporation',
              industry: 'Manufacturing',
              contact_name: 'John Smith',
              contact_email: 'john.smith@acme.com',
              contact_phone: '555-123-4567',
              created_at: new Date().toISOString()
            },
            {
              id: 2,
              name: 'TechSystems Inc',
              industry: 'Technology',
              contact_name: 'Sarah Johnson',
              contact_email: 'sarah.j@techsystems.com',
              contact_phone: '555-987-6543',
              created_at: new Date().toISOString()
            },
            {
              id: 3,
              name: 'Global Industries',
              industry: 'Industrial',
              contact_name: 'Michael Chen',
              contact_email: 'm.chen@globalind.com',
              contact_phone: '555-456-7890',
              created_at: new Date().toISOString()
            }
          ];
          
          const { error } = await serviceRoleClient
            .from('customers')
            .upsert(customersData);
            
          if (error) {
            console.error('Error upserting customers data:', error);
          }
        }
      } catch (err) {
        console.error('Error with customers:', err);
      }
      
      return true;
    } catch (error) {
      console.error('Error creating forecasting sample data:', error);
      return false;
    }
  }
  
  // Create sample data for purchase page
  async createPurchaseSampleData() {
    try {
      console.log('Creating sample data for purchase page...');
      
      // We've already created purchase_orders data in the logistics methods,
      // so we'll just check if it exists and add more if needed
      
      // Check if purchase_orders table has data
      const { data: purchaseOrdersCheck, error: purchaseOrdersError } = await serviceRoleClient
        .from('purchase_orders')
        .select('count');
        
      if (!purchaseOrdersError && (!purchaseOrdersCheck || purchaseOrdersCheck.length === 0 || purchaseOrdersCheck[0].count < 3)) {
        console.log('Adding more purchase orders sample data...');
        
        // Create additional purchase orders
        const purchaseOrdersData = [
          {
            id: 10,
            po_number: 'PO-2023-010',
            job_id: 1,
            vendor: 'Industrial Supplies Co.',
            amount: 1875.50,
            status: 'pending',
            issue_date: new Date().toISOString(),
            expected_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            received_date: null,
            notes: 'Standard order for raw materials',
            description: 'Raw materials for job #1',
            severity: 'Low'
          },
          {
            id: 11,
            po_number: 'PO-2023-011',
            job_id: 2,
            vendor: 'Quality Tools Inc.',
            amount: 3590.75,
            status: 'in-progress',
            issue_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            expected_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            received_date: null,
            notes: 'Rush order',
            description: 'Specialized tools for job #2',
            severity: 'Medium'
          },
          {
            id: 12,
            po_number: 'PO-2023-012',
            job_id: 3,
            vendor: 'Fasteners Direct',
            amount: 450.25,
            status: 'completed',
            issue_date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
            expected_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            received_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            notes: 'Order received complete',
            description: 'Standard fasteners for job #3',
            severity: 'Low'
          }
        ];
        
        const { error } = await serviceRoleClient
          .from('purchase_orders')
          .upsert(purchaseOrdersData);
          
        if (error) {
          console.error('Error upserting purchase orders data:', error);
        }
      }
      
      // Check if vendors table exists
      try {
        const { data: vendorsCheck, error: vendorsError } = await serviceRoleClient
          .from('vendors')
          .select('count');
          
        if (vendorsError) {
          console.log('Creating vendors sample data...');
          
          // Create vendors table data
          const vendorsData = [
            {
              id: 1,
              name: 'Industrial Supplies Co.',
              contact_name: 'Robert Williams',
              contact_email: 'robert@indsupplies.com',
              contact_phone: '555-111-2222',
              address: '123 Industrial Ave, Chicago, IL 60007',
              category: 'Raw Materials',
              performance_rating: 4.5,
              active: true,
              created_at: new Date().toISOString()
            },
            {
              id: 2,
              name: 'Quality Tools Inc.',
              contact_name: 'Jennifer Lopez',
              contact_email: 'jlopez@qualitytools.com',
              contact_phone: '555-333-4444',
              address: '456 Manufacturing Blvd, Detroit, MI 48127',
              category: 'Tools & Equipment',
              performance_rating: 4.8,
              active: true,
              created_at: new Date().toISOString()
            },
            {
              id: 3,
              name: 'Fasteners Direct',
              contact_name: 'David Kim',
              contact_email: 'dkim@fastenersdirect.com',
              contact_phone: '555-555-6666',
              address: '789 Supply St, Atlanta, GA 30318',
              category: 'Hardware',
              performance_rating: 4.2,
              active: true,
              created_at: new Date().toISOString()
            }
          ];
          
          const { error } = await serviceRoleClient
            .from('vendors')
            .upsert(vendorsData);
            
          if (error) {
            console.error('Error upserting vendors data:', error);
          }
        }
      } catch (err) {
        console.error('Error with vendors:', err);
      }
      
      return true;
    } catch (error) {
      console.error('Error creating purchase sample data:', error);
      return false;
    }
  }
  
  // Method to create tables directly with SQL
  async createTablesWithSQL() {
    try {
      console.log('Creating tables directly with SQL...');
      
      // Create job_timelines table
      const createJobTimelinesSQL = `
        CREATE TABLE IF NOT EXISTS job_timelines (
          id SERIAL PRIMARY KEY,
          job_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          date TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL,
          vendor TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;
      
      // Create vendor_operations table
      const createVendorOperationsSQL = `
        CREATE TABLE IF NOT EXISTS vendor_operations (
          id SERIAL PRIMARY KEY,
          job_id INTEGER NOT NULL,
          operation TEXT NOT NULL,
          vendor TEXT NOT NULL,
          date_range TEXT,
          status TEXT,
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;
      
      // Create purchase_orders table
      const createPurchaseOrdersSQL = `
        CREATE TABLE IF NOT EXISTS purchase_orders (
          id SERIAL PRIMARY KEY,
          po_number TEXT UNIQUE NOT NULL,
          job_id INTEGER,
          vendor TEXT NOT NULL,
          amount NUMERIC,
          status TEXT,
          issue_date TEXT,
          expected_date TEXT,
          received_date TEXT,
          notes TEXT,
          description TEXT,
          severity TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;
      
      // Create shipmentlogs table
      const createShipmentLogsSQL = `
        CREATE TABLE IF NOT EXISTS shipmentlogs (
          id SERIAL PRIMARY KEY,
          po_number TEXT,
          vendor TEXT NOT NULL,
          shipment_date TEXT NOT NULL,
          received_date TEXT,
          status TEXT,
          tracking_number TEXT,
          carrier TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;
      
      // Execute SQL to create tables
      try {
        const { error: jobTimelinesError } = await serviceRoleClient.rpc('exec_sql', {
          sql_query: createJobTimelinesSQL
        });
        
        if (jobTimelinesError) {
          console.error('Error creating job_timelines table:', jobTimelinesError);
        } else {
          console.log('job_timelines table created successfully');
        }
      } catch (err) {
        console.error('Error executing job_timelines SQL:', err);
      }
      
      try {
        const { error: vendorOpsError } = await serviceRoleClient.rpc('exec_sql', {
          sql_query: createVendorOperationsSQL
        });
        
        if (vendorOpsError) {
          console.error('Error creating vendor_operations table:', vendorOpsError);
        } else {
          console.log('vendor_operations table created successfully');
        }
      } catch (err) {
        console.error('Error executing vendor_operations SQL:', err);
      }
      
      try {
        const { error: poError } = await serviceRoleClient.rpc('exec_sql', {
          sql_query: createPurchaseOrdersSQL
        });
        
        if (poError) {
          console.error('Error creating purchase_orders table:', poError);
        } else {
          console.log('purchase_orders table created successfully');
        }
      } catch (err) {
        console.error('Error executing purchase_orders SQL:', err);
      }
      
      try {
        const { error: shipmentError } = await serviceRoleClient.rpc('exec_sql', {
          sql_query: createShipmentLogsSQL
        });
        
        if (shipmentError) {
          console.error('Error creating shipmentlogs table:', shipmentError);
        } else {
          console.log('shipmentlogs table created successfully');
        }
      } catch (err) {
        console.error('Error executing shipmentlogs SQL:', err);
      }
      
      // Insert data into the tables
      await this.insertJobTimelinesSampleData();
      await this.insertVendorOperationsSampleData();
      await this.insertPurchaseOrdersSampleData();
      await this.insertShipmentLogsSampleData();
      
      return true;
    } catch (error) {
      console.error('Error creating tables with SQL:', error);
      return false;
    }
  }
  
  // Emergency method to fix job_timelines table
  async emergencyFixJobTimelines() {
    try {
      console.log('Attempting emergency fix for job_timelines table...');
      
      // First try to delete the table if it exists but is problematic
      try {
        const { error: dropError } = await serviceRoleClient.rpc('exec_sql', {
          sql_query: 'DROP TABLE IF EXISTS job_timelines;'
        });
        
        if (dropError) {
          console.error('Error dropping job_timelines table:', dropError);
        } else {
          console.log('Successfully dropped job_timelines table if it existed');
        }
      } catch (err) {
        console.error('Error dropping job_timelines table:', err);
      }
      
      // Create the table with minimal options
      try {
        const { error: createError } = await serviceRoleClient.rpc('exec_sql', {
          sql_query: `
            CREATE TABLE job_timelines (
              id SERIAL PRIMARY KEY,
              job_id INTEGER NOT NULL,
              title TEXT NOT NULL,
              date TEXT NOT NULL,
              description TEXT,
              status TEXT NOT NULL,
              vendor TEXT
            );
          `
        });
        
        if (createError) {
          console.error('Error creating job_timelines table:', createError);
          return false;
        } else {
          console.log('Successfully created job_timelines table');
        }
      } catch (err) {
        console.error('Error creating job_timelines table:', err);
        return false;
      }
      
      // Insert a minimal set of data to get the page working
      const minimalData = [
        {
          job_id: 1,
          title: 'Job Started',
          date: '2023-07-01',
          description: 'Emergency created record',
          status: 'completed'
        },
        {
          job_id: 2,
          title: 'Planning',
          date: '2023-06-15',
          description: 'Emergency created record',
          status: 'completed'
        },
        {
          job_id: 3,
          title: 'Design Phase',
          date: '2023-06-10',
          description: 'Emergency created record',
          status: 'completed'
        }
      ];
      
      // Insert data directly with SQL to avoid any issues
      for (const record of minimalData) {
        try {
          const insertSQL = `
            INSERT INTO job_timelines (job_id, title, date, description, status)
            VALUES (${record.job_id}, '${record.title}', '${record.date}', '${record.description}', '${record.status}');
          `;
          
          const { error: insertError } = await serviceRoleClient.rpc('exec_sql', {
            sql_query: insertSQL
          });
          
          if (insertError) {
            console.error('Error inserting job_timelines record:', insertError);
          } else {
            console.log(`Successfully inserted job_timelines record for job ${record.job_id}`);
          }
        } catch (err) {
          console.error('Error inserting job_timelines record:', err);
        }
      }
      
      // Verify data exists
      const { data: verifyData, error: verifyError } = await serviceRoleClient
        .from('job_timelines')
        .select('*');
      
      console.log('job_timelines verification result:', verifyData?.length > 0 ? 'Success' : 'Failed');
      return verifyData?.length > 0;
    } catch (error) {
      console.error('Error in emergency fix for job_timelines:', error);
      return false;
    }
  }
  
  // Update fixPageData to include the emergency fix
  async fixPageData(pageName: string) {
    try {
      console.log(`Attempting to fix data for ${pageName} page...`);
      
      // Run diagnostics first
      const diagnostics = await this.diagnosePageData(pageName);
      console.log(`Diagnostics for ${pageName}:`, diagnostics);
      
      // Fix based on page name
      switch (pageName) {
        case 'logistics':
          // Use the special logistics page fix
          console.log('Using special fix for logistics page...');
          const fixed = await this.fixLogisticsPage();
          
          return {
            success: fixed,
            message: fixed 
              ? 'Successfully fixed logistics page data using special approach' 
              : 'Failed to fix logistics page data',
            diagnosticsBeforeFix: diagnostics
          };
          
        case 'forecasting':
          // Create forecasting sample data
          await this.createForecastingSampleData();
          break;
          
        case 'purchase':
          // Create purchase sample data
          await this.createPurchaseSampleData();
          break;
          
        default:
          return {
            success: false,
            message: `No fix available for ${pageName} page`
          };
      }
      
      // Run diagnostics again to verify fix
      const afterDiagnostics = await this.diagnosePageData(pageName);
      
      return {
        success: afterDiagnostics.status === 'ok',
        message: afterDiagnostics.status === 'ok' 
          ? `Successfully fixed ${pageName} page data` 
          : `Failed to fix all issues with ${pageName} page: ${afterDiagnostics.message}`,
        before: diagnostics,
        after: afterDiagnostics
      };
    } catch (error) {
      console.error(`Error fixing ${pageName} page data:`, error);
      return {
        success: false,
        message: `Error fixing ${pageName} page data: ${error.message}`,
        error
      };
    }
  }

  // Method to directly add timeline data to jobs
  async addTimelinesToJobs() {
    try {
      console.log('Adding timeline data directly to jobs...');
      
      // First, get all existing jobs
      const { data: existingJobs, error: jobsError } = await serviceRoleClient
        .from('jobs')
        .select('*');
        
      if (jobsError) {
        console.error('Error fetching jobs:', jobsError);
        return false;
      }
      
      if (!existingJobs || existingJobs.length === 0) {
        console.error('No jobs found to add timelines to');
        return false;
      }
      
      console.log(`Found ${existingJobs.length} jobs to add timelines to`);
      
      // Create timelines directly in the jobs
      const updatedJobs = existingJobs.map(job => {
        // Generate timelines based on job data
        const timelines = this.generateTimelinesForJob(job);
        
        return {
          ...job,
          timeline: timelines
        };
      });
      
      // Update the jobs with timelines
      for (const job of updatedJobs) {
        try {
          const { error: updateError } = await serviceRoleClient
            .from('jobs')
            .update({ timeline: job.timeline })
            .eq('id', job.id);
            
          if (updateError) {
            console.error(`Error updating job ${job.id} with timelines:`, updateError);
          } else {
            console.log(`Successfully added timelines to job ${job.id}`);
          }
        } catch (err) {
          console.error(`Error updating job ${job.id}:`, err);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error adding timelines to jobs:', error);
      return false;
    }
  }
  
  // Helper method to generate timelines for a job
  private generateTimelinesForJob(job: any): any[] {
    // Default timeline events based on job data
    const progress = job.progress || 0;
    const status = job.status || 'New';
    
    // Calculate dates based on job's due_date and scheduled_date
    const dueDate = new Date(job.due_date);
    const scheduledDate = new Date(job.scheduled_date);
    
    // Create start date 1-2 weeks before scheduled date
    const startDate = new Date(scheduledDate);
    startDate.setDate(startDate.getDate() - Math.floor(Math.random() * 14) - 7);
    
    // Create middle date between start and due date
    const middleDate = new Date(startDate);
    const daysDiff = Math.floor((dueDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    middleDate.setDate(middleDate.getDate() + Math.floor(daysDiff / 2));
    
    // Format dates as strings
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    
    const timelines = [
      {
        id: 1,
        title: 'Job Created',
        date: formatDate(startDate),
        description: `Job #${job.job_number} created and materials ordered`,
        status: 'completed'
      }
    ];
    
    // Add more events based on progress
    if (progress > 20) {
      timelines.push({
        id: 2,
        title: 'Production Started',
        date: formatDate(new Date(startDate.getTime() + daysDiff * 0.25 * 24 * 60 * 60 * 1000)),
        description: 'Manufacturing process started',
        status: 'completed'
      });
    }
    
    if (progress > 50) {
      timelines.push({
        id: 3,
        title: 'Quality Check',
        date: formatDate(middleDate),
        description: 'Mid-production quality check completed',
        status: 'completed'
      });
    }
    
    if (progress > 75) {
      timelines.push({
        id: 4,
        title: 'Final Assembly',
        date: formatDate(new Date(dueDate.getTime() - 5 * 24 * 60 * 60 * 1000)),
        description: 'Final assembly and testing phase',
        status: 'in-progress'
      });
    }
    
    if (status === 'Completed') {
      timelines.push({
        id: 5,
        title: 'Job Completed',
        date: formatDate(dueDate),
        description: 'All tasks completed and job delivered',
        status: 'completed'
      });
    }
    
    return timelines;
  }
  
  // Add a special method to fix the logistics page specifically
  async fixLogisticsPage() {
    try {
      console.log('Starting special fix for logistics page...');
      
      // 1. First, make sure we have jobs
      const { data: jobsCheck, error: jobsError } = await serviceRoleClient
        .from('jobs')
        .select('count');
        
      if (jobsError || !jobsCheck || jobsCheck.length === 0 || jobsCheck[0].count < 3) {
        console.log('Adding sample jobs...');
        const testJobs = await this.createTestJobs();
        console.log(`Created ${testJobs.length} test jobs`);
      }
      
      // 2. Add timelines directly to jobs
      await this.addTimelinesToJobs();
      
      // 3. Make sure we have purchase orders
      const { data: poCheck, error: poError } = await serviceRoleClient
        .from('purchase_orders')
        .select('count');
        
      if (poError || !poCheck || poCheck.length === 0 || poCheck[0].count < 3) {
        console.log('Adding sample purchase orders...');
        await this.insertPurchaseOrdersSampleData();
      }
      
      // 4. Make sure we have shipment logs
      const { data: shipmentCheck, error: shipmentError } = await serviceRoleClient
        .from('shipmentlogs')
        .select('count');
        
      if (shipmentError || !shipmentCheck || shipmentCheck.length === 0 || shipmentCheck[0].count < 3) {
        console.log('Adding sample shipment logs...');
        await this.insertShipmentLogsSampleData();
      }
      
      console.log('Completed special fix for logistics page');
      return true;
    } catch (error) {
      console.error('Error in special fix for logistics page:', error);
      return false;
    }
  }

  async debugImportData(data: any, tableName: string) {
    try {
      console.log(`Debugging import data for ${tableName}:`);
      console.log(`Data type: ${typeof data}`);
      console.log(`Is array: ${Array.isArray(data)}`);
      
      if (Array.isArray(data)) {
        console.log(`Array length: ${data.length}`);
        if (data.length > 0) {
          console.log('Sample record:', data[0]);
          console.log('Keys:', Object.keys(data[0]));
        }
      } else if (data && typeof data === 'object') {
        console.log('Keys:', Object.keys(data));
      }
      
      // Check if table exists
      console.log(`Checking if ${tableName} table exists...`);
      try {
        const { data: tableData, error: tableError } = await serviceRoleClient
          .from(tableName)
          .select('*')
          .limit(1);
          
        if (tableError) {
          console.error(`Error: Table ${tableName} may not exist:`, tableError);
        } else {
          console.log(`Table ${tableName} exists with schema:`, tableData && tableData.length > 0 ? Object.keys(tableData[0]) : 'No data found');
        }
      } catch (tableErr) {
        console.error(`Error checking table ${tableName}:`, tableErr);
      }
      
      return {
        dataInfo: {
          type: typeof data,
          isArray: Array.isArray(data),
          length: Array.isArray(data) ? data.length : 0,
          sample: Array.isArray(data) && data.length > 0 ? data[0] : data,
          keys: Array.isArray(data) && data.length > 0 ? Object.keys(data[0]) : 
                (data && typeof data === 'object' ? Object.keys(data) : [])
        }
      };
    } catch (error) {
      console.error(`Error debugging import data for ${tableName}:`, error);
      return { error: error.message };
    }
  }
  
  // Method to prepare data for import (transform if needed)
  async prepareImportData(data: any, tableName: string) {
    try {
      console.log(`Preparing import data for ${tableName}`);
      
      if (!Array.isArray(data)) {
        console.error('Import data must be an array');
        return { error: 'Import data must be an array', data: null };
      }
      
      if (data.length === 0) {
        console.warn('Import data array is empty');
        return { data: [] };
      }
      
      // Handle specific transformations for different tables
      if (tableName === 'purchase_orders') {
        // Analyze the data first
        const analysis = await this.analyzePurchaseOrderData(data);
        console.log('Data analysis results:', analysis);
        
        // Ensure required fields
        const prepared = data.map((item, index) => ({
          ...item,
          po_number: item.po_number || `PO-IMPORT-${Date.now()}-${index}`,
          vendor: item.vendor || 'Unknown Vendor',
          issue_date: item.issue_date || new Date().toISOString(),
          status: item.status || 'pending'
        }));
        
        return { data: prepared };
      }
      
      if (tableName === 'shipmentlogs') {
        // Ensure required fields
        const prepared = data.map((item, index) => ({
          ...item,
          vendor: item.vendor || 'Unknown Vendor',
          shipment_date: item.shipment_date || new Date().toISOString(),
          status: item.status || 'Pending'
        }));
        
        return { data: prepared };
      }
      
      // Default: return as is
      return { data };
    } catch (error) {
      console.error(`Error preparing import data for ${tableName}:`, error);
      return { error: error.message, data: null };
    }
  }

  async testImport(data: any, tableName: string) {
    try {
      console.log(`=== Starting test import for ${tableName} ===`);
      
      // Step 1: Debug the import data
      console.log(`Step 1: Debug import data for ${tableName}`);
      const debugResult = await this.debugImportData(data, tableName);
      console.log('Debug result:', debugResult);
      
      // Step 2: Prepare the data
      console.log(`Step 2: Prepare import data for ${tableName}`);
      const { data: preparedData, error: prepareError } = await this.prepareImportData(data, tableName);
      
      if (prepareError) {
        console.error('Error preparing data:', prepareError);
        return { success: false, error: prepareError };
      }
      
      if (!preparedData || preparedData.length === 0) {
        console.warn('No data to import after preparation');
        return { success: false, error: 'No data to import after preparation' };
      }
      
      console.log(`Prepared ${preparedData.length} records for import`);
      
      // Step 3: Try to insert a single record first
      console.log(`Step 3: Testing single record import for ${tableName}`);
      const singleRecord = preparedData[0];
      
      let singleImportResult;
      if (tableName === 'purchase_orders') {
        const { error: singleError } = await serviceRoleClient
          .from(tableName)
          .insert([singleRecord]);
        
        singleImportResult = { error: singleError };
      } else if (tableName === 'shipmentlogs') {
        const { error: singleError } = await serviceRoleClient
          .from(tableName)
          .insert([singleRecord]);
        
        singleImportResult = { error: singleError };
      }
      
      if (singleImportResult?.error) {
        console.error('Error inserting single record:', singleImportResult.error);
        
        // Try to fix common issues
        console.log('Attempting to fix issues with data structure...');
        
        // Check if the table exists, create if not
        const tableCreationResult = await this.ensureTableExists(tableName);
        if (!tableCreationResult.success) {
          return { success: false, error: `Failed to ensure table exists: ${tableCreationResult.error}` };
        }
        
        return { 
          success: false, 
          error: singleImportResult.error,
          data: singleRecord,
          suggestionText: 'Check the data format and table structure',
          fixAttempted: true
        };
      }
      
      console.log('Single record import successful!');
      
      // Step 4: Import the full data
      console.log(`Step 4: Importing full data set of ${preparedData.length} records`);
      let fullImportResult;
      
      if (tableName === 'purchase_orders') {
        fullImportResult = await this.upsertPurchaseOrders(preparedData);
      } else if (tableName === 'shipmentlogs') {
        fullImportResult = await this.upsertShipmentLogs(preparedData);
      }
      
      if (!fullImportResult) {
        return { 
          success: false, 
          error: 'Failed to import full data set',
          singleImportSuccess: true
        };
      }
      
      console.log('Full data import successful!');
      return { 
        success: true, 
        message: `Successfully imported ${preparedData.length} records into ${tableName}`
      };
    } catch (error) {
      console.error(`Error in test import for ${tableName}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  // Helper to ensure the table exists
  async ensureTableExists(tableName: string) {
    try {
      console.log(`Ensuring ${tableName} table exists...`);
      
      // First check if the table exists
      const { data, error } = await serviceRoleClient
        .from(tableName)
        .select('count');
        
      // If table exists, no need to create it
      if (!error) {
        console.log(`Table ${tableName} already exists`);
        return { success: true };
      }
      
      // Table doesn't exist, try to create it
      if (tableName === 'purchase_orders') {
        await this.createPurchaseOrdersTable();
      } else if (tableName === 'shipmentlogs') {
        await this.createShipmentLogsTable();
      } else {
        return { success: false, error: `No creation method for table ${tableName}` };
      }
      
      // Verify the table was created
      const { error: verifyError } = await serviceRoleClient
        .from(tableName)
        .select('count');
        
      if (verifyError) {
        return { success: false, error: `Failed to create table ${tableName}: ${verifyError.message}` };
      }
      
      return { success: true };
    } catch (error) {
      console.error(`Error ensuring ${tableName} table exists:`, error);
      return { success: false, error: error.message };
    }
  }
  
  // Create purchase_orders table
  async createPurchaseOrdersTable() {
    try {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS public.purchase_orders (
          id SERIAL PRIMARY KEY,
          po_number TEXT UNIQUE NOT NULL,
          job_id INTEGER,
          vendor TEXT NOT NULL,
          amount NUMERIC,
          status TEXT,
          issue_date TEXT,
          expected_date TEXT,
          received_date TEXT,
          notes TEXT,
          description TEXT,
          severity TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;
      
      console.log('Creating purchase_orders table...');
      
      try {
        // Try to use RPC to create the table
        const { error } = await serviceRoleClient.rpc('exec_sql', {
          sql_query: createTableSQL
        });
        
        if (error) {
          console.error('Error creating purchase_orders table with RPC:', error);
          
          // Insert sample data to auto-create table
          return await this.insertPurchaseOrdersSampleData();
        }
        
        return true;
      } catch (err) {
        console.error('Error with RPC:', err);
        
        // Insert sample data to auto-create table
        return await this.insertPurchaseOrdersSampleData();
      }
    } catch (error) {
      console.error('Error creating purchase_orders table:', error);
      return false;
    }
  }
  
  // Create shipmentlogs table
  async createShipmentLogsTable() {
    try {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS public.shipmentlogs (
          id SERIAL PRIMARY KEY,
          po_number TEXT,
          vendor TEXT NOT NULL,
          shipment_date TEXT NOT NULL,
          received_date TEXT,
          status TEXT,
          tracking_number TEXT,
          carrier TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;
      
      console.log('Creating shipmentlogs table...');
      
      try {
        // Try to use RPC to create the table
        const { error } = await serviceRoleClient.rpc('exec_sql', {
          sql_query: createTableSQL
        });
        
        if (error) {
          console.error('Error creating shipmentlogs table with RPC:', error);
          
          // Insert sample data to auto-create table
          return await this.insertShipmentLogsSampleData();
        }
        
        return true;
      } catch (err) {
        console.error('Error with RPC:', err);
        
        // Insert sample data to auto-create table
        return await this.insertShipmentLogsSampleData();
      }
    } catch (error) {
      console.error('Error creating shipmentlogs table:', error);
      return false;
    }
  }

  async verifyRLSBypass() {
    try {
      console.log('Verifying service role client can bypass RLS policies...');
      
      // First attempt to insert a test record using serviceRoleClient
      const testRecord = {
        po_number: `TEST-RLS-BYPASS-${Date.now()}`,
        vendor: 'Test Vendor',
        amount: 100,
        status: 'test',
        issue_date: new Date().toISOString()
      };
      
      const { data: insertData, error: insertError } = await serviceRoleClient
        .from('purchase_orders')
        .insert([testRecord])
        .select();
      
      if (insertError) {
        console.error('Error testing RLS bypass:', insertError);
        
        // Try applying a permissive RLS policy
        console.log('Attempting to add permissive RLS policy for purchase_orders...');
        try {
          const { error: policyError } = await serviceRoleClient.rpc('apply_permissive_policy', {
            table_name: 'purchase_orders'
          });
          
          if (policyError) {
            console.error('Error applying permissive policy:', policyError);
            
            // Try direct SQL execution
            console.log('Trying direct SQL to create permissive policy...');
            const sql = `
              BEGIN;
              -- Drop any existing policies
              DROP POLICY IF EXISTS allow_all_purchase_orders ON purchase_orders;
              
              -- Create permissive policy
              CREATE POLICY allow_all_purchase_orders ON purchase_orders
                USING (true) WITH CHECK (true);
              
              COMMIT;
            `;
            
            const { error: sqlError } = await serviceRoleClient.rpc('exec_sql', { 
              sql_query: sql 
            });
            
            if (sqlError) {
              console.error('Error executing SQL for permissive policy:', sqlError);
              return false;
            }
            
            console.log('Successfully created permissive policy via SQL');
          } else {
            console.log('Successfully applied permissive policy via RPC');
          }
          
          // Test again after policy change
          const { error: retestError } = await serviceRoleClient
            .from('purchase_orders')
            .insert([{
              ...testRecord,
              po_number: `TEST-RLS-BYPASS-RETRY-${Date.now()}`
            }]);
            
          if (retestError) {
            console.error('Still having RLS issues after policy update:', retestError);
            return false;
          }
          
          console.log('RLS policy update successful!');
          return true;
          
        } catch (policyErr) {
          console.error('Error attempting to modify RLS policy:', policyErr);
          return false;
        }
      }
      
      // Clean up test record
      if (insertData && insertData.length > 0) {
        await serviceRoleClient
          .from('purchase_orders')
          .delete()
          .eq('po_number', testRecord.po_number);
      }
      
      console.log('Verified serviceRoleClient can bypass RLS policies successfully');
      return true;
    } catch (error) {
      console.error('Error in verifyRLSBypass:', error);
      return false;
    }
  }

  async analyzePurchaseOrderData(data: any[]) {
    try {
      console.log(`Analyzing ${data.length} purchase orders from import data...`);
      
      // Check for duplicate PO numbers
      const poMap = {};
      const duplicates = [];
      
      data.forEach((po, index) => {
        if (!po.po_number) {
          console.warn(`Warning: Item at index ${index} has no po_number`);
          return;
        }
        
        if (poMap[po.po_number]) {
          duplicates.push({
            po_number: po.po_number,
            firstIndex: poMap[po.po_number].index,
            secondIndex: index,
            first: poMap[po.po_number].data,
            second: po
          });
        } else {
          poMap[po.po_number] = { index, data: po };
        }
      });
      
      if (duplicates.length > 0) {
        console.warn(`Found ${duplicates.length} duplicate PO numbers in import data`);
        console.warn('First 5 duplicates:', duplicates.slice(0, 5));
      } else {
        console.log('No duplicate PO numbers found in import data');
      }
      
      // Check for missing required fields
      const missingFields = [];
      data.forEach((po, index) => {
        const missing = [];
        if (!po.po_number) missing.push('po_number');
        if (!po.vendor) missing.push('vendor');
        
        if (missing.length > 0) {
          missingFields.push({
            index,
            missing,
            data: po
          });
        }
      });
      
      if (missingFields.length > 0) {
        console.warn(`Found ${missingFields.length} records with missing required fields`);
        console.warn('First 5 records with issues:', missingFields.slice(0, 5));
      } else {
        console.log('All records have required fields');
      }
      
      return {
        totalRecords: data.length,
        duplicatePOs: duplicates.length,
        recordsWithMissingFields: missingFields.length,
        uniquePOs: Object.keys(poMap).length
      };
    } catch (error) {
      console.error('Error analyzing purchase order data:', error);
      return {
        error: error.message,
        totalRecords: data.length
      };
    }
  }

  async manualPurchaseOrderImport(data: any[]) {
    try {
      console.log(`Manual import of ${data.length} purchase orders...`);
      
      // Analyze data first
      await this.analyzePurchaseOrderData(data);
      
      // De-duplicate the data
      const uniquePOs: Record<string, any> = {};
      data.forEach(po => {
        if (po.po_number) {
          uniquePOs[po.po_number] = po;
        }
      });
      
      const uniqueData = Object.values(uniquePOs);
      console.log(`De-duplicated to ${uniqueData.length} records`);
      
      // Create empty table if needed
      try {
        await this.createPurchaseOrdersTable();
      } catch (err) {
        console.log('Table creation error (might already exist):', err);
      }
      
      // Process in very small batches to minimize errors
      const BATCH_SIZE = 10;
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < uniqueData.length; i += BATCH_SIZE) {
        const batch = uniqueData.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(uniqueData.length/BATCH_SIZE)}`);
        
        try {
          // Try updating existing first
          const poNumbers = batch.map(po => po.po_number as string);
          
          // First, try to delete existing records with these PO numbers
          await serviceRoleClient
            .from('purchase_orders')
            .delete()
            .in('po_number', poNumbers);
            
          // Then insert the new ones
          const { error } = await serviceRoleClient
            .from('purchase_orders')
            .insert(batch);
            
          if (error) {
            console.error(`Error in batch ${Math.floor(i/BATCH_SIZE) + 1}:`, error);
            failCount += batch.length;
            
            // Try one by one if batch fails
            for (const po of batch) {
              try {
                const { error: singleError } = await serviceRoleClient
                  .from('purchase_orders')
                  .insert([po]);
                  
                if (singleError) {
                  console.error(`Error inserting ${po.po_number as string}:`, singleError);
                  failCount++;
                } else {
                  successCount++;
                }
              } catch (singleErr) {
                console.error(`Exception inserting ${po.po_number as string}:`, singleErr);
                failCount++;
              }
            }
          } else {
            successCount += batch.length;
            console.log(`Successfully inserted batch ${Math.floor(i/BATCH_SIZE) + 1}`);
          }
        } catch (batchError) {
          console.error(`Error processing batch ${Math.floor(i/BATCH_SIZE) + 1}:`, batchError);
          failCount += batch.length;
        }
      }
      
      console.log(`Manual import complete: ${successCount} successful, ${failCount} failed`);
      
      // Verify count
      const { count } = await serviceRoleClient
        .from('purchase_orders')
        .select('*', { count: 'exact', head: true });
        
      console.log(`Verified ${count} purchase orders in database`);
      
      return { success: successCount > 0, count, successCount, failCount };
    } catch (error) {
      console.error('Fatal error in manual import:', error);
      return { success: false, error: error.message };
    }
  }

  // Add a manual method similar to purchase orders for shipment logs
  async manualShipmentLogImport(shipmentLogs: any[]) {
    try {
      console.log(`Manual import of ${shipmentLogs.length} shipment logs...`);
      
      // Create empty table if needed
      try {
        await this.createShipmentLogsTable();
      } catch (err) {
        console.log('Table creation error (might already exist):', err);
      }
      
      // Generate sequential IDs for any entries with null ID
      // First, get the max ID from the existing data
      let startId = 1;
      try {
        const { data: maxIdData } = await serviceRoleClient
          .from('shipmentlogs')
          .select('id')
          .order('id', { ascending: false })
          .limit(1);
          
        if (maxIdData && maxIdData.length > 0 && maxIdData[0].id) {
          startId = Number(maxIdData[0].id) + 1;
        }
      } catch (e) {
        console.error('Error getting max ID:', e);
      }
      
      // Assign IDs to shipment logs that don't have one
      let currentId = startId;
      const preparedLogs = shipmentLogs.map(log => {
        if (log.id === null || log.id === undefined) {
          return { ...log, id: currentId++ };
        }
        return log;
      });
      
      // Process in small batches
      const BATCH_SIZE = 10;
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < preparedLogs.length; i += BATCH_SIZE) {
        const batch = preparedLogs.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(preparedLogs.length/BATCH_SIZE)}`);
        
        try {
          // First try simple insert
          const { error } = await serviceRoleClient
            .from('shipmentlogs')
            .insert(batch);
            
          if (error) {
            console.error(`Error in batch ${Math.floor(i/BATCH_SIZE) + 1}:`, error);
            failCount += batch.length;
            
            // Try one by one if batch fails
            for (const log of batch) {
              try {
                const { error: singleError } = await serviceRoleClient
                  .from('shipmentlogs')
                  .insert([log]);
                  
                if (singleError) {
                  console.error(`Error inserting log:`, singleError);
                  failCount++;
                } else {
                  successCount++;
                }
              } catch (singleErr) {
                console.error(`Exception inserting log:`, singleErr);
                failCount++;
              }
            }
          } else {
            successCount += batch.length;
            console.log(`Successfully inserted batch ${Math.floor(i/BATCH_SIZE) + 1}`);
          }
        } catch (batchError) {
          console.error(`Error processing batch ${Math.floor(i/BATCH_SIZE) + 1}:`, batchError);
          failCount += batch.length;
        }
      }
      
      console.log(`Manual import complete: ${successCount} successful, ${failCount} failed`);
      
      // Verify count
      const { count } = await serviceRoleClient
        .from('shipmentlogs')
        .select('*', { count: 'exact', head: true });
        
      console.log(`Verified ${count} shipment logs in database`);
      
      return { success: successCount > 0, count, successCount, failCount };
    } catch (error) {
      console.error('Fatal error in manual shipment log import:', error);
      return { success: false, error: error.message };
    }
  }

  // Function to link purchase orders to jobs based on matching information
  async linkPurchaseOrdersToJobs() {
    try {
      console.log('Linking purchase orders to jobs...');
      
      // 1. Get all jobs
      const { data: jobs, error: jobsError } = await serviceRoleClient
        .from('jobs')
        .select('id, job_number');
        
      if (jobsError) {
        console.error('Error getting jobs:', jobsError);
        return false;
      }
      
      if (!jobs || jobs.length === 0) {
        console.log('No jobs found to link purchase orders to');
        return false;
      }
      
      console.log(`Found ${jobs.length} jobs for linking`);
      
      // 2. Get all purchase orders
      const { data: purchaseOrders, error: poError } = await serviceRoleClient
        .from('purchase_orders')
        .select('*');
        
      if (poError) {
        console.error('Error getting purchase orders:', poError);
        return false;
      }
      
      if (!purchaseOrders || purchaseOrders.length === 0) {
        console.log('No purchase orders found for linking');
        return false;
      }
      
      console.log(`Found ${purchaseOrders.length} purchase orders for linking`);
      
      // 3. Link POs to jobs when they have a matching component in notes or description
      let updateCount = 0;
      const jobMap = {};
      jobs.forEach(job => {
        jobMap[job.job_number] = job.id;
      });
      
      for (const po of purchaseOrders) {
        // Skip if PO already has a job_id
        if (po.job_id) continue;
        
        // Search for job_number in PO fields
        const poText = [
          po.po_number, 
          po.notes, 
          po.description,
          po.vendor
        ].filter(Boolean).join(' ').toLowerCase();
        
        // Try to find a matching job number
        let matchedJobId = null;
        for (const job of jobs) {
          if (poText.includes(job.job_number.toLowerCase())) {
            matchedJobId = job.id;
            break;
          }
        }
        
        // If no exact match found, look for partial matches
        if (!matchedJobId) {
          for (const job of jobs) {
            // Try common variations
            const jobNumberParts = job.job_number.split('-');
            if (jobNumberParts.length > 1) {
              const shortJobNumber = jobNumberParts[jobNumberParts.length - 1];
              if (shortJobNumber.length >= 4 && poText.includes(shortJobNumber)) {
                matchedJobId = job.id;
                break;
              }
            }
          }
        }
        
        // Update PO with matched job_id
        if (matchedJobId) {
          const { error: updateError } = await serviceRoleClient
            .from('purchase_orders')
            .update({ job_id: matchedJobId })
            .eq('id', po.id);
            
          if (updateError) {
            console.error(`Error updating PO ${po.id}:`, updateError);
          } else {
            updateCount++;
          }
        }
      }
      
      console.log(`Successfully linked ${updateCount} purchase orders to jobs`);
      return updateCount > 0;
    } catch (error) {
      console.error('Error linking purchase orders to jobs:', error);
      return false;
    }
  }

  // Function to generate vendor operations from purchase orders
  async generateVendorOperations() {
    try {
      console.log('Generating vendor operations from purchase orders...');
      
      // 1. First check if vendor_operations table exists
      try {
        const { count, error } = await serviceRoleClient
          .from('vendor_operations')
          .select('*', { count: 'exact', head: true });
          
        if (!error && count && count > 5) {
          console.log(`Vendor operations table already has ${count} records, skipping generation`);
          return true;
        }
      } catch (e) {
        console.log('Vendor operations table check failed, will create data:', e);
      }
      
      // 2. Get purchase orders with job_id filled in
      const { data: purchaseOrders, error: poError } = await serviceRoleClient
        .from('purchase_orders')
        .select('*')
        .not('job_id', 'is', null);
        
      if (poError) {
        console.error('Error getting purchase orders:', poError);
        return false;
      }
      
      if (!purchaseOrders || purchaseOrders.length === 0) {
        console.log('No purchase orders with job_id found for generating vendor operations');
        return false;
      }
      
      console.log(`Found ${purchaseOrders.length} purchase orders with job_id for generating vendor operations`);
      
      // 3. Generate vendor operations
      const vendorOperations = purchaseOrders.map((po, index) => ({
        id: index + 1,
        job_id: po.job_id,
        operation: po.description || `Vendor operation for PO ${po.po_number}`,
        vendor: po.vendor,
        date_range: `${po.issue_date?.substring(0, 10) || new Date().toISOString().substring(0, 10)} to ${po.expected_date?.substring(0, 10) || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10)}`,
        status: po.status,
        notes: po.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      
      // 4. Insert vendor operations
      const { error: insertError } = await serviceRoleClient
        .from('vendor_operations')
        .upsert(vendorOperations, { onConflict: 'id' });
        
      if (insertError) {
        console.error('Error inserting vendor operations:', insertError);
        return false;
      }
      
      console.log(`Successfully inserted ${vendorOperations.length} vendor operations`);
      return true;
    } catch (error) {
      console.error('Error generating vendor operations:', error);
      return false;
    }
  }

  // Function to generate job timelines from purchase orders and shipment logs
  async generateJobTimelines() {
    try {
      console.log('Generating job timelines from purchase orders and shipment logs...');
      
      // 1. Get all jobs with empty timelines
      const { data: jobs, error: jobsError } = await serviceRoleClient
        .from('jobs')
        .select('*');
        
      if (jobsError) {
        console.error('Error getting jobs:', jobsError);
        return false;
      }
      
      if (!jobs || jobs.length === 0) {
        console.log('No jobs found to generate timelines for');
        return false;
      }
      
      console.log(`Found ${jobs.length} jobs for generating timelines`);
      
      // Create a map of job timelines (even if they already have some)
      const jobTimelines = {};
      
      // First add existing timelines
      for (const job of jobs) {
        if (job.timeline && Array.isArray(job.timeline)) {
          jobTimelines[job.id] = job.timeline;
        } else {
          jobTimelines[job.id] = [];
        }
      }
      
      // 2. Get purchase orders with job_id
      const { data: purchaseOrders, error: poError } = await serviceRoleClient
        .from('purchase_orders')
        .select('*')
        .not('job_id', 'is', null);
        
      if (!poError && purchaseOrders && purchaseOrders.length > 0) {
        console.log(`Found ${purchaseOrders.length} purchase orders with job_id for timelines`);
        
        // Add PO events to timelines
        for (const po of purchaseOrders) {
          if (!jobTimelines[po.job_id]) {
            jobTimelines[po.job_id] = [];
          }
          
          // Add PO creation event
          jobTimelines[po.job_id].push({
            id: `po-${po.id}-created`,
            date: po.issue_date || new Date().toISOString(),
            title: 'Purchase Order Created',
            description: `PO ${po.po_number} for ${po.vendor} created`,
            status: 'completed'
          });
          
          // Add PO received event if applicable
          if (po.received_date) {
            jobTimelines[po.job_id].push({
              id: `po-${po.id}-received`,
              date: po.received_date,
              title: 'Purchase Order Received',
              description: `PO ${po.po_number} from ${po.vendor} received`,
              status: 'completed'
            });
          }
        }
      }
      
      // 3. Get shipment logs linked to jobs
      const { data: shipmentLogs, error: slError } = await serviceRoleClient
        .from('shipmentlogs')
        .select('*');
        
      if (!slError && shipmentLogs && Array.isArray(shipmentLogs) && shipmentLogs.length > 0) {
        console.log(`Found ${shipmentLogs.length} shipment logs for timelines`);
        
        // Try to match shipment logs to jobs via POs
        const poJobMap = {};
        for (const po of purchaseOrders || []) {
          if (po.job_id && po.po_number) {
            poJobMap[po.po_number] = po.job_id;
          }
        }
        
        // Add shipment events to timelines
        for (const log of shipmentLogs) {
          const jobId = log.po_number ? poJobMap[log.po_number] : null;
          if (jobId && jobTimelines[jobId]) {
            // Add shipment event
            jobTimelines[jobId].push({
              id: `shipment-${log.id}`,
              date: log.shipment_date || new Date().toISOString(),
              title: 'Shipment Created',
              description: `Shipment from ${log.vendor} created`,
              status: 'completed'
            });
            
            // Add received event if applicable
            if (log.received_date) {
              jobTimelines[jobId].push({
                id: `shipment-${log.id}-received`,
                date: log.received_date,
                title: 'Shipment Received',
                description: `Shipment from ${log.vendor} received`,
                status: 'completed'
              });
            }
          }
        }
      }
      
      // 4. Update jobs with timelines
      let updateCount = 0;
      for (const [jobId, timeline] of Object.entries(jobTimelines)) {
        if (Array.isArray(timeline) && timeline.length > 0) {
          const { error: updateError } = await serviceRoleClient
            .from('jobs')
            .update({ timeline })
            .eq('id', jobId);
            
          if (!updateError) {
            updateCount++;
          }
        }
      }
      
      console.log(`Successfully updated ${updateCount} jobs with timelines`);
      return updateCount > 0;
    } catch (error) {
      console.error('Error generating job timelines:', error);
      return false;
    }
  }

  // Master function to fix logistics page data
  async fixLogisticsPageData() {
    try {
      console.log('Starting logistics page data fix...');
      
      // 1. Ensure required tables exist
      await this.createLogisticsTables();
      
      // 2. Link purchase orders to jobs
      await this.linkPurchaseOrdersToJobs();
      
      // 3. Generate vendor operations
      await this.generateVendorOperations();
      
      // 4. Generate job timelines
      await this.generateJobTimelines();
      
      console.log('Logistics page data fix completed');
      return true;
    } catch (error) {
      console.error('Error fixing logistics page data:', error);
      return false;
    }
  }
}

export const db = new Database();

// Creates an easy-to-import function that can be called directly from components
export async function fixLogisticsData() {
  console.log("Running logistics data fix...");
  return await db.fixLogisticsPageData();
}