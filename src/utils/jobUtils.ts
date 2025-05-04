import { differenceInCalendarDays, parseISO } from 'date-fns';

export type RawOperation = {
  operation_number: number;
  planned_hours?: number;
  actual_hours?: number;
  remaining_work?: number;
  work_center?: string;
  task_description?: string;
  part_name?: string;
};

export type ProcessedOperation = Required<Pick<RawOperation, 'operation_number' | 'planned_hours' | 'actual_hours' | 'remaining_work' | 'work_center' | 'task_description' | 'part_name'>> & {
  status: 'Complete' | 'In Progress' | 'Not Started' | 'Ignored';
  cost_planned: number;
  cost_actual: number;
  cost_remaining: number;
};

export type RawJob = {
  job_number: string;
  due_date?: string;
  order_value?: number;
  work_orders?: Array<{
    work_order_number: string;
    operations?: RawOperation[];
  }>;
};

export type ProcessedJob = RawJob & {
  operations: ProcessedOperation[];
  total_planned_hours: number;
  total_actual_hours: number;
  total_remaining_hours: number;
  completion_percentage: number;
  projected_hours: number;
  total_planned_cost: number;
  total_actual_cost: number;
  projected_cost: number;
  days_until_due: number;
  is_overdue: boolean;
  is_at_risk: boolean;
  is_di_job: boolean;
  profit_value?: number;
  profit_margin?: number;
};

const DEFAULT_RATE = 199;
const REDUCED_RATE = 10;
const DI_KEYWORDS = [
  'dismantling & inspection',
  'dni',
  'dismantling and inspect',
  'dismantling & inspect'
];

export function calculateLaborCost(
  hours: number = 0,
  work_center?: string,
  task_description?: string,
  part_name?: string
): number {
  const desc = task_description?.toLowerCase() || '';
  const part = part_name?.toLowerCase() || '';
  if (
    work_center === 'REP ENG' ||
    desc === 'engineering time' ||
    part.includes('rc') ||
    part.includes('engineering') ||
    part.includes('admin')
  ) {
    return hours * REDUCED_RATE;
  }
  return hours * DEFAULT_RATE;
}

export function assignOperationStatuses(rawOps: RawOperation[]): ProcessedOperation[] {
  // Normalize and sort by operation_number
  const ops = rawOps
    .map(op => ({
      operation_number: op.operation_number,
      planned_hours: op.planned_hours || 0,
      actual_hours: op.actual_hours || 0,
      remaining_work: op.remaining_work || 0,
      work_center: op.work_center || '',
      task_description: op.task_description || '',
      part_name: op.part_name || ''
    }))
    .sort((a, b) => a.operation_number - b.operation_number);

  const processed: ProcessedOperation[] = ops.map(op => ({
    ...op,
    status: 'Not Started',
    cost_planned: calculateLaborCost(op.planned_hours, op.work_center, op.task_description, op.part_name),
    cost_actual: calculateLaborCost(op.actual_hours, op.work_center, op.task_description, op.part_name),
    cost_remaining: calculateLaborCost(
      Math.max(op.planned_hours - op.actual_hours, 0),
      op.work_center,
      op.task_description,
      op.part_name
    )
  }));

  // Initial pass: determine statuses based on rules
  processed.forEach((op, idx) => {
    const { planned_hours, actual_hours, work_center, task_description } = op;

    // Special: ignore SR with planned < 1
    if (work_center === 'SR' && planned_hours < 1) {
      op.status = 'Ignored';
      return;
    }
    // Special: task containing "Complete"
    if (task_description.toLowerCase().includes('complete') && actual_hours > 0.8 * planned_hours) {
      op.status = 'Complete';
      return;
    }
    // Rule 1
    if (actual_hours >= planned_hours) {
      op.status = 'Complete';
    }
    // Rule 2
    else if (actual_hours > 0) {
      op.status = 'In Progress';
    } else {
      // subsequent ops
      const subsequent = processed.slice(idx + 1);
      const allSubOk = subsequent.every(
        s => ['Complete', 'In Progress'].includes(s.status)
      );
      const anySubInProgress = subsequent.some(
        s => s.status === 'In Progress'
      );
      // Rule 3
      if (actual_hours >= 0.7 * planned_hours && allSubOk) {
        op.status = 'Complete';
      }
      // Rule 4
      else if (actual_hours >= 0.3 * planned_hours && anySubInProgress) {
        op.status = 'Complete';
      }
      // Rule 5
      else {
        op.status = 'Not Started';
      }
    }
  });

  // Rule 6: three consecutive In Progress -> mark first two as Complete
  for (let i = 0; i < processed.length - 2; i++) {
    if (
      processed[i].status === 'In Progress' &&
      processed[i + 1].status === 'In Progress' &&
      processed[i + 2].status === 'In Progress'
    ) {
      processed[i].status = 'Complete';
      processed[i + 1].status = 'Complete';
    }
  }

  return processed;
}

