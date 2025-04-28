import { useState, useMemo, useEffect } from "react";
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
import { toast } from "@/components/ui/use-toast";

interface WorkCenter {
  id?: number;
  name: string;
  type: string;
  status: string;
  utilization: number;
}

// Add missing hardcoded work centers that should always be present
const REQUIRED_WORK_CENTERS = ['KEY', 'BUILD', 'SANDBLAS'];

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
  planned_hours: number;
  actual_hours: number;
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
  const [jobs, setJobs] = useState<any[]>([]);
  const [allWorkCenters, setAllWorkCenters] = useState<WorkCenter[]>([]);

  // Fetch work centers
  const { data: workCentersData = [], isLoading: isLoadingWorkCenters } = useQuery({
    queryKey: ["workCenters"],
    queryFn: async () => {
      try {
        const data = await db.getWorkCenters();
        console.log("Fetched work centers:", data);
        return data;
      } catch (error) {
        console.error("Error fetching work centers:", error);
        return [];
      }
    },
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true
  });

  // Ensure required work centers are included
  useEffect(() => {
    if (workCentersData && workCentersData.length > 0) {
      // Create a set of existing work center names for quick lookups
      const existingNames = new Set(workCentersData.map((wc: WorkCenter) => wc.name.toUpperCase()));
      
      // Create a list to hold all work centers, including those from the database
      const combined = [...workCentersData];
      
      // Add any missing required work centers
      REQUIRED_WORK_CENTERS.forEach(wcName => {
        if (!existingNames.has(wcName)) {
          console.log(`Adding missing required work center: ${wcName}`);
          combined.push({
            name: wcName,
            type: 'Production',
            status: 'Available',
            utilization: 60 // Default utilization
          });
        }
      });
      
      setAllWorkCenters(combined);
    }
  }, [workCentersData]);

  // Fetch jobs
  const { data: jobsData = [], isLoading: isLoadingJobs } = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      try {
        return await db.getJobs();
      } catch (error) {
        console.error("Error fetching jobs:", error);
        return [];
      }
    },
    staleTime: 0,
    refetchOnMount: true
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
    staleTime: 0,
    refetchOnMount: true
  });

  // Calculate work center metrics from SAP data
  const calculateWorkCenterMetrics = () => {
    const metrics: Record<string, WorkCenterMetrics> = {};

    workCentersData.forEach((wc: WorkCenter) => {
      console.log(`Calculating metrics for work center: ${wc.name}`);
      
      const normalizedWcName = wc.name.trim().toLowerCase();
      
      // Get operations for this work center - handle all possible formats and case insensitivity
      const wcOperations = sapOperations.filter(op => {
        // Normalize work center names for comparison
        const opWorkCenter = (op['Oper.WorkCenter'] || op.work_center || '').trim().toLowerCase();
        return opWorkCenter === normalizedWcName;
      });
      
      console.log(`Found ${wcOperations.length} operations for ${wc.name}`);

      // Calculate total planned and actual hours
      const totalPlannedHours = wcOperations.reduce((sum, op) => {
        // Check all possible property names for planned work
        const planned = Number(op['Work'] || op.planned_work || 0);
        return sum + planned;
      }, 0);

      const totalActualHours = wcOperations.reduce((sum, op) => {
        // Check all possible property names for actual work
        const actual = Number(op['Actual work'] || op.actual_work || 0);
        return sum + actual;
      }, 0);
      
      console.log(`${wc.name} - Planned: ${totalPlannedHours}, Actual: ${totalActualHours}`);

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
      
      console.log(`${wc.name} - In Progress: ${inProgressHours}, Backlog: ${backlogHours}`);

      // Calculate available hours (total planned - in progress - backlog)
      const availableHours = Math.max(0, totalPlannedHours - inProgressHours - backlogHours);

      // Calculate efficiency
      const efficiency = totalPlannedHours > 0
        ? (totalActualHours / totalPlannedHours) * 100
        : 0;

      // Get unique orders for this work center
      const uniqueOrders = new Set(wcOperations.map(op => op['Order'] || op.order_number));
      
      console.log(`${wc.name} - Unique orders: ${uniqueOrders.size}, Efficiency: ${efficiency.toFixed(1)}%`);

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
        peak_load: backlogHours > 100 || wc.utilization > 80,
        planned_hours: totalPlannedHours,
        actual_hours: totalActualHours
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
    setIsLoadingWorkCenterJobs(true);
    
    try {
      console.log(`Loading data for work center: ${workCenter.name}, type: ${type}`);
      
      // Always load jobs for the work center regardless of modal type
      const workCenterJobs = await db.getJobsByWorkCenter(workCenter.name);
      console.log(`Found ${workCenterJobs?.length || 0} jobs for work center ${workCenter.name}`);
      setJobs(workCenterJobs || []);
      
      if (type !== "details") {
        const status = type === "available" ? "Available" :
          type === "in_progress" ? "In Progress" :
            "Backlog";
        
        // Filter jobs by status if needed
        const filteredJobs = workCenterJobs?.filter(job => job.operationStatus === status) || [];
        console.log(`Filtered to ${filteredJobs.length} ${status} jobs`);
        setJobs(filteredJobs);
      }
      
      // For details view, load the metrics for this work center
      const metrics = await db.getWorkCenterMetrics(workCenter.name);
      console.log(`Loaded metrics for ${workCenter.name}:`, metrics);
      
    } catch (error) {
      console.error('Error fetching work center data:', error);
      toast({
        title: "Error",
        description: "Failed to load work center data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingWorkCenterJobs(false);
    }
  };

  const openJobDetails = async (jobNumber: string) => {
    setSelectedJob(jobNumber);
    setOperations([]); // Clear previous operations
    
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
      toast({
        title: "Error",
        description: "Failed to load job operations. Please try again.",
        variant: "destructive"
      });
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
      <div className="p-6 flex justify-center items-center min-h-[50vh]">
        <LoadingSpinner message="Loading work center data..." />
      </div>
    );
  }

  // Calculate overall metrics for the summary cards
  const totalWorkCenters = allWorkCenters.length;
  const avgUtilization = allWorkCenters.reduce((acc, wc) => acc + wc.utilization, 0) / Math.max(1, totalWorkCenters);
  const activeJobs = jobsData.filter(job => job.status === "In Progress").length;
  const availableCapacity = 100 - avgUtilization;

  return (
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
        {allWorkCenters.map((workCenter) => {
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

      {/* Work Center Details Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
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

          {isLoadingWorkCenterJobs ? (
            <div className="flex justify-center items-center py-8">
              <LoadingSpinner message={`Loading ${modalType} data...`} />
            </div>
          ) : (
            <div className="mt-4">
              {modalType === "details" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Work Center Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type:</span>
                        <span className="font-medium">{selectedWorkCenter?.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant={selectedWorkCenter?.status === "Running" ? "default" : "secondary"}>
                          {selectedWorkCenter?.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Utilization:</span>
                        <span className="font-medium">{selectedWorkCenter?.utilization}%</span>
                      </div>
                      {workCenterMetrics[selectedWorkCenter?.name || ""] && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Operations:</span>
                            <span className="font-medium">{workCenterMetrics[selectedWorkCenter?.name || ""].total_operations}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Active Jobs:</span>
                            <span className="font-medium">{workCenterMetrics[selectedWorkCenter?.name || ""].total_jobs}</span>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Capacity Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {workCenterMetrics[selectedWorkCenter?.name || ""] && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Planned Hours:</span>
                            <span className="font-medium">{workCenterMetrics[selectedWorkCenter?.name || ""].planned_hours?.toFixed(1)} hrs</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Actual Hours:</span>
                            <span className="font-medium">{workCenterMetrics[selectedWorkCenter?.name || ""].actual_hours?.toFixed(1)} hrs</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Efficiency:</span>
                            <span className="font-medium">{workCenterMetrics[selectedWorkCenter?.name || ""].efficiency?.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Backlog Hours:</span>
                            <span className="font-medium text-amber-500">{workCenterMetrics[selectedWorkCenter?.name || ""].backlog_hours?.toFixed(1)} hrs</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">In Progress Hours:</span>
                            <span className="font-medium text-blue-500">{workCenterMetrics[selectedWorkCenter?.name || ""].in_progress_hours?.toFixed(1)} hrs</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Available Hours:</span>
                            <span className="font-medium text-green-500">{workCenterMetrics[selectedWorkCenter?.name || ""].available_work_hours?.toFixed(1)} hrs</span>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Jobs List */}
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    {modalType === "available" && "Available Jobs"}
                    {modalType === "backlog" && "Backlog Jobs"}
                    {modalType === "in_progress" && "In Progress Jobs"}
                    {modalType === "details" && "Associated Jobs"}
                  </h3>
                  
                  {jobs && jobs.length > 0 ? (
                    <Card>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Job #</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Hours</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {jobs
                            .filter(job => job.work_center === selectedWorkCenter?.name)
                            .map((job: any) => (
                              <TableRow
                                key={job.job_number}
                                className={`cursor-pointer hover:bg-muted ${selectedJob === job.job_number ? 'bg-muted' : ''}`}
                                onClick={() => openJobDetails(job.job_number)}
                              >
                                <TableCell className="font-medium">
                                  {job.job_number}
                                </TableCell>
                                <TableCell>{job.title}</TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      job.status === "Completed" ? "outline" :
                                      job.status === "In Progress" ? "default" :
                                      "secondary"
                                    }
                                  >
                                    {job.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {job.remaining_hours !== undefined
                                    ? `${job.remaining_hours.toFixed(1)} hrs`
                                    : "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </Card>
                  ) : (
                    <div className="text-center py-4 bg-muted rounded-md">
                      <p className="text-muted-foreground">
                        {modalType === "available" && "No available jobs for this work center"}
                        {modalType === "backlog" && "No backlog jobs for this work center"}
                        {modalType === "in_progress" && "No jobs in progress for this work center"}
                        {modalType === "details" && "No jobs associated with this work center"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Operations List */}
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    {selectedJob ? `Operations for Job #${selectedJob}` : "Select a job to view operations"}
                  </h3>
                  
                  {selectedJob && operations.length > 0 ? (
                    <Card>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Op #</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Hours</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {operations.map((op, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">
                                {op.operation_number}
                              </TableCell>
                              <TableCell>{op.task_description}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    op.status === "Complete" ? "outline" :
                                    op.status === "In Progress" ? "default" :
                                    "secondary"
                                  }
                                >
                                  {op.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span>Plan: {op.planned_hours.toFixed(1)}</span>
                                  <span>Act: {op.actual_hours.toFixed(1)}</span>
                                  <span>Rem: {op.remaining_work.toFixed(1)}</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Card>
                  ) : selectedJob ? (
                    <div className="text-center py-4 h-full flex items-center justify-center bg-muted rounded-md">
                      <p className="text-muted-foreground">
                        No operations found for this job
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-4 h-full flex items-center justify-center bg-muted rounded-md">
                      <p className="text-muted-foreground">
                        Select a job from the list to view its operations
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}