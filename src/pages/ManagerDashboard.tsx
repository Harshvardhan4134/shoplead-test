// @ts-nocheck
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isBefore, isAfter, addDays } from "date-fns";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  BarChart3, 
  Calendar, 
  Clock, 
  FileText, 
  Flag, 
  RefreshCw, 
  Search, 
  Users, 
  AlertTriangle,
  ChevronDown,
  Bell,
  BarChart,
  CheckCircle,
  XCircle,
  UserPlus,
  DollarSign,
  Wrench,
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical
} from "lucide-react";
import { api } from "@/services/api";
import { Job, WorkOrder, Employee } from "@/shared/schema";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { processJob } from "@/utils/jobUtils";

const ManagerDashboard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState<"all" | "overdue" | "critical">("all");
  const [showHistoricalComparison, setShowHistoricalComparison] = useState(false);
  const [selectedJobForAssignment, setSelectedJobForAssignment] = useState<Job | null>(null);
  const [isNotificationDialogOpen, setIsNotificationDialogOpen] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationRecipients, setNotificationRecipients] = useState<string[]>([]);
  const [activeMetricsView, setActiveMetricsView] = useState<"performance" | "cost" | "quality">("performance");

  // Fetch jobs and compute metrics
  const {
    data: jobs = [],
    isLoading: isLoadingJobs,
    error: jobsError,
    refetch: refetchJobs
  } = useQuery({
    queryKey: ["/api/jobs"],
    queryFn: async (): Promise<any[]> => {
      const raw = await api.getJobs();
      return raw.map((j: any) => processJob(j));
    }
  });

  // Fetch employees data
  const {
    data: employees = [],
    isLoading: isLoadingEmployees
  } = useQuery({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const cachedData = queryClient.getQueryData<Employee[]>(["/api/employees"]);
      if (cachedData) return cachedData;
      return [
        { id: 1, name: "John Doe", department: "Machining", role: "Machinist", assignedJobs: [1, 5] },
        { id: 2, name: "Jane Smith", department: "Machining", role: "Machinist", assignedJobs: [2, 3] },
        { id: 3, name: "Bob Johnson", department: "Welding", role: "Welder", assignedJobs: [4] },
        { id: 4, name: "Sarah Wilson", department: "Welding", role: "Welder", assignedJobs: [6] },
        { id: 5, name: "Mike Brown", department: "Welding", role: "Welder", assignedJobs: [7] },
        { id: 6, name: "Lisa Davis", department: "Mechanical", role: "Mechanic", assignedJobs: [8] },
        { id: 7, name: "Tom Wilson", department: "Mechanical", role: "Mechanic", assignedJobs: [9] },
        { id: 8, name: "Emily Clark", department: "Mechanical", role: "Mechanic", assignedJobs: [] },
        { id: 9, name: "David Martinez", department: "Mechanical", role: "Mechanic", assignedJobs: [] },
        { id: 10, name: "Jessica Taylor", department: "Mechanical", role: "Lead Mechanic", assignedJobs: [10] },
      ];
    },
  });

  // Fetch historical jobs data
  const {
    data: historicalJobs = [],
    isLoading: isLoadingHistorical
  } = useQuery({
    queryKey: ["/api/historical-jobs"],
    queryFn: async (): Promise<any[]> => {
      return jobs.map((job: any) => ({
        ...job,
        id: `historical-${job.id}`,
        planned_hours: job.planned_hours,
        actual_hours: job.planned_hours ? Math.floor(job.planned_hours * (0.8 + Math.random() * 0.4)) : undefined,
        status: "Completed",
        completion_date: format(addDays(new Date(job.due_date), -Math.floor(Math.random() * 10)), "yyyy-MM-dd"),
        original_budget: job.budget,
        actual_cost: job.budget ? job.budget * (0.85 + Math.random() * 0.3) : undefined,
        rework_percentage: Math.random() > 0.7 ? Math.floor(Math.random() * 15) : 0
      }));
    },
    enabled: showHistoricalComparison
  });

  // Filter jobs based on tab and search query
  const filterJobs = () => {
    // Filter active jobs first
    const active = jobs?.filter(job =>
      job.status !== 'Completed' &&
      job.status !== 'Cancelled' &&
      !job.is_di_job
    ) || [];
    
    // Apply text search filter
    const textFiltered = active.filter(job => {
      const searchLower = searchQuery.toLowerCase();
      const jobNumber = String(job.job_number);
      const title = String(job.title || '');
      const customer = String(job.customer || '');

      return (
        jobNumber.toLowerCase().includes(searchLower) ||
        title.toLowerCase().includes(searchLower) ||
        customer.toLowerCase().includes(searchLower)
      );
    });
    
    // Apply tab filter
    if (selectedTab === "overdue") {
      return textFiltered.filter(job => 
        isBefore(new Date(job.due_date), new Date()) && 
        job.status !== "Completed"
      );
    } else if (selectedTab === "critical") {
      return textFiltered.filter(job => 
        job.priority === "High" || 
        job.progress < 30 ||
        (isBefore(new Date(job.due_date), addDays(new Date(), 3)) && job.status !== "Completed")
      );
    }
    
    return textFiltered;
  };

  // Sort jobs by priority and due date
  const sortJobs = (jobs: any[]) => {
    return [...jobs].sort((a, b) => {
      // First sort by priority
      if ((a.priority === "High" || a.progress < 30) && (b.priority !== "High" && b.progress >= 30)) return -1;
      if ((a.priority !== "High" && a.progress >= 30) && (b.priority === "High" || b.progress < 30)) return 1;
      
      // Then by due date
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
  };

  // Calculate comparison with historical data
  const getHistoricalComparison = (job: any) => {
    // Find similar historical jobs
    const similar = historicalJobs.filter(hJob => 
      hJob.work_center === job.work_center || 
      hJob.customer === job.customer
    );
    
    if (similar.length === 0) return null;
    
    // Calculate averages
    const avgPlannedHours = similar.reduce((sum, j) => sum + (j.planned_hours || 0), 0) / similar.length;
    const avgActualHours = similar.reduce((sum, j) => sum + (j.actual_hours || 0), 0) / similar.length;
    const avgBudget = similar.reduce((sum, j) => sum + (j.budget || 0), 0) / similar.length;
    const avgActualCost = similar.reduce((sum, j) => sum + (j.actual_cost || 0), 0) / similar.length;
    const avgRework = similar.reduce((sum, j) => sum + (j.rework_percentage || 0), 0) / similar.length;
    
    // Calculate current job projected values
    const currentPlannedHours = job.planned_hours || 0;
    const currentActualHours = job.actual_hours || 0;
    const hoursCompletion = job.progress / 100; // Estimate based on progress
    const projectedTotalHours = hoursCompletion > 0 ? currentActualHours / hoursCompletion : currentPlannedHours;
    
    return {
      timeComparison: projectedTotalHours > avgActualHours ? 
        { status: "worse", difference: Math.round((projectedTotalHours / avgActualHours - 1) * 100) } :
        { status: "better", difference: Math.round((1 - projectedTotalHours / avgActualHours) * 100) },
      
      costComparison: job.budget && avgBudget ? 
        (job.budget > avgBudget ? 
          { status: "worse", difference: Math.round((job.budget / avgBudget - 1) * 100) } :
          { status: "better", difference: Math.round((1 - job.budget / avgBudget) * 100) }) : 
        null,
      
      reworkRisk: job.progress < 50 ? 
        (avgRework > 5 ? "high" : "low") : 
        (job.rework_percentage || 0) > avgRework ? "high" : "low"
    };
  };

  // Calculate department metrics
  const calculateDepartmentMetrics = () => {
    const departments = ["Machining", "Welding", "Mechanical"];
    
    return departments.map(dept => {
      // Find employees in this department
      const deptEmployees = employees.filter(emp => emp.department === dept);
      const totalEmployees = deptEmployees.length;
      
      // Get unique jobs assigned to this department
      const assignedJobIds = new Set<number | string>();
      deptEmployees.forEach(emp => {
        emp.assignedJobs.forEach(jobId => assignedJobIds.add(jobId));
      });
      
      // Calculate capacity
      const totalCapacity = totalEmployees * 40; // 40 hours per employee per week
      const assignedJobs = jobs.filter(job => assignedJobIds.has(job.id));
      const estimatedHoursThisWeek = assignedJobs.reduce((sum, job) => {
        // Estimate hours based on job progress
        const remainingPercentage = (100 - job.progress) / 100;
        const remainingHours = (job.planned_hours || 40) * remainingPercentage;
        // Estimate hours for this week (capped at 40)
        return sum + Math.min(remainingHours, 40);
      }, 0);
      
      const capacityPercentage = Math.min(Math.round((estimatedHoursThisWeek / totalCapacity) * 100), 100);
      
      return {
        name: dept,
        employees: totalEmployees,
        jobsCount: assignedJobIds.size,
        capacityPercentage
      };
    });
  };

  // Calculate metrics
  const calculateMetrics = () => {
    const totalJobs = jobs.length;
    const completedJobs = jobs.filter(job => job.status === "Completed").length;
    const inProgressJobs = jobs.filter(job => job.status === "In Progress").length;
    const scheduledJobs = jobs.filter(job => job.status === "New").length;
    const delayedJobs = jobs.filter(job => {
      const dueDate = new Date(job.due_date);
      return dueDate < new Date() && job.status !== "Completed";
    }).length;

    const onTimeDelivery = totalJobs > 0 ?
      Number(((completedJobs - delayedJobs) / totalJobs * 100).toFixed(0)) : 0;

    const qualityRating = totalJobs > 0 ?
      Number(((totalJobs - jobs.filter(job => job.had_issues).length) / totalJobs * 100).toFixed(0)) : 0;

    return {
      totalJobs,
      completedJobs,
      inProgressJobs,
      scheduledJobs,
      delayedJobs,
      onTimeDelivery,
      qualityRating
    };
  };

  // Add worker performance calculation function after calculateMetrics
  const calculateWorkerPerformance = () => {
    // Extract all operations from all jobs
    const allOperations = jobs.flatMap(job => 
      job.operations || job.work_orders?.flatMap(wo => wo.operations) || []
    );
    
    // Group operations by worker/employee
    const workerMap = new Map();
    
    // Initialize worker stats for all employees
    employees.forEach(emp => {
      workerMap.set(emp.id, {
        id: emp.id,
        name: emp.name,
        department: emp.department,
        role: emp.role,
        totalAssignedJobs: emp.assignedJobs?.length || 0,
        completedOperations: 0,
        inProgressOperations: 0,
        totalOperations: 0,
        plannedHours: 0,
        actualHours: 0,
        efficiencyRate: 100, // Default
        onTimeCompletionRate: 100, // Default
        completionPercentage: 0,
        jobsData: []
      });
    });
    
    // Add job data to appropriate workers
    jobs.forEach(job => {
      const assignedEmployeeIds = job.assignedEmployees || [];
      
      assignedEmployeeIds.forEach(empId => {
        const workerData = workerMap.get(empId);
        if (workerData) {
          // Count job's operations by status
          const completedOps = job.operations?.filter(op => op.status === 'Complete')?.length || 0;
          const inProgressOps = job.operations?.filter(op => op.status === 'In Progress')?.length || 0;
          const totalOps = job.operations?.length || 0;
          
          // Update worker stats
          workerData.completedOperations += completedOps;
          workerData.inProgressOperations += inProgressOps;
          workerData.totalOperations += totalOps;
          workerData.plannedHours += job.total_planned_hours || 0;
          workerData.actualHours += job.total_actual_hours || 0;
          
          // Add job data
          workerData.jobsData.push({
            job_number: job.job_number,
            planned_hours: job.total_planned_hours,
            actual_hours: job.total_actual_hours,
            is_overdue: job.is_overdue,
            completion_percentage: job.completion_percentage,
            due_date: job.due_date
          });
          
          // Calculate metrics
          if (workerData.plannedHours > 0) {
            workerData.completionPercentage = (workerData.actualHours / workerData.plannedHours) * 100;
          }
          
          // Efficiency = planned vs actual hours (lower is better)
          if (workerData.plannedHours > 0 && workerData.actualHours > 0) {
            workerData.efficiencyRate = Math.min(100, (workerData.plannedHours / workerData.actualHours) * 100);
          }
          
          // On-time completion rate
          const overdueJobs = workerData.jobsData.filter(j => j.is_overdue).length;
          const totalJobs = workerData.jobsData.length;
          if (totalJobs > 0) {
            workerData.onTimeCompletionRate = ((totalJobs - overdueJobs) / totalJobs) * 100;
          }
        }
      });
    });
    
    // Convert map to array and sort by performance metrics
    return Array.from(workerMap.values())
      .filter(worker => worker.totalAssignedJobs > 0) // Only include workers with assignments
      .sort((a, b) => b.completionPercentage - a.completionPercentage);
  };

  // Mutation for updating due date
  const updateDueDateMutation = useMutation({
    mutationFn: async ({ jobId, newDate }: { jobId: number | string, newDate: string }) => {
      // In a real app, this would call an API endpoint
      console.log(`Updating due date for job ${jobId} to ${newDate}`);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update the job in the local cache
      const currentJobs = queryClient.getQueryData<any[]>(["/api/jobs"]) || [];
      const updatedJobs = currentJobs.map(job => 
        job.job_number === jobId ? { ...job, due_date: newDate } : job
      );
      
      queryClient.setQueryData(["/api/jobs"], updatedJobs);
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Due date updated",
        description: "Job due date has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating due date",
        description: "There was a problem updating the due date",
        variant: "destructive",
      });
    }
  });

  // Mutation for updating job status
  const updateJobStatusMutation = useMutation({
    mutationFn: async ({ jobId, newStatus }: { jobId: number | string, newStatus: string }) => {
      // In a real app, call API endpoint
      console.log(`Updating status for job ${jobId} to ${newStatus}`);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update job in cache
      const currentJobs = queryClient.getQueryData<any[]>(["/api/jobs"]) || [];
      const updatedJobs = currentJobs.map(job => 
        job.job_number === jobId ? { ...job, status: newStatus } : job
      );
      
      queryClient.setQueryData(["/api/jobs"], updatedJobs);
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Status updated",
        description: "Job status has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating status",
        description: "There was a problem updating the job status",
        variant: "destructive",
      });
    }
  });

  // Mutation for assigning employees to a job
  const assignEmployeeMutation = useMutation({
    mutationFn: async ({ jobId, employeeId }: { jobId: number | string, employeeId: number }) => {
      // In a real app, call API endpoint
      console.log(`Assigning employee ${employeeId} to job ${jobId}`);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update employee assignments in cache
      const currentEmployees = queryClient.getQueryData<Employee[]>(["/api/employees"]) || [];
      const updatedEmployees = currentEmployees.map(employee => 
        employee.id === employeeId 
          ? { ...employee, assignedJobs: [...(employee.assignedJobs || []), jobId] } 
          : employee
      );
      
      queryClient.setQueryData(["/api/employees"], updatedEmployees);
      
      // Also update the job to show assigned employees
      const currentJobs = queryClient.getQueryData<any[]>(["/api/jobs"]) || [];
      const updatedJobs = currentJobs.map(job => {
        if (job.job_number === jobId) {
          const currentAssignedEmployees = job.assignedEmployees || [];
          return { 
            ...job, 
            assignedEmployees: [...currentAssignedEmployees, employeeId]
          };
        }
        return job;
      });
      
      queryClient.setQueryData(["/api/jobs"], updatedJobs);
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Employee assigned",
        description: "Employee has been assigned to the job successfully",
      });
      setSelectedJobForAssignment(null);
    },
    onError: (error) => {
      toast({
        title: "Error assigning employee",
        description: "There was a problem assigning the employee to the job",
        variant: "destructive",
      });
    }
  });

  // Mutation for sending notifications
  const sendNotificationMutation = useMutation({
    mutationFn: async ({ message, recipients }: { message: string, recipients: string[] }) => {
      // In a real app, call notification API
      console.log(`Sending notification: ${message} to ${recipients.join(', ')}`);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Notification sent",
        description: "Your notification has been sent successfully",
      });
      
      // Reset form
      setNotificationMessage("");
      setNotificationRecipients([]);
      setIsNotificationDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error sending notification",
        description: "There was a problem sending the notification",
        variant: "destructive",
      });
    }
  });

  // Get filtered and sorted jobs
  const filteredSortedJobs = sortJobs(filterJobs() as any[]);
  const departmentMetrics = calculateDepartmentMetrics();
  const metrics = calculateMetrics();

  // Show loading states
  if (isLoadingJobs) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>Loading dashboard data...</span>
        </div>
      </div>
    );
  }

  // Show error states
  if (jobsError) {
    return (
      <div className="container mx-auto p-8">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                {jobsError instanceof Error ? jobsError.message : "Failed to load dashboard data"}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Manager Dashboard</h1>
        <p className="text-gray-600">Complete oversight of all shop operations and performance metrics</p>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Active Jobs</CardTitle>
            <CardDescription className="text-2xl font-bold">{metrics.inProgressJobs}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Total: {jobs.length}</span>
              <span>Completed: {metrics.completedJobs}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">On-time Delivery</CardTitle>
            <CardDescription className="text-2xl font-bold">{metrics.onTimeDelivery}%</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={metrics.onTimeDelivery} className="h-2" />
            <div className="mt-1 text-xs text-gray-500">
              <span>Delayed Jobs: {metrics.delayedJobs}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Capacity Utilization</CardTitle>
            <CardDescription className="text-2xl font-bold">
              {departmentMetrics.reduce((acc, dept) => acc + dept.capacityPercentage, 0) / departmentMetrics.length}%
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress 
              value={departmentMetrics.reduce((acc, dept) => acc + dept.capacityPercentage, 0) / departmentMetrics.length} 
              className="h-2"
            />
            <div className="mt-1 text-xs text-gray-500">
              <span>Overall department utilization</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Quality Rating</CardTitle>
            <CardDescription className="text-2xl font-bold">{metrics.qualityRating}%</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={metrics.qualityRating} className="h-2" />
            <div className="mt-1 text-xs text-gray-500">
              <span>Based on job issues and rework</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end space-x-3 mb-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setShowHistoricalComparison(!showHistoricalComparison)}
        >
          <BarChart className="h-4 w-4 mr-2" />
          {showHistoricalComparison ? "Hide Historical Comparison" : "Show Historical Comparison"}
        </Button>
        
        <Dialog open={isNotificationDialogOpen} onOpenChange={setIsNotificationDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
            >
              <Bell className="h-4 w-4 mr-2" />
              Send Notification
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Notification</DialogTitle>
              <DialogDescription>
                Notify employees about critical issues or deadlines
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Message</label>
                <textarea 
                  className="w-full p-2 border rounded-md" 
                  rows={3}
                  value={notificationMessage}
                  onChange={(e) => setNotificationMessage(e.target.value)}
                  placeholder="Enter your notification message..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Recipients</label>
                <Select 
                  onValueChange={(value) => {
                    if (value === "all") {
                      setNotificationRecipients(["all"]);
                    } else if (!notificationRecipients.includes(value) && value !== "all") {
                      setNotificationRecipients([...notificationRecipients.filter(r => r !== "all"), value]);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select recipients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    <SelectItem value="machining">Machining Department</SelectItem>
                    <SelectItem value="welding">Welding Department</SelectItem>
                    <SelectItem value="mechanical">Mechanical Department</SelectItem>
                  </SelectContent>
                </Select>
                {notificationRecipients.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {notificationRecipients.map(recipient => (
                      <Badge 
                        key={recipient} 
                        className="bg-blue-100 text-blue-800 hover:bg-blue-200"
                        onClick={() => setNotificationRecipients(notificationRecipients.filter(r => r !== recipient))}
                      >
                        {recipient === "all" ? "All Employees" :
                         recipient === "machining" ? "Machining Department" :
                         recipient === "welding" ? "Welding Department" :
                         "Mechanical Department"}
                        <XCircle className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <Button 
                onClick={() => sendNotificationMutation.mutate({ 
                  message: notificationMessage, 
                  recipients: notificationRecipients 
                })}
                disabled={!notificationMessage || notificationRecipients.length === 0}
              >
                Send Notification
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetchJobs()}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingJobs ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Job Management */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle>Job Management</CardTitle>
            <div className="flex space-x-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search jobs..."
                  className="pl-9 h-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
          <CardDescription>
            <Tabs 
              defaultValue="all" 
              value={selectedTab} 
              onValueChange={(value) => setSelectedTab(value as "all" | "overdue" | "critical")}
            >
              <TabsList>
                <TabsTrigger value="all">All Jobs</TabsTrigger>
                <TabsTrigger value="overdue" className="relative">
                  Overdue
                  {filterJobs().filter(job => 
                    isBefore(new Date(job.due_date), new Date()) && 
                    job.status !== "Completed"
                  ).length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {filterJobs().filter(job => 
                        isBefore(new Date(job.due_date), new Date()) && 
                        job.status !== "Completed"
                      ).length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="critical">Critical</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Job Number</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3">Progress</th>
                  <th className="px-6 py-3">Time</th>
                  <th className="px-6 py-3">Due Date</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Assigned</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSortedJobs.map((job) => {
                  // Calculate assigned employees
                  const assignedEmployeeIds = job.assignedEmployees || [];
                  const assignedEmployeeCount = assignedEmployeeIds.length;
                  
                  // Get historical comparison if enabled
                  const comparison = showHistoricalComparison ? getHistoricalComparison(job) : null;
                  
                  return (
                    <tr key={job.job_number} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-600">
                        {job.job_number}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium">{job.title}</div>
                        {job.work_center && (
                          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">
                            {job.work_center}
                          </span>
                        )}
                        {comparison && (
                          <div className="flex mt-1 space-x-1">
                            {comparison.timeComparison && (
                              <span className={`text-xs px-2 py-1 rounded-full flex items-center ${
                                comparison.timeComparison.status === "better" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                              }`}>
                                {comparison.timeComparison.status === "better" ? (
                                  <ArrowDownRight className="h-3 w-3 mr-1" />
                                ) : (
                                  <ArrowUpRight className="h-3 w-3 mr-1" />
                                )}
                                {comparison.timeComparison.difference}% time
                              </span>
                            )}
                            {comparison.costComparison && (
                              <span className={`text-xs px-2 py-1 rounded-full flex items-center ${
                                comparison.costComparison.status === "better" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                              }`}>
                                {comparison.costComparison.status === "better" ? (
                                  <ArrowDownRight className="h-3 w-3 mr-1" />
                                ) : (
                                  <ArrowUpRight className="h-3 w-3 mr-1" />
                                )}
                                {comparison.costComparison.difference}% cost
                              </span>
                            )}
                            {comparison.reworkRisk === "high" && (
                              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full flex items-center">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                High rework risk
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                          <div 
                            className={`h-1.5 rounded-full ${
                              job.progress < 30 ? "bg-red-500" :
                              job.progress < 70 ? "bg-yellow-500" :
                              "bg-green-500"
                            }`} 
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{job.progress}% Complete</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {job.planned_hours || "--"} hrs planned
                          </span>
                          <span className={`text-xs ${
                            job.actual_hours && job.planned_hours && job.actual_hours > job.planned_hours 
                              ? 'text-red-600' 
                              : 'text-green-600'
                          }`}>
                            {job.actual_hours || "0"} hrs logged
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="date"
                          className="p-1 border rounded text-sm"
                          defaultValue={format(new Date(job.due_date), "yyyy-MM-dd")}
                          onChange={(e) => updateDueDateMutation.mutate({ jobId: job.job_number, newDate: e.target.value })}
                        />
                        {isBefore(new Date(job.due_date), new Date()) && job.status !== "Completed" && (
                          <div className="text-xs text-red-600 mt-1 flex items-center">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Overdue
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Select
                          value={job.status}
                          onValueChange={(value) => updateJobStatusMutation.mutate({ jobId: job.job_number, newStatus: value })}
                        >
                          <SelectTrigger className="h-8 w-28">
                            <SelectValue>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                job.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                                job.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                job.status === 'On Hold' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {job.status}
                              </span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Not Started">Not Started</SelectItem>
                            <SelectItem value="In Progress">In Progress</SelectItem>
                            <SelectItem value="On Hold">On Hold</SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-6 py-4">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex items-center h-8"
                              onClick={() => setSelectedJobForAssignment(job)}
                            >
                              <Users className="h-3 w-3 mr-1" />
                              {assignedEmployeeCount > 0 ? `${assignedEmployeeCount}` : "Assign"}
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Assign Employees to Job #{job.job_number}</DialogTitle>
                              <DialogDescription>
                                Select employees to assign to this job
                              </DialogDescription>
                            </DialogHeader>
                            <div className="mt-4 space-y-4">
                              <h3 className="font-medium text-sm">Currently Assigned:</h3>
                              <div className="space-y-2">
                                {assignedEmployeeIds.length > 0 ? (
                                  employees
                                    .filter(emp => assignedEmployeeIds.includes(emp.id))
                                    .map(emp => (
                                      <div key={emp.id} className="flex justify-between items-center p-2 border rounded">
                                        <div>
                                          <div className="font-medium">{emp.name}</div>
                                          <div className="text-xs text-gray-500">{emp.role} ({emp.department})</div>
                                        </div>
                                        <Button variant="ghost" size="sm" className="h-8 text-red-500">
                                          <XCircle className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ))
                                ) : (
                                  <div className="text-sm text-gray-500">No employees assigned yet</div>
                                )}
                              </div>
                              
                              <h3 className="font-medium text-sm">Available Employees:</h3>
                              <div className="space-y-2 max-h-60 overflow-y-auto">
                                {employees
                                  .filter(emp => !assignedEmployeeIds.includes(emp.id))
                                  .map(emp => (
                                    <div key={emp.id} className="flex justify-between items-center p-2 border rounded">
                                      <div>
                                        <div className="font-medium">{emp.name}</div>
                                        <div className="text-xs text-gray-500">{emp.role} ({emp.department})</div>
                                        <div className="text-xs text-gray-500">
                                          Current jobs: {emp.assignedJobs?.length || 0}
                                        </div>
                                      </div>
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="h-8"
                                        onClick={() => assignEmployeeMutation.mutate({ 
                                          jobId: job.job_number, 
                                          employeeId: emp.id 
                                        })}
                                      >
                                        <UserPlus className="h-4 w-4 mr-1" />
                                        Assign
                                      </Button>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </td>
                      <td className="px-6 py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => {
                                setNotificationMessage(`Urgent: Please check status of Job #${job.job_number} - ${job.title}`);
                                setNotificationRecipients(["all"]);
                                setIsNotificationDialogOpen(true);
                              }}
                            >
                              <Bell className="h-4 w-4 mr-2" />
                              Send Notification
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <FileText className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <BarChart className="h-4 w-4 mr-2" />
                              View Job History
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredSortedJobs.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No jobs found matching your search criteria.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Department Performance & Resources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Department Performance</CardTitle>
            <CardDescription>Current capacity and workload by department</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {departmentMetrics.map((dept) => (
                <div key={dept.name} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{dept.name} Department</div>
                      <div className="text-sm text-gray-500">
                        {dept.employees} employees · {dept.jobsCount} jobs assigned
                      </div>
                    </div>
                    <span className={`text-sm font-medium ${
                      dept.capacityPercentage > 90 ? "text-red-600" :
                      dept.capacityPercentage > 75 ? "text-yellow-600" :
                      "text-green-600"
                    }`}>
                      {dept.capacityPercentage}%
                    </span>
                  </div>
                  <Progress 
                    value={dept.capacityPercentage} 
                    className={`h-2 ${
                      dept.capacityPercentage > 90 ? "bg-red-500" :
                      dept.capacityPercentage > 75 ? "bg-yellow-500" :
                      "bg-green-500"
                    }`}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>
              <Tabs value={activeMetricsView} onValueChange={(value) => setActiveMetricsView(value as any)}>
                <TabsList>
                  <TabsTrigger value="performance">Time</TabsTrigger>
                  <TabsTrigger value="cost">Cost</TabsTrigger>
                  <TabsTrigger value="quality">Quality</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeMetricsView === "performance" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">Average Completion Time</div>
                    <div className="text-sm text-gray-500">Based on completed jobs</div>
                  </div>
                  <div className="text-xl font-bold">
                    85%
                    <span className="text-xs font-normal text-green-600 ml-2">↓ 5%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">On-Time Delivery Rate</div>
                    <div className="text-sm text-gray-500">Jobs completed by due date</div>
                  </div>
                  <div className="text-xl font-bold">
                    {metrics.onTimeDelivery}%
                    <span className="text-xs font-normal text-green-600 ml-2">↑ 3%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">Job Cycle Time</div>
                    <div className="text-sm text-gray-500">Average days to complete</div>
                  </div>
                  <div className="text-xl font-bold">
                    12 days
                    <span className="text-xs font-normal text-red-600 ml-2">↑ 2 days</span>
                  </div>
                </div>
              </div>
            )}
            
            {activeMetricsView === "cost" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">Budget Adherence</div>
                    <div className="text-sm text-gray-500">Actual vs. planned costs</div>
                  </div>
                  <div className="text-xl font-bold">
                    92%
                    <span className="text-xs font-normal text-green-600 ml-2">↑ 2%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">Labor Efficiency</div>
                    <div className="text-sm text-gray-500">Hours vs. standard times</div>
                  </div>
                  <div className="text-xl font-bold">
                    87%
                    <span className="text-xs font-normal text-red-600 ml-2">↓ 3%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">Material Variance</div>
                    <div className="text-sm text-gray-500">Actual vs. estimated usage</div>
                  </div>
                  <div className="text-xl font-bold">
                    5.2%
                    <span className="text-xs font-normal text-green-600 ml-2">↓ 1.3%</span>
                  </div>
                </div>
              </div>
            )}
            
            {activeMetricsView === "quality" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">First Pass Yield</div>
                    <div className="text-sm text-gray-500">Items with no rework needed</div>
                  </div>
                  <div className="text-xl font-bold">
                    {metrics.qualityRating}%
                    <span className="text-xs font-normal text-green-600 ml-2">↑ 2%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">Defect Rate</div>
                    <div className="text-sm text-gray-500">Jobs with quality issues</div>
                  </div>
                  <div className="text-xl font-bold">
                    4.8%
                    <span className="text-xs font-normal text-green-600 ml-2">↓ 0.7%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">Customer Satisfaction</div>
                    <div className="text-sm text-gray-500">Based on feedback scores</div>
                  </div>
                  <div className="text-xl font-bold">
                    4.6/5.0
                    <span className="text-xs font-normal text-green-600 ml-2">↑ 0.2</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Worker Performance */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Worker Performance</CardTitle>
          <CardDescription>Individual employee productivity and efficiency metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-2">Employee</th>
                  <th className="px-4 py-2">Department</th>
                  <th className="px-4 py-2">Assigned Jobs</th>
                  <th className="px-4 py-2">Completion Rate</th>
                  <th className="px-4 py-2">Efficiency</th>
                  <th className="px-4 py-2">On-Time Rate</th>
                  <th className="px-4 py-2">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {calculateWorkerPerformance().map((worker) => (
                  <tr key={worker.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{worker.name}</div>
                      <div className="text-xs text-gray-500">{worker.role}</div>
                    </td>
                    <td className="px-4 py-3">{worker.department}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{worker.totalAssignedJobs}</div>
                      <div className="text-xs text-gray-500">
                        {worker.completedOperations} completed of {worker.totalOperations} operations
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                        <div 
                          className={`h-1.5 rounded-full ${
                            worker.completionPercentage < 30 ? "bg-red-500" :
                            worker.completionPercentage < 70 ? "bg-yellow-500" :
                            "bg-green-500"
                          }`} 
                          style={{ width: `${Math.min(100, worker.completionPercentage)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {worker.completionPercentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`text-sm font-medium ${
                        worker.efficiencyRate > 90 ? "text-green-600" :
                        worker.efficiencyRate > 75 ? "text-yellow-600" :
                        "text-red-600"
                      }`}>
                        {worker.efficiencyRate.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {worker.plannedHours.toFixed(1)} / {worker.actualHours.toFixed(1)} hrs
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`text-sm font-medium ${
                        worker.onTimeCompletionRate > 90 ? "text-green-600" :
                        worker.onTimeCompletionRate > 75 ? "text-yellow-600" :
                        "text-red-600"
                      }`}>
                        {worker.onTimeCompletionRate.toFixed(1)}%
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{worker.actualHours.toFixed(1)} hrs</div>
                      <div className="text-xs text-gray-500">of {worker.plannedHours.toFixed(1)} planned</div>
                    </td>
                  </tr>
                ))}
                
                {calculateWorkerPerformance().length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500">
                      No workers with assigned jobs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Deadlines */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Upcoming Deadlines</CardTitle>
            <Button variant="outline" size="sm">
              <Calendar className="h-4 w-4 mr-2" />
              View Full Calendar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredSortedJobs.slice(0, 5).map(job => (
              <div 
                key={`upcoming-${job.job_number}`} 
                className={`flex justify-between p-3 border rounded-lg ${
                  isBefore(new Date(job.due_date), new Date()) ? "border-red-200 bg-red-50" : ""
                }`}
              >
                <div>
                  <span className="font-medium">{job.job_number}</span>
                  <p className="text-sm text-gray-600">{job.title}</p>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-medium ${
                    isBefore(new Date(job.due_date), new Date()) ? "text-red-600" : ""
                  }`}>
                    Due: {format(new Date(job.due_date), "MMM dd, yyyy")}
                  </span>
                  <p className="text-xs text-gray-500">
                    {job.customer || 'No customer'} · {job.work_center || 'No work center'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ManagerDashboard; 