export function processJob(rawJob: RawJob): ProcessedJob {
  // Flatten operations with null checks
  const allOps: RawOperation[] = rawJob.work_orders 
    ? rawJob.work_orders.flatMap(wo => wo.operations || [])
    : [];
  const operations = assignOperationStatuses(allOps);

  // Calculate hours with proper fallbacks and type safety
  const total_planned_hours = operations.reduce((sum, o) => sum + (Number(o.planned_hours) || 0), 0);
  const total_actual_hours = operations.reduce((sum, o) => sum + (Number(o.actual_hours) || 0), 0);
  const total_remaining_hours = operations.reduce(
    (sum, o) => sum + Math.max((Number(o.planned_hours) || 0) - (Number(o.actual_hours) || 0), 0),
    0
  );

  // Calculate completion percentage safely
  const completion_percentage = total_planned_hours > 0 
    ? Math.min((total_actual_hours / total_planned_hours) * 100, 100)
    : 0;

  // Calculate projected hours based on actual progress
  const projected_hours = completion_percentage > 0 && completion_percentage < 100
    ? total_actual_hours + total_remaining_hours
    : total_planned_hours;

  // Calculate costs
  const total_planned_cost = operations.reduce((sum, o) => 
    sum + calculateLaborCost(o.planned_hours, o.work_center, o.task_description, o.part_name), 0);
  
  const total_actual_cost = operations.reduce((sum, o) => 
    sum + calculateLaborCost(o.actual_hours, o.work_center, o.task_description, o.part_name), 0);
  
  const projected_cost = operations.reduce((sum, o) => 
    sum + calculateLaborCost(
      Math.max((Number(o.planned_hours) || 0) - (Number(o.actual_hours) || 0), 0),
      o.work_center,
      o.task_description,
      o.part_name
    ), 0) + total_actual_cost;

  const today = new Date();
  const dueDate = rawJob.due_date ? parseISO(rawJob.due_date) : null;
  const days_until_due = dueDate ? differenceInCalendarDays(dueDate, today) : Number.NaN;
  const is_overdue = dueDate ? days_until_due < 0 : false;
  const is_at_risk = dueDate && days_until_due <= 5 && total_remaining_hours > 0.5 * total_planned_hours;

  // Calculate DI job status with null check
  const is_di_job = rawJob.work_orders ? rawJob.work_orders.every(wo => {
    if (!wo.operations || wo.operations.length !== 1) return false;
    const pn = wo.operations[0].part_name?.toLowerCase() || '';
    return DI_KEYWORDS.some(key => pn.includes(key));
  }) : false;

  // Calculate profit metrics
  let profit_value: number | undefined;
  let profit_margin: number | undefined;
  if (rawJob.order_value != null) {
    profit_value = rawJob.order_value - projected_cost;
    profit_margin = rawJob.order_value > 0 ? (profit_value / rawJob.order_value) * 100 : undefined;
  }

  return {
    ...rawJob,
    operations,
    total_planned_hours,
    total_actual_hours,
    total_remaining_hours,
    completion_percentage,
    projected_hours,
    total_planned_cost,
    total_actual_cost,
    projected_cost,
    days_until_due,
    is_overdue,
    is_at_risk,
    is_di_job,
    profit_value,
    profit_margin
  };
}

/**
 * Calculate burden cost based on job properties
 */
export const calculateCost = (hours: number, description?: string | null, workCenter?: string | null, taskDescription?: string | null): number => {
  const defaultBurdenRate = 199; // Default burden rate
  const reducedBurdenRate = 10;  // Reduced burden rate

  // Apply the reduced burden rate for specific conditions
  let burdenRate = defaultBurdenRate;
  
  if (
    description === 'RC' || 
    description === 'Engineering' || 
    description === 'Admin' || 
    description === 'RC / Engineering / Admin.' || 
    workCenter === 'REP ENG' || 
    taskDescription === 'Engineering Time'
  ) {
    burdenRate = reducedBurdenRate;
  }

  // Calculate the cost based on hours and the applicable burden rate
  return hours * burdenRate;
};

/**
 * Calculate job metrics from input values
 */
export const recalculateJobMetrics = (job: any) => {
  // Ensure we have valid numerical inputs or use defaults
  const plannedHours = Number(job.planned_hours || 0);
  const actualHours = Number(job.actual_hours || 0);
  const progress = Number(job.progress || 0) / 100;
  
  // Calculate projected hours based on actual progress and time spent
  let projectedHours = plannedHours; // Default to planned
  if (progress > 0 && progress < 1 && actualHours > 0) {
    projectedHours = actualHours / progress; // Project total based on current progress
  }
  
  // Get burden rates based on job attributes
  const description = job.description || job['Opr. short text'] || '';
  const workCenter = job['Oper.WorkCenter'] || job.work_center || '';
  const taskDescription = job.task_description || '';
  
  // Calculate costs
  const plannedCost = calculateCost(plannedHours, description, workCenter, taskDescription);
  const actualCost = calculateCost(actualHours, description, workCenter, taskDescription);
  const projectedCost = calculateCost(projectedHours, description, workCenter, taskDescription);
  
  // Calculate order value either from net price or direct value
  const netPrice = Number(job['Net price'] || 0);
  const qty = Number(job['Order Quantity'] || job['Quantity'] || 1);
  const orderValue = netPrice * qty || Number(job.order_value || 0);
  
  // Calculate margin and profit
  let margin = Number(job.margin || 0);
  let profitValue = Number(job.profit_value || 0);
  
  // Recalculate margin and profit if order value exists
  if (orderValue > 0) {
    profitValue = orderValue - projectedCost;
    margin = (profitValue / orderValue) * 100;
  }
  
  return {
    ...job,
    planned_hours: plannedHours,
    actual_hours: actualHours,
    projected_hours: projectedHours,
    planned_cost: plannedCost,
    actual_cost: actualCost,
    projected_cost: projectedCost,
    order_value: orderValue,
    margin: margin,
    profit_value: profitValue
  };
};

/**
 * Process job data from different sources into a standardized format
 */
export const formatJob = (job: any) => {
  // Extract necessary fields with improved fallbacks for Excel data formats
  
  // Job identification fields
  const sales_document = job["Sales Document"] || job.sales_document || '';
  const reference_name = job["List name"] || job.reference_name || job.Reference || job.title || '';
  const job_number = job.Order || job.job_number || job.Job_Number || job['Job Number'] || job.id || '';
  
  // SAPDATA.xlsx format specific fields
  // For hours, use Work and Actual work directly from SAPDATA
  const plannedHours = Number(job.Work !== undefined ? job.Work : 
                        (job.planned_hours || job['Planned Hours'] || job.planned_work || 0));
                        
  const actualHours = Number(job['Actual work'] !== undefined ? job['Actual work'] : 
                      (job.actual_hours || job['Actual Hours'] || job.actual_work || 0));
  
  // For projected hours, use Work as the base (as mentioned by user)
  let projectedHours = plannedHours; // Default to planned hours
  
  // If we have actual hours and progress, we can calculate a better projection
  const progress = Number(job.Progress || job.progress || job['% Complete'] || 0) / 100;
  if (progress > 0 && progress < 1 && actualHours > 0) {
    projectedHours = actualHours / progress; // Project total based on current progress
  }
  
  // Work center and description from SAPDATA.xlsx
  const description = job.Description || job['Opr. short text'] || job.description || job.Job_Description || '';
  const workCenter = job['Oper.WorkCenter'] || job.work_center || job.Work_Center || job['Work Center'] || '';
  const taskDescription = job.Description || job.task_description || job.Task_Description || job['Task Description'] || '';
  
  // Financial data from PURCHASEORDERS.xlsx or other calculated values
  const netPrice = Number(job['Net price'] || 0);
  const qty = Number(job['Order Quantity'] || job['Quantity'] || 1);
  const orderValue = netPrice * qty || Number(job.Order_Value || job.order_value || job['Order Value'] || 0);
  
  const stillToBeDeliveredValue = Number(job['Still to be delivered (value)'] || 0);
  
  // Calculate costs using burden rates based on work categories
  const plannedCost = calculateCost(plannedHours, description, workCenter, taskDescription);
  const actualCost = calculateCost(actualHours, description, workCenter, taskDescription);
  const projectedCost = calculateCost(projectedHours, description, workCenter, taskDescription);
  
  // Calculate margin and profit - use actual values if available
  // If not in the data, estimate based on costs and order value
  const margin = Number(job.Margin || job.margin || job['Margin %'] || 
    (orderValue > 0 ? ((orderValue - actualCost) / orderValue * 100) : 0));
  
  const profitValue = Number(job['Profit Value'] || job.profit_value || 
    (orderValue > 0 ? (orderValue - actualCost) : 0));
  
  // Due date handling
  const dueDate = job.Document_Date || job['Document Date'] || job['Due Date'] || job.due_date || job.Due_Date || (new Date()).toISOString();
  
  return {
    ...job,
    sales_document,
    job_number,
    reference_name,
    title: reference_name, // Ensure title is set
    progress: progress * 100, // Convert from decimal to percentage
    due_date: dueDate,
    // Work and financial fields
    planned_hours: plannedHours,
    actual_hours: actualHours,
    projected_hours: projectedHours,
    planned_cost: plannedCost,
    actual_cost: actualCost,
    projected_cost: projectedCost,
    order_value: orderValue,
    margin: margin,
    profit_value: profitValue,
    // Additional fields
    work_center: workCenter,
    description: description,
    oper_short_text: job['Opr. short text'] || '',
    // Make sure we have assigned employees array
    assignedEmployees: job.assignedEmployees || job.Assigned_Employees || []
  };
};