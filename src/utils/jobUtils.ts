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
  work_orders: Array<{
    work_order_number: string;
    operations: RawOperation[];
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
  // Flatten operations
  const allOps: RawOperation[] = rawJob.work_orders.flatMap(wo => wo.operations);
  const operations = assignOperationStatuses(allOps);

  const total_planned_hours = operations.reduce((sum, o) => sum + o.planned_hours, 0);
  const total_actual_hours = operations.reduce((sum, o) => sum + o.actual_hours, 0);
  const total_remaining_hours = operations.reduce(
    (sum, o) => sum + Math.max(o.planned_hours - o.actual_hours, 0),
    0
  );
  const completion_percentage =
    total_planned_hours > 0 ? (total_actual_hours / total_planned_hours) * 100 : 0;
  const projected_hours = total_actual_hours + total_remaining_hours;

  const total_planned_cost = operations.reduce((sum, o) => sum + o.cost_planned, 0);
  const total_actual_cost = operations.reduce((sum, o) => sum + o.cost_actual, 0);
  const projected_cost = operations.reduce((sum, o) => sum + o.cost_actual + o.cost_remaining, 0);

  const today = new Date();
  const dueDate = rawJob.due_date ? parseISO(rawJob.due_date) : null;
  const days_until_due = dueDate
    ? differenceInCalendarDays(dueDate, today)
    : Number.NaN;
  const is_overdue = dueDate ? days_until_due < 0 : false;
  const is_at_risk =
    dueDate && days_until_due <= 5
      ? total_remaining_hours > 0.5 * total_planned_hours
      : false;

  // D&I job detection: all WOs have exactly one op and part_name matches keywords
  const is_di_job = rawJob.work_orders.every(wo => {
    if (wo.operations.length !== 1) return false;
    const pn = wo.operations[0].part_name?.toLowerCase() || '';
    return DI_KEYWORDS.some(key => pn.includes(key));
  });

  let profit_value: number | undefined;
  let profit_margin: number | undefined;
  if (rawJob.order_value != null) {
    profit_value = rawJob.order_value - total_actual_cost;
    profit_margin =
      rawJob.order_value > 0
        ? (profit_value / rawJob.order_value) * 100
        : undefined;
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