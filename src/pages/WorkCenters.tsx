import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { db } from "@/lib/db";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Info,
  Search,
  Settings,
  Wrench
} from "lucide-react";

interface WorkCenter {
  id?: number;
  name: string;
  type: string;
  status: string;
  utilization: number;
}

interface Job {
  id: number;
  job_number: string;
  title: string;
  description: string;
  status: string;
  due_date: string;
  scheduled_date: string;
  priority: string;
  progress: number;
  work_center: string;
  customer: string;
}

interface WorkCenterMetrics {
  available_work_hours: number;
  backlog_hours: number;
  in_progress_hours: number;
  efficiency: number;
  historical_efficiency: number;
  utilization_rate: number;
  remaining_hours: number;
  total_jobs: number;
  total_operations: number;
  avg_hours_per_job: number;
  peak_load: boolean;
}

interface Operation {
  part_name: string;
  work_order_number: string;
  operation_number: string;
  task_description: string;
  remaining_work: number;
  planned_hours: number;
  actual_hours: number;
  status: string;
}

export default function WorkCenters() {
  const [selectedWorkCenter, setSelectedWorkCenter] = useState<WorkCenter | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"available" | "backlog" | "in_progress" | "details">("details");
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [isLoadingWorkCenterJobs, setIsLoadingWorkCenterJobs] = useState(false);

  // Fetch work centers
  const { data: workCentersData = [], isLoading: isLoadingWorkCenters } = useQuery({
    queryKey: ["workCenters"],
    queryFn: async () => {
      try {
        return await db.getWorkCenters();
      } catch (error) {
        console.error("Error fetching work centers:", error);
        return [];
      }
    },
  });

  // Fetch jobs
  const { data: jobs = [], isLoading: isLoadingJobs } = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      try {
        return await db.getJobs();
      } catch (error) {
        console.error("Error fetching jobs:", error);
        return [];
      }
    },
  });

  // Fetch SAP operations
  const { data: sapOperations = [], isLoading: isLoadingSapOps } = useQuery({
    queryKey: ["sapOperations"],
    queryFn: async () => {
      try {
        return await db.getSAPOperations();
      } catch (error) {
        console.error("Error fetching SAP operations:", error);
        return [];
      }
    },
  });

  // Calculate work center metrics from SAP data
  const calculateWorkCenterMetrics = () => {
    const metrics: Record<string, WorkCenterMetrics> = {};

    workCentersData.forEach((wc: WorkCenter) => {
      // Get operations for this work center - handle both formats
      const wcOperations = sapOperations.filter(op => {
        // Check both possible property names for work center
        return (op['Oper.WorkCenter'] === wc.name) || (op.work_center === wc.name);
      });

      // Calculate total planned and actual hours
      const totalPlannedHours = wcOperations.reduce((sum, op) => {
        // Check both possible property names for planned work
        const planned = Number(op['Work'] || op.planned_work || 0);
        return sum + planned;
      }, 0);

      const totalActualHours = wcOperations.reduce((sum, op) => {
        // Check both possible property names for actual work
        const actual = Number(op['Actual work'] || op.actual_work || 0);
        return sum + actual;
      }, 0);

      // Calculate in progress and backlog hours
      const inProgressOps = wcOperations.filter(op => {
        const actual = Number(op['Actual work'] || op.actual_work || 0);
        const planned = Number(op['Work'] || op.planned_work || 0);
        return actual > 0 && actual < planned;
      });

      const backlogOps = wcOperations.filter(op => {
        const actual = Number(op['Actual work'] || op.actual_work || 0);
        return actual === 0;
      });

      const inProgressHours = inProgressOps.reduce((sum, op) => {
        const planned = Number(op['Work'] || op.planned_work || 0);
        const actual = Number(op['Actual work'] || op.actual_work || 0);
        return sum + (planned - actual);
      }, 0);

      const backlogHours = backlogOps.reduce((sum, op) => {
        const planned = Number(op['Work'] || op.planned_work || 0);
        return sum + planned;
      }, 0);

      // Calculate available hours (total planned - in progress - backlog)
      const availableHours = Math.max(0, totalPlannedHours - inProgressHours - backlogHours);

      // Calculate efficiency
      const efficiency = totalPlannedHours > 0
        ? (totalActualHours / totalPlannedHours) * 100
        : 0;

      // Get unique orders for this work center
      const uniqueOrders = new Set(wcOperations.map(op => op['Order'] || op.order_number));

      metrics[wc.name] = {
        available_work_hours: availableHours,
        backlog_hours: backlogHours,
        in_progress_hours: inProgressHours,
        efficiency: Math.round(efficiency),
        historical_efficiency: Math.max(0, efficiency - 5), // Simulate historical data
        utilization_rate: wc.utilization,
        remaining_hours: inProgressHours + backlogHours,
        total_jobs: uniqueOrders.size,
        total_operations: wcOperations.length,
        avg_hours_per_job: uniqueOrders.size > 0 ? totalPlannedHours / uniqueOrders.size : 0,
        peak_load: backlogHours > 100 || wc.utilization > 80
      };
    });

    return metrics;
  };

  // Calculate metrics once when operations or work centers change
  const workCenterMetrics = useMemo(
    () => calculateWorkCenterMetrics(),
    [sapOperations, workCentersData]
  );

  const openWorkCenterModal = async (workCenter: WorkCenter, type: "available" | "backlog" | "in_progress" | "details") => {
    setSelectedWorkCenter(workCenter);
    setModalType(type);
    setModalOpen(true);
    setSelectedJob(null);
    setOperations([]);

    if (type !== "details") {
      setIsLoadingWorkCenterJobs(true);
      try {
        const status = type === "available" ? "Available" :
          type === "in_progress" ? "In Progress" :
            "Backlog";
        const workCenterJobs = await db.getJobsByWorkCenter(workCenter.name, status);
        setJobs(workCenterJobs || []);
      } catch (error) {
        console.error('Error fetching work center jobs:', error);
      } finally {
        setIsLoadingWorkCenterJobs(false);
      }
    }
  };

  const openJobDetails = async (jobNumber: string) => {
    setSelectedJob(jobNumber);

    try {
      const jobOps = await db.getOrderOperations(jobNumber);
      console.log('Job operations fetched:', jobOps);

      // Convert SAP operations to display format
      const operations: Operation[] = (jobOps || []).map(op => ({
        part_name: op['Oper.WorkCenter'] || op.work_center || '',
        work_order_number: op['Sales Document'] || op.order_number || op['Order'] || '',
        operation_number: op['Oper./Act.'] || op.operation_number || '',
        task_description: op['Description'] || op['Opr. short text'] || op.description || op.short_text || '',
        remaining_work: (Number(op['Work'] || op.planned_work) || 0) - (Number(op['Actual work'] || op.actual_work) || 0),
        planned_hours: Number(op['Work'] || op.planned_work) || 0,
        actual_hours: Number(op['Actual work'] || op.actual_work) || 0,
        status: getOperationStatus(op)
      }));

      console.log('Formatted operations:', operations);
      setOperations(operations);
    } catch (error) {
      console.error('Error fetching job operations:', error);
      setOperations([]);
    }
  };

  const getOperationStatus = (op: any): string => {
    // Handle both data formats
    const planned = Number(op['Work'] || op.planned_work) || 0;
    const actual = Number(op['Actual work'] || op.actual_work) || 0;

    // If the operation has a status field, use it
    if (op.status && typeof op.status === 'string') {
      const status = op.status.toLowerCase();
      if (status === 'complete' || status === 'completed') return 'Complete';
      if (status === 'in progress') return 'In Progress';
      if (status === 'pending' || status === 'not started') return 'Pending';
    }

    // Otherwise calculate based on completion percentage
    const completion = planned > 0 ? (actual / planned) * 100 : 0;

    if (completion >= 100) return 'Complete';
    if (completion > 0) return 'In Progress';
    return 'Pending';
  };

  if (isLoadingWorkCenters || isLoadingJobs || isLoadingSapOps) {
    return (
      <DashboardLayout>
        <div className="p-6 flex justify-center items-center min-h-[50vh]">
          <LoadingSpinner message="Loading work center data..." />
        </div>
      </DashboardLayout>
    );
  }

  // Calculate overall metrics for the summary cards
  const totalWorkCenters = workCentersData.length;
  const avgUtilization = workCentersData.reduce((acc, wc) => acc + wc.utilization, 0) / Math.max(1, totalWorkCenters);
  const activeJobs = jobs.filter(job => job.status === "In Progress").length;
  const availableCapacity = 100 - avgUtilization;

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-1">Work Centers</h1>
            <p className="text-muted-foreground">
              Monitor and manage all production work centers
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex gap-2">
            <Button variant="outline" size="sm">
              <Clock className="mr-2 h-4 w-4" /> Work History
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="mr-2 h-4 w-4" /> Settings
            </Button>
            <Button size="sm">
              <Wrench className="mr-2 h-4 w-4" /> Add Work Center
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Work Centers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalWorkCenters}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Active production centers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Average Utilization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgUtilization.toFixed(1)}%</div>
              <Progress
                value={avgUtilization}
                className="h-2 mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Across all centers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeJobs}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Currently in work centers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Available Capacity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{availableCapacity.toFixed(1)}%</div>
              <Progress
                value={availableCapacity}
                className="h-2 mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Remaining production capacity
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
          {workCentersData.map((workCenter) => {
            const metrics = workCenterMetrics[workCenter.name] || {
              available_work_hours: 0,
              backlog_hours: 0,
              in_progress_hours: 0,
              efficiency: 0,
              utilization_rate: 0,
              remaining_hours: 0,
              total_jobs: 0,
              peak_load: false
            };

            return (
              <Card key={workCenter.name} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle>{workCenter.name}</CardTitle>
                    <Badge variant={metrics.peak_load ? "destructive" : "default"}>
                      {metrics.peak_load ? "High Load" : "Normal"}
                    </Badge>
                  </div>
                  <CardDescription>{workCenter.type}</CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div
                      className="cursor-pointer hover:bg-muted p-2 rounded transition-colors"
                      onClick={() => openWorkCenterModal(workCenter, "available")}
                    >
                      <p className="text-xs text-muted-foreground">Available</p>
                      <p className="font-semibold text-primary">
                        {metrics.available_work_hours.toFixed(1)} hrs
                      </p>
                    </div>

                    <div
                      className="cursor-pointer hover:bg-muted p-2 rounded transition-colors"
                      onClick={() => openWorkCenterModal(workCenter, "backlog")}
                    >
                      <p className="text-xs text-muted-foreground">Backlog</p>
                      <p className="font-semibold text-amber-500">
                        {metrics.backlog_hours.toFixed(1)} hrs
                      </p>
                    </div>

                    <div
                      className="cursor-pointer hover:bg-muted p-2 rounded transition-colors"
                      onClick={() => openWorkCenterModal(workCenter, "in_progress")}
                    >
                      <p className="text-xs text-muted-foreground">In Progress</p>
                      <p className="font-semibold text-blue-500">
                        {metrics.in_progress_hours.toFixed(1)} hrs
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm mb-1">Utilization</p>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={workCenter.utilization}
                        className="h-2 flex-grow"
                      />
                      <span className="text-sm font-medium">{workCenter.utilization}%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Jobs</p>
                      <p className="font-medium">{metrics.total_jobs}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Remaining Hours</p>
                      <p className="font-medium">{metrics.remaining_hours.toFixed(1)}</p>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="bg-muted/50 pt-3">
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => openWorkCenterModal(workCenter, "details")}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    View Details
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Work Center Details Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {selectedWorkCenter?.name} - {modalType.replace('_', ' ').toUpperCase()}
            </DialogTitle>
            <DialogDescription>
              {modalType === "details" && "Work center details and operations"}
              {modalType === "available" && "Available work hours and capacity"}
              {modalType === "backlog" && "Backlog jobs and operations"}
              {modalType === "in_progress" && "Jobs and operations in progress"}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Jobs</h3>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job Number</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingWorkCenterJobs ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          <LoadingSpinner message="Loading jobs..." />
                        </TableCell>
                      </TableRow>
                    ) : selectedWorkCenter && jobs
                      .filter(job => job.work_center === selectedWorkCenter.name)
                      .map((job: any) => (
                        <TableRow
                          key={job.job_number}
                          className={`cursor-pointer hover:bg-muted/50 ${selectedJob === job.job_number ? 'bg-muted' : ''}`}
                          onClick={() => openJobDetails(job.job_number)}
                        >
                          <TableCell className="font-medium">{job.job_number}</TableCell>
                          <TableCell>{job.customer}</TableCell>
                          <TableCell>{job.title}</TableCell>
                          <TableCell>
                            <Badge variant={
                              job.status === "Completed" ? "default" :
                                job.status === "In Progress" ? "secondary" :
                                  job.status === "Delayed" ? "destructive" : "outline"
                            }>
                              {job.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{job.remaining_hours?.toFixed(1) || '0.0'} hrs</TableCell>
                        </TableRow>
                      ))}
                    {selectedWorkCenter && !isLoadingWorkCenterJobs && jobs.filter(job => job.work_center === selectedWorkCenter.name).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground h-32">
                          No jobs found for this work center
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {selectedJob && (
              <div>
                <h3 className="text-lg font-medium mb-2">Operations for Job {selectedJob}</h3>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Part</TableHead>
                        <TableHead>Work Order</TableHead>
                        <TableHead>Operation #</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Remaining</TableHead>
                        <TableHead>Planned</TableHead>
                        <TableHead>Actual</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {operations.map((op, index) => (
                        <TableRow key={index}>
                          <TableCell>{op.part_name}</TableCell>
                          <TableCell>{op.work_order_number}</TableCell>
                          <TableCell>{op.operation_number}</TableCell>
                          <TableCell>{op.task_description}</TableCell>
                          <TableCell>{op.remaining_work.toFixed(2)}</TableCell>
                          <TableCell>{op.planned_hours.toFixed(2)}</TableCell>
                          <TableCell>{op.actual_hours.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={
                              op.status === "Complete" ? "default" :
                                op.status === "In Progress" ? "secondary" :
                                  op.status === "Pending" ? "outline" : "destructive"
                            }>
                              {op.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {operations.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground h-32">
                            Select a job to view operations
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {selectedWorkCenter && modalType === "details" && (
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-2">Work Center Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Efficiency Rate</p>
                      <div className="flex items-center mt-1">
                        <div className="flex-grow bg-gray-200 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full ${workCenterMetrics[selectedWorkCenter.name]?.efficiency >= 80
                              ? 'bg-green-500'
                              : workCenterMetrics[selectedWorkCenter.name]?.efficiency >= 60
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                              }`}
                            style={{ width: `${workCenterMetrics[selectedWorkCenter.name]?.efficiency || 0}%` }}
                          ></div>
                        </div>
                        <span className="ml-2 text-sm font-medium">
                          {workCenterMetrics[selectedWorkCenter.name]?.efficiency || 0}%
                        </span>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Total Operations</p>
                      <p className="text-lg font-medium">{workCenterMetrics[selectedWorkCenter.name]?.total_operations || 0}</p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Average Hours per Job</p>
                      <p className="text-lg font-medium">{(workCenterMetrics[selectedWorkCenter.name]?.avg_hours_per_job || 0).toFixed(1)} hrs</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Work Distribution</p>
                      <div className="flex items-center mt-2">
                        <div
                          className="h-6 bg-green-500 rounded-l"
                          style={{
                            width: `${(workCenterMetrics[selectedWorkCenter.name]?.available_work_hours || 0) /
                              (workCenterMetrics[selectedWorkCenter.name]?.available_work_hours +
                                workCenterMetrics[selectedWorkCenter.name]?.backlog_hours +
                                workCenterMetrics[selectedWorkCenter.name]?.in_progress_hours || 1) * 100}%`
                          }}
                        ></div>
                        <div
                          className="h-6 bg-amber-500"
                          style={{
                            width: `${(workCenterMetrics[selectedWorkCenter.name]?.backlog_hours || 0) /
                              (workCenterMetrics[selectedWorkCenter.name]?.available_work_hours +
                                workCenterMetrics[selectedWorkCenter.name]?.backlog_hours +
                                workCenterMetrics[selectedWorkCenter.name]?.in_progress_hours || 1) * 100}%`
                          }}
                        ></div>
                        <div
                          className="h-6 bg-blue-500 rounded-r"
                          style={{
                            width: `${(workCenterMetrics[selectedWorkCenter.name]?.in_progress_hours || 0) /
                              (workCenterMetrics[selectedWorkCenter.name]?.available_work_hours +
                                workCenterMetrics[selectedWorkCenter.name]?.backlog_hours +
                                workCenterMetrics[selectedWorkCenter.name]?.in_progress_hours || 1) * 100}%`
                          }}
                        ></div>
                      </div>
                      <div className="flex text-xs mt-1 justify-between">
                        <span>Available: {(workCenterMetrics[selectedWorkCenter.name]?.available_work_hours || 0).toFixed(1)} hrs</span>
                        <span>Backlog: {(workCenterMetrics[selectedWorkCenter.name]?.backlog_hours || 0).toFixed(1)} hrs</span>
                        <span>In Progress: {(workCenterMetrics[selectedWorkCenter.name]?.in_progress_hours || 0).toFixed(1)} hrs</span>
                      </div>
                    </div>

                    <div className="pt-4">
                      <p className="text-sm text-muted-foreground">Historical Efficiency</p>
                      <div className="text-sm flex items-center mt-1">
                        <span
                          className={
                            (workCenterMetrics[selectedWorkCenter.name]?.efficiency || 0) >
                              (workCenterMetrics[selectedWorkCenter.name]?.historical_efficiency || 0)
                              ? 'text-green-500'
                              : 'text-red-500'
                          }
                        >
                          {
                            (workCenterMetrics[selectedWorkCenter.name]?.efficiency || 0) >
                              (workCenterMetrics[selectedWorkCenter.name]?.historical_efficiency || 0)
                              ? '↑'
                              : '↓'
                          } {Math.abs((
                            (workCenterMetrics[selectedWorkCenter.name]?.efficiency || 0) -
                            (workCenterMetrics[selectedWorkCenter.name]?.historical_efficiency || 0)
                          )).toFixed(1)}%
                        </span>
                        <span className="ml-2">from previous period</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}