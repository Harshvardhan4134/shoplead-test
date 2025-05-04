// @ts-nocheck
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isBefore, isAfter, addDays } from "date-fns";
import { useState, useEffect, useMemo } from "react";
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
  MoreVertical,
  Clipboard,
  Save,
  Truck,
  Activity
} from "lucide-react";
import { api } from "@/services/api";
import { Job, WorkOrder, Employee } from "@/shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
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
import { calculateCost, recalculateJobMetrics, processJob, formatJob } from "@/utils/jobUtils";
import JobRow from "@/components/JobRow";
import { useJobManager } from "@/hooks/useJobManager";
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import ManagerNavbar from "@/components/layout/ManagerNavbar";

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const ManagerDashboard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { addNotification } = useAuth();

  // Use the job manager hook
  const {
    jobs,
    isLoadingJobs,
    jobsError,
    refetchJobs,
    updateJobFieldMutation,
    updateReferenceNameMutation,
    updateDueDateMutation,
    updateJobStatusMutation
  } = useJobManager();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState<"all" | "overdue" | "critical">("all");
  const [showHistoricalComparison, setShowHistoricalComparison] = useState(false);
  const [selectedJobForAssignment, setSelectedJobForAssignment] = useState<Job | null>(null);
  const [isNotificationDialogOpen, setIsNotificationDialogOpen] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationRecipients, setNotificationRecipients] = useState<string[]>([]);
  const [activeMetricsView, setActiveMetricsView] = useState<"performance" | "cost" | "quality">("performance");
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportJobId, setReportJobId] = useState<string | null>(null);
  const [reportMessage, setReportMessage] = useState("");

  // State for editable fields
  const [editableJobData, setEditableJobData] = useState<Record<string, {
    reference_name?: string;
    due_date?: string;
  }>>({});

  const [activeEditingJob, setActiveEditingJob] = useState<string | null>(null);

  // Add a new state to track the selected job for KPI view
  const [selectedJobForKPI, setSelectedJobForKPI] = useState<any>(null);

  // Add state for active panel
  const [activePanel, setActivePanel] = useState<string | null>(null);

  // Handle reference name changes
  const handleReferenceNameChange = (jobId: string, value: string) => {
    setEditableJobData(prev => ({
      ...prev,
      [jobId]: {
        ...prev[jobId],
        reference_name: value
      }
    }));
  };

  const {
    data: checkInData = [],
    isLoading: isLoadingCheckIns
  } = useQuery({
    queryKey: ["/api/employee-checkins"],
    queryFn: async () => {
      // Mock data for check-ins/check-outs
      return [
        { employeeId: 1, name: "John Doe", checkInTime: "2023-06-01T08:00:00", checkOutTime: "2023-06-01T16:30:00", status: "checked-out" },
        { employeeId: 2, name: "Jane Smith", checkInTime: "2023-06-01T07:45:00", checkOutTime: null, status: "checked-in" },
        { employeeId: 3, name: "Bob Johnson", checkInTime: "2023-06-01T08:15:00", checkOutTime: null, status: "checked-in" },
        { employeeId: 4, name: "Sarah Wilson", checkInTime: "2023-06-01T08:30:00", checkOutTime: "2023-06-01T17:00:00", status: "checked-out" },
      ];
    }
  });

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
        { id: 10, name: "Jessica Taylor", department: "Mechanical", role: "Lead Mechanic", assignedJobs: [10] }
      ];
    }
  });

  const {
    data: historicalJobs = [],
    isLoading: isLoadingHistorical
  } = useQuery({
    queryKey: ["/api/historical-jobs"],
    queryFn: async () => {
      return jobs.map(job => ({
        ...job,
        id: `historical-${job.id}`,
        actual_hours: job.planned_hours ? Math.floor(job.planned_hours * (0.8 + Math.random() * 0.4)) : undefined,
        status: "Completed",
        completion_date: format(addDays(new Date(job.due_date), -Math.floor(Math.random() * 10)), "yyyy-MM-dd"),
        actual_cost: job.planned_cost ? job.planned_cost * (0.85 + Math.random() * 0.3) : undefined,
        rework_percentage: Math.random() > 0.7 ? Math.floor(Math.random() * 15) : 0
      }));
    },
    enabled: showHistoricalComparison
  });

  // Add the Work Center data query with improved data validation
  const {
    data: workCenters = [],
    isLoading: isLoadingWorkCenters
  } = useQuery({
    queryKey: ["/api/work-centers"],
    queryFn: async () => {
      try {
        // Try to use the API service first
        const apiWorkCenters = await api.getWorkCenters?.();

        // Process and validate the work centers data
        const processWorkCenters = (centers) => {
          if (!centers || !Array.isArray(centers)) return [];

          return centers.map(wc => ({
            id: wc.id || wc.name || String(Math.random()),
            name: wc.name || 'Unknown',
            availableWork: Number(wc.availableWork) || 0,
            backlog: Number(wc.backlog) || 0
          }));
        };

        // If we got data from the API, validate and return it
        if (apiWorkCenters && apiWorkCenters.length > 0) {
          return processWorkCenters(apiWorkCenters);
        }

        // Fallback to mock data based on the Work Center Summary screenshot
        const mockWorkCenters = [
          { id: 'ASSEMBLY', name: 'ASSEMBLY', availableWork: 49.65, backlog: 333.60 },
          { id: 'BALANCE', name: 'BALANCE', availableWork: 84.42, backlog: 38.90 },
          { id: 'BUILD', name: 'BUILD', availableWork: 0.00, backlog: 34.00 },
          { id: 'CD', name: 'CD', availableWork: 134.71, backlog: 362.00 },
          { id: 'DNI', name: 'DNI', availableWork: 70.71, backlog: 86.20 },
          { id: 'DRLPRESS', name: 'DRLPRESS', availableWork: 21.78, backlog: 0.00 },
          { id: 'HBM', name: 'HBM', availableWork: 191.24, backlog: 0.00 },
          { id: 'HYDRO', name: 'HYDRO', availableWork: 53.91, backlog: 45.50 },
          { id: 'INSPECT', name: 'INSPECT', availableWork: 48.17, backlog: 199.70 },
          { id: 'KEY', name: 'KEY', availableWork: 0.25, backlog: 0.00 },
          { id: 'LATHE', name: 'LATHE', availableWork: 53.86, backlog: 172.80 },
          { id: 'MACHINING', name: 'MACHINING', availableWork: 40.83, backlog: 106.10 }
        ];

        return processWorkCenters(mockWorkCenters);
      } catch (error) {
        console.error("Error fetching work centers:", error);
        return [];
      }
    }
  });

  // Add this logging function after the jobs query
  useEffect(() => {
    // Log the data mapping to help with debugging
    if (jobs && jobs.length > 0) {
      console.log("Sample job data mapped:", {
        first_job: jobs[0],
        fields: {
          planned_hours: jobs[0].planned_hours,
          actual_hours: jobs[0].actual_hours,
          projected_hours: jobs[0].projected_hours,
          planned_cost: jobs[0].planned_cost,
          actual_cost: jobs[0].actual_cost,
          projected_cost: jobs[0].projected_cost,
          order_value: jobs[0].order_value,
          margin: jobs[0].margin,
          profit_value: jobs[0].profit_value
        }
      });
    }
  }, [jobs]);

  // Add API service integration to fetch data directly from the API endpoint
  useEffect(() => {
    const fetchJobData = async () => {
      try {
        console.log("Fetching data from API...");
        const response = await fetch('/api/manager/active_jobs');
        if (!response.ok) throw new Error('Failed to fetch job data');
        
        const data = await response.json();
        console.log("API Data received:", data);
        
        // Store the raw API data
        queryClient.setQueryData(["api_job_data"], data);
        
        // Extract financial metrics from the API response
        const { active_summary, di_summary, totals } = data;
        
        // Set these values directly to ensure they're available
        queryClient.setQueryData(["job_summary_metrics"], {
          total_planned_hours: parseFloat(totals.total_planned_hours) || 0,
          total_actual_hours: parseFloat(totals.total_actual_hours) || 0,
          total_projected_hours: parseFloat(totals.total_projected_hours) || 0,
          total_planned_cost: parseFloat(totals.total_planned_cost) || 0,
          total_actual_cost: parseFloat(totals.total_actual_cost) || 0,
          total_projected_cost: parseFloat(totals.total_projected_cost) || 0,
          active_jobs: active_summary
        });
      } catch (error) {
        console.error("Error fetching job data:", error);
      }
    };
    
    fetchJobData();
  }, [queryClient]);

  // Get the metrics data from the query cache
  const {
    data: summaryMetrics = {
      total_planned_hours: 0,
      total_actual_hours: 0,
      total_projected_hours: 0,
      total_planned_cost: 0,
      total_actual_cost: 0,
      total_projected_cost: 0,
      active_jobs: []
    }
  } = useQuery({
    queryKey: ["job_summary_metrics"],
    enabled: false // Don't fetch, just read from cache
  });

  // Process jobs with proper formatting and calculations, now using API data where available
  const processedJobs = useMemo(() => {
    if (!jobs) return [];
    
    // First try to use data from the API if available
    const apiJobData = queryClient.getQueryData<any>(["api_job_data"]);
    if (apiJobData?.active_summary?.length > 0) {
      console.log("Using API job data:", apiJobData.active_summary.length, "jobs");
      
      // Map API data to job format
      return apiJobData.active_summary.map((job: any) => {
        // Parse numerical values from strings
        const planned_hours = parseFloat(job.total_planned_hours?.replace(',', '') || '0');
        const actual_hours = parseFloat(job.total_actual_hours?.replace(',', '') || '0');
        const projected_hours = parseFloat(job.projected_hours?.replace(',', '') || '0');
        const planned_cost = parseFloat(job.total_planned_cost?.replace(',', '').replace('$', '') || '0');
        const actual_cost = parseFloat(job.total_actual_cost?.replace(',', '').replace('$', '') || '0');
        const projected_cost = parseFloat(job.projected_cost?.replace(',', '').replace('$', '') || '0');
        const order_value = job.order_value && job.order_value !== 'N/A' 
          ? parseFloat(job.order_value.replace(',', '').replace('$', '') || '0')
          : 0;
        const profit_value = job.profit_value && job.profit_value !== 'N/A'
          ? parseFloat(job.profit_value.replace(',', '').replace('$', '') || '0')
          : 0;
        const profit_margin = job.profit_margin && job.profit_margin !== 'N/A'
          ? parseFloat(job.profit_margin.replace(',', '').replace('%', '') || '0')
          : 0;
          
        return {
          ...job,
          job_number: job.job_number,
          title: job.reference_name || job.job_number,
          reference_name: job.reference_name,
          due_date: job.due_date,
          planned_hours,
          actual_hours,
          projected_hours,
          planned_cost,
          actual_cost,
          projected_cost,
          order_value,
          profit_value,
          margin: profit_margin,
          progress: calculateProgress(actual_hours, planned_hours),
          work_center: job.work_center || 'Unknown'
        };
      });
    }
    
    // Fall back to the existing processing if API data isn't available
    return jobs.map(job => {
      const processedJob = formatJob(processJob(job));
      return recalculateJobMetrics(processedJob);
    });
  }, [jobs, queryClient]);
  
  // Helper function to calculate progress percentage
  const calculateProgress = (actual: number, planned: number) => {
    if (!planned || planned === 0) return 0;
    return Math.min(Math.round((actual / planned) * 100), 100);
  };

  // Add this useEffect to log data for debugging
  useEffect(() => {
    if (processedJobs && processedJobs.length > 0) {
      console.log("Processed job data example:", {
        job: processedJobs[0],
        financial_fields: {
          planned_hours: processedJobs[0].planned_hours,
          actual_hours: processedJobs[0].actual_hours,
          projected_hours: processedJobs[0].projected_hours,
          planned_cost: processedJobs[0].planned_cost,
          actual_cost: processedJobs[0].actual_cost,
          projected_cost: processedJobs[0].projected_cost,
        }
      });
    }
  }, [processedJobs]);

  // Filter jobs based on tab and search query
  const filterJobs = () => {
    // Filter active jobs first
    const active = processedJobs?.filter(job =>
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
  const metrics = useMemo(() => {
    const totalJobs = processedJobs.length;
    const completedJobs = processedJobs.filter(job => job.status === "Completed").length;
    const inProgressJobs = processedJobs.filter(job => job.status === "In Progress").length;
    const scheduledJobs = processedJobs.filter(job => job.status === "New").length;
    const delayedJobs = processedJobs.filter(job => {
      const dueDate = new Date(job.due_date);
      return dueDate < new Date() && job.status !== "Completed";
    }).length;

    const onTimeDelivery = totalJobs > 0 ?
      Number(((completedJobs - delayedJobs) / totalJobs * 100).toFixed(0)) : 0;

    const qualityRating = totalJobs > 0 ?
      Number(((totalJobs - processedJobs.filter(job => job.had_issues).length) / totalJobs * 100).toFixed(0)) : 0;

    return {
      totalJobs,
      completedJobs,
      inProgressJobs,
      scheduledJobs,
      delayedJobs,
      onTimeDelivery,
      qualityRating
    };
  }, [processedJobs]);

  // Add worker performance calculation function after calculateMetrics
  const calculateWorkerPerformance = () => {
    // Extract all operations from all jobs with proper type checking
    const allOperations = jobs.flatMap(job => {
      if (job.operations) {
        return job.operations;
      }
      if (job.work_orders && Array.isArray(job.work_orders)) {
        return job.work_orders.flatMap(wo => wo.operations || []);
      }
      return [];
    });

    // Group operations by worker/employee
    const workerMap = new Map();

    // Initialize worker stats for all employees
    employees.forEach(emp => {
      // Get check-in status for this employee
      const checkInInfo = checkInData.find(c => c.employeeId === emp.id);

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
        efficiencyRate: 100,
        onTimeCompletionRate: 100,
        completionPercentage: 0,
        jobsData: [],
        checkInStatus: checkInInfo?.status || "not-checked-in",
        checkInTime: checkInInfo?.checkInTime || null,
        checkOutTime: checkInInfo?.checkOutTime || null
      });
    });

    // Add job data to appropriate workers with proper type checking
    jobs.forEach(job => {
      const assignedEmployeeIds = job.assignedEmployees || [];

      assignedEmployeeIds.forEach(empId => {
        const workerData = workerMap.get(empId);
        if (workerData) {
          // Count job's operations by status with safe access
          const operations = job.operations || [];
          const completedOps = operations.filter(op => op?.status === 'Complete')?.length || 0;
          const inProgressOps = operations.filter(op => op?.status === 'In Progress')?.length || 0;
          const totalOps = operations.length || 0;

          // Update worker stats with safe number operations
          workerData.completedOperations += completedOps;
          workerData.inProgressOperations += inProgressOps;
          workerData.totalOperations += totalOps;
          workerData.plannedHours += Number(job.total_planned_hours || 0);
          workerData.actualHours += Number(job.total_actual_hours || 0);

          // Add job data with proper type checking
          workerData.jobsData.push({
            job_number: job.job_number,
            planned_hours: Number(job.total_planned_hours || 0),
            actual_hours: Number(job.total_actual_hours || 0),
            is_overdue: job.is_overdue || false,
            completion_percentage: Number(job.completion_percentage || 0),
            due_date: job.due_date
          });

          // Calculate metrics safely
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
      .filter(worker => worker.totalAssignedJobs > 0)
      .sort((a, b) => b.completionPercentage - a.completionPercentage);
  };

  // Add robust data preparation for KPI data
  const prepareJobKpiData = (job: any) => {
    if (!job) return null;
    console.log("Preparing job KPI data for:", job.job_number);

    // Look for API data for this job from the API query data
    const apiJobData = queryClient.getQueryData<any>(["api_job_data"]);
    let apiJob = null;
    
    if (apiJobData?.active_summary) {
      apiJob = apiJobData.active_summary.find((j: any) => j.job_number === job.job_number);
      if (apiJob) {
        console.log("Found API job data for:", job.job_number);
      }
    }
    
    // First process the job to ensure all fields are calculated properly
    let processedJob = recalculateJobMetrics(formatJob(processJob(job)));
    
    // If we have API data for this job, use financial metrics from the API
    if (apiJob) {
      processedJob = {
        ...processedJob,
        planned_hours: parseFloat(apiJob.total_planned_hours?.replace(',', '') || '0'),
        actual_hours: parseFloat(apiJob.total_actual_hours?.replace(',', '') || '0'),
        projected_hours: parseFloat(apiJob.projected_hours?.replace(',', '') || '0'),
        planned_cost: parseFloat(apiJob.total_planned_cost?.replace(',', '').replace('$', '') || '0'),
        actual_cost: parseFloat(apiJob.total_actual_cost?.replace(',', '').replace('$', '') || '0'),
        projected_cost: parseFloat(apiJob.projected_cost?.replace(',', '').replace('$', '') || '0'),
        order_value: apiJob.order_value && apiJob.order_value !== 'N/A' 
          ? parseFloat(apiJob.order_value.replace(',', '').replace('$', '') || '0')
          : processedJob.order_value,
        profit_value: apiJob.profit_value && apiJob.profit_value !== 'N/A'
          ? parseFloat(apiJob.profit_value.replace(',', '').replace('$', '') || '0')
          : processedJob.profit_value,
        margin: apiJob.profit_margin && apiJob.profit_margin !== 'N/A'
          ? parseFloat(apiJob.profit_margin.replace(',', '').replace('%', '') || '0')
          : processedJob.margin
      };
    }
    
    // Log the processed financial metrics
    console.log("Processed job with financial metrics:", {
      planned_hours: processedJob.planned_hours,
      actual_hours: processedJob.actual_hours,
      projected_hours: processedJob.projected_hours,
      planned_cost: processedJob.planned_cost,
      actual_cost: processedJob.actual_cost,
      projected_cost: processedJob.projected_cost,
    });
    
    // Ensure operations exists and is properly formatted
    processedJob.operations = processedJob.operations || [];

    // If operations are nested in work_orders, extract them
    if ((!processedJob.operations || processedJob.operations.length === 0) &&
      processedJob.work_orders && Array.isArray(processedJob.work_orders)) {
      processedJob.operations = processedJob.work_orders.flatMap(wo => wo.operations || []);
      console.log(`Extracted ${processedJob.operations.length} operations from work_orders`);
    }

    // If we still don't have operations, generate sample operations data
    if (!processedJob.operations || processedJob.operations.length === 0) {
      // Generate realistic operations based on job's financial values
      const totalHours = processedJob.planned_hours || 25.5;
      const totalCost = processedJob.planned_cost || 3250.00;
      
      // Split the hours and cost into logical operations
      processedJob.operations = [
        {
          part: "Component 1",
          work_center: "MACHINING",
          task: "Machining operation",
          planned_hours: totalHours * 0.35,
          actual_hours: (processedJob.actual_hours || 0) * 0.4,
          status: "Complete",
          cost_planned: totalCost * 0.35,
          cost_actual: (processedJob.actual_cost || 0) * 0.4
        },
        {
          part: "Component 2",
          work_center: "LATHE",
          task: "Lathe operation",
          planned_hours: totalHours * 0.15,
          actual_hours: (processedJob.actual_hours || 0) * 0.15,
          status: "Complete",
          cost_planned: totalCost * 0.15,
          cost_actual: (processedJob.actual_cost || 0) * 0.15
        },
        {
          part: "Housing",
          work_center: "HBM",
          task: "Housing preparation",
          planned_hours: totalHours * 0.2,
          actual_hours: (processedJob.actual_hours || 0) * 0.2,
          status: "In Progress",
          cost_planned: totalCost * 0.2,
          cost_actual: (processedJob.actual_cost || 0) * 0.2
        },
        {
          part: "Assembly",
          work_center: "ASSEMBLY",
          task: "Final assembly",
          planned_hours: totalHours * 0.3,
          actual_hours: (processedJob.actual_hours || 0) * 0.05,
          status: "In Progress",
          cost_planned: totalCost * 0.3,
          cost_actual: (processedJob.actual_cost || 0) * 0.05
        }
      ];
    }

    // Add task costs data based on real operations
    processedJob.task_costs = processedJob.operations
      .filter(op => op.cost_planned > 0 || op.cost_actual > 0)
      .map(op => ({
        task: op.task || op.task_description || "Operation",
        part: op.part || op.part_name || "Part",
        work_center: op.work_center || "MACHINING",
        planned_cost: op.cost_planned || op.planned_hours * 100,
        actual_cost: op.cost_actual || op.actual_hours * 100
      }))
      .slice(0, 4); // Take top 4 by cost

    // If we don't have any task costs, generate them from job data
    if (!processedJob.task_costs || processedJob.task_costs.length === 0) {
      const totalCost = processedJob.planned_cost || 3250.00;
      processedJob.task_costs = [
        {
          task: "Primary operation",
          part: "Main component",
          work_center: "MACHINING",
          planned_cost: totalCost * 0.4,
          actual_cost: (processedJob.actual_cost || 0) * 0.45
        },
        {
          task: "Secondary operation",
          part: "Secondary component",
          work_center: "LATHE",
          planned_cost: totalCost * 0.3,
          actual_cost: (processedJob.actual_cost || 0) * 0.25
        },
        {
          task: "Tertiary operation",
          part: "Tertiary component",
          work_center: "HBM",
          planned_cost: totalCost * 0.2,
          actual_cost: (processedJob.actual_cost || 0) * 0.2
        },
        {
          task: "Final operation",
          part: "Assembly",
          work_center: "ASSEMBLY",
          planned_cost: totalCost * 0.1,
          actual_cost: (processedJob.actual_cost || 0) * 0.1
        }
      ];
    }

    // Add mock idle time data if it doesn't exist
    if (!processedJob.idle_time) {
      const totalActualHours = processedJob.actual_hours || 0;
      processedJob.idle_time = {
        resource_wait: Math.round(totalActualHours * 0.1 * 10) / 10, // ~10% of actual time
        material_wait: Math.round(totalActualHours * 0.15 * 10) / 10, // ~15% of actual time
      };
    }

    // Generate idle operations data based on remaining work
    processedJob.idle_operations = processedJob.operations
      .filter(op => op.status === "Not Started" || (op.planned_hours > op.actual_hours && op.status !== "Complete"))
      .map(op => ({
        part: op.part || op.part_name || "Component",
        work_center: op.work_center || "MACHINING",
        task: op.task || op.task_description || "Operation",
        planned_hours: op.planned_hours - op.actual_hours,
        status: "Not Started"
      }));

    // Ensure we have some idle operations for UI display
    if (!processedJob.idle_operations || processedJob.idle_operations.length === 0) {
      const totalHours = processedJob.planned_hours || 25.5;
      processedJob.idle_operations = [
        {
          part: "Final component",
          work_center: "ASSEMBLY",
          task: "Final operation",
          planned_hours: totalHours * 0.2,
          status: "Not Started"
        },
        {
          part: "Quality check",
          work_center: "INSPECT",
          task: "Inspection",
          planned_hours: totalHours * 0.1,
          status: "Not Started"
        }
      ];
    }

    // Add quantity data for logistics panel based on job value
    const orderValue = processedJob.order_value || 4800.00;
    processedJob.quantity_goods_received = processedJob.quantity_goods_received || Math.round(orderValue / 150);
    processedJob.quantity_goods_to_be_received = processedJob.quantity_goods_to_be_received || Math.round(orderValue / 250);
    processedJob.total_goods_cost = processedJob.planned_cost || 3250.00;

    // Add days until due date
    const dueDate = new Date(processedJob.due_date);
    const today = new Date();
    const timeDiff = dueDate.getTime() - today.getTime();
    const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    processedJob.days_until_due = dayDiff;

    // Add risk assessment
    processedJob.is_at_risk = dayDiff < 3 || (processedJob.progress || 0) < 50;

    // Add delayed purchase orders data if it doesn't exist
    if (!processedJob.delayed_pos) {
      processedJob.delayed_pos = [
        {
          po_number: `PO-${processedJob.job_number}-001`,
          description: "Components",
          expected_delivery: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          days_late: 7,
          pending_value: processedJob.planned_cost * 0.25,
        },
        {
          po_number: `PO-${processedJob.job_number}-002`,
          description: "Raw Materials",
          expected_delivery: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          days_late: 14,
          pending_value: processedJob.planned_cost * 0.4,
        }
      ];
    }

    console.log("Job KPI data prepared with operations:", processedJob.operations?.length || 0);
    return processedJob;
  };

  // Get filtered and sorted jobs
  const filteredSortedJobs = useMemo(() =>
    sortJobs(filterJobs()),
    [processedJobs, searchQuery, selectedTab]
  );
  const departmentMetrics = calculateDepartmentMetrics();

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

  // Show error states with refresh button
  if (jobsError) {
    return (
      <div className="container mx-auto p-8">
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
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
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => refetchJobs()}
            className="flex items-center space-x-2"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            <span>Retry Loading Data</span>
          </Button>
        </div>
      </div>
    );
  }

  // Add this function after prepareJobKpiData
  const navigateToFullKpiPage = (jobNumber) => {
    if (!jobNumber) {
      console.warn("No job number provided to navigateToFullKpiPage()");
      return;
    }

    // In the original implementation, this would redirect to a separate page
    // For this React implementation, we'll show a toast and could later
    // implement a full-page view or redirect to another route

    toast({
      title: "Full KPI View",
      description: `This would navigate to /job_kpi/${jobNumber} in the original implementation`,
    });

    // Close the KPI modal after "navigation"
    setSelectedJobForKPI(null);
  };

  // Add this function to toggle panels
  const toggleKpiPanel = (panelName: string) => {
    console.log("Toggling panel:", panelName, "current:", activePanel);
    setActivePanel(activePanel === panelName ? null : panelName);
  };

  return (
    <div className="flex">
      <ManagerNavbar />
      <div className="ml-16 w-full">
        <div className="container mx-auto p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-1">Manager Dashboard (Updated)</h1>
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
                    onClick={() => {
                      // Implementation of sending notification
                      toast({
                        title: "Notification sent",
                        description: "Your notification has been sent successfully",
                      });

                      // Add to notifications using AuthContext
                      addNotification({
                        title: "Manager Notification",
                        message: notificationMessage,
                        type: 'general'
                      });

                      // Reset form
                      setNotificationMessage("");
                      setNotificationRecipients([]);
                      setIsNotificationDialogOpen(false);
                    }}
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

          {/* Job Management with card-based layout */}
          <div className="mb-6">
            <Card>
              <CardHeader className="pb-3 bg-blue-600 text-white">
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center">
                    <span className="text-xl font-bold">📊 Active Job Summary</span>
                  </CardTitle>
                  <div className="text-xs">Last refreshed: {format(new Date(), "yyyy-MM-dd HH:mm:ss")}</div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Summary metrics at the top */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 p-4 bg-gray-50">
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="text-2xl font-bold">{summaryMetrics.total_planned_hours.toFixed(2)}</div>
                    <div className="text-sm text-gray-500">Planned Hours</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="text-2xl font-bold">{summaryMetrics.total_actual_hours.toFixed(2)}</div>
                    <div className="text-sm text-gray-500">Actual Hours</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="text-2xl font-bold">{summaryMetrics.total_projected_hours.toFixed(2)}</div>
                    <div className="text-sm text-gray-500">Projected Hours</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="text-2xl font-bold">${Number(summaryMetrics.total_planned_cost).toLocaleString()}</div>
                    <div className="text-sm text-gray-500">Planned Cost</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="text-2xl font-bold">${Number(summaryMetrics.total_actual_cost).toLocaleString()}</div>
                    <div className="text-sm text-gray-500">Actual Cost</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="text-2xl font-bold">${Number(summaryMetrics.total_projected_cost).toLocaleString()}</div>
                    <div className="text-sm text-gray-500">Projected Cost</div>
                  </div>
                </div>

                {/* Active Jobs section title */}
                <div className="p-4 bg-gray-100 border-t border-b">
                  <h3 className="text-lg font-semibold flex items-center">
                    <Users className="h-5 w-5 mr-2" /> Active Jobs
                  </h3>
                </div>

                {/* Jobs as cards in a grid */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {filteredSortedJobs.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      <div>
                        <div className="mb-2">No jobs found matching your search criteria.</div>
                        {jobs.length > 0 && (
                          <div className="text-xs text-gray-400">
                            There are {jobs.length} jobs available in total, but they don't match your current filters.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    filteredSortedJobs.map((job) => (
                      <div
                        key={job.job_number}
                        className="border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="border-l-4 border-blue-500 p-3">
                          <div className="flex justify-between items-start">
                            <input
                              className="font-medium text-lg w-full border-none bg-transparent"
                              value={editableJobData[job.job_number]?.reference_name ?? (job.title || job.reference_name || 'Add Reference Name')}
                              onChange={(e) => handleReferenceNameChange(job.job_number, e.target.value)}
                              onFocus={() => setActiveEditingJob(job.job_number)}
                              onBlur={() => {
                                if (editableJobData[job.job_number]?.reference_name) {
                                  updateReferenceNameMutation.mutate({
                                    jobId: job.job_number,
                                    referenceName: editableJobData[job.job_number].reference_name || ''
                                  });
                                }
                              }}
                            />
                            {activeEditingJob === job.job_number && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-green-600"
                                onClick={() => {
                                  if (editableJobData[job.job_number]?.reference_name) {
                                    updateReferenceNameMutation.mutate({
                                      jobId: job.job_number,
                                      referenceName: editableJobData[job.job_number].reference_name || ''
                                    });
                                  }
                                }}
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">#{job.job_number}</div>
                        </div>

                        <div className="p-3 border-t border-gray-100">
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div>
                              <div className="text-xs text-gray-500">Due Date:</div>
                              <input
                                type="date"
                                className="border-none bg-transparent p-0 w-full text-sm"
                                value={editableJobData[job.job_number]?.due_date || format(new Date(job.due_date), "yyyy-MM-dd")}
                                onChange={(e) => {
                                  setEditableJobData(prev => ({
                                    ...prev,
                                    [job.job_number]: {
                                      ...prev[job.job_number],
                                      due_date: e.target.value
                                    }
                                  }));
                                  updateDueDateMutation.mutate({
                                    jobId: job.job_number,
                                    newDate: e.target.value
                                  });
                                }}
                              />
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Profit Margin:</div>
                              <div className="text-sm font-medium">
                                {job.margin ? `${Number(job.margin).toFixed(2)}%` : 'N/A'}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mb-3">
                            <div>
                              <div className="text-xs text-gray-500">Planned:</div>
                              <div className="text-sm">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="border-none bg-transparent p-0 w-full"
                                  value={Number(job.planned_hours || 0).toFixed(2)}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    if (!isNaN(value)) {
                                      updateJobFieldMutation.mutate({
                                        jobId: job.job_number,
                                        field: 'planned_hours',
                                        value: value
                                      });
                                    }
                                  }}
                                /> hrs
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Actual:</div>
                              <div className="text-sm">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="border-none bg-transparent p-0 w-full"
                                  value={Number(job.actual_hours || 0).toFixed(2)}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    if (!isNaN(value)) {
                                      updateJobFieldMutation.mutate({
                                        jobId: job.job_number,
                                        field: 'actual_hours',
                                        value: value
                                      });
                                    }
                                  }}
                                /> hrs
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Projected:</div>
                              <div className="text-sm">
                                <span className={`${Number(job.projected_hours || 0) > Number(job.planned_hours || 0) ? 'text-red-600' : 'text-green-600'}`}>
                                  {Number(job.projected_hours || 0).toFixed(2)}
                                </span> hrs
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-blue-600 border-blue-200 hover:bg-blue-50"
                              onClick={() => {
                                console.log("Setting selectedJobForKPI for job:", job);
                                const preparedData = prepareJobKpiData(job);
                                console.log("Prepared KPI data:", preparedData);
                                setSelectedJobForKPI(preparedData);
                              }}
                            >
                              View Details
                            </Button>

                            <div className="flex space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-600 hover:bg-blue-50"
                                onClick={() => setSelectedJobForAssignment(job)}
                              >
                                <UserPlus className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-600 hover:bg-blue-50"
                                onClick={() => {
                                  setReportJobId(job.job_number);
                                  setIsReportDialogOpen(true);
                                }}
                              >
                                <Clipboard className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {jobs.length > 0 && (
                  <div className="text-xs text-gray-500 p-4 bg-gray-50 border-t">
                    Total: {jobs.length} jobs loaded - {filteredSortedJobs.length} jobs displayed.
                    {filteredSortedJobs.filter(j => !j.planned_cost || !j.actual_cost || !j.projected_cost || !j.order_value || !j.margin || !j.profit_value).length > 0 && (
                      <span className="ml-2 text-yellow-600">
                        Warning: {filteredSortedJobs.filter(j => !j.planned_cost || !j.actual_cost || !j.projected_cost || !j.order_value || !j.margin || !j.profit_value).length} jobs are missing financial data.
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Dismantling & Inspection Jobs */}
          <div className="mb-6">
            <Card>
              <CardHeader className="pb-3 bg-blue-600 text-white">
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center">
                    <span className="text-xl font-bold">🔧 Dismantle & Inspection Summary</span>
                  </CardTitle>
                  <div className="text-xs">Last refreshed: {format(new Date(), "yyyy-MM-dd HH:mm:ss")}</div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Summary metrics at the top - using the same metrics as above for now */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 p-4 bg-gray-50">
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="text-2xl font-bold">{jobs.reduce((sum, job) => sum + (job.planned_hours || 0), 0).toFixed(2)}</div>
                    <div className="text-sm text-gray-500">Planned Hours</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="text-2xl font-bold">{jobs.reduce((sum, job) => sum + (job.actual_hours || 0), 0).toFixed(2)}</div>
                    <div className="text-sm text-gray-500">Actual Hours</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="text-2xl font-bold">{jobs.reduce((sum, job) => sum + (job.projected_hours || 0), 0).toFixed(2)}</div>
                    <div className="text-sm text-gray-500">Projected Hours</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="text-2xl font-bold">${jobs.reduce((sum, job) => sum + (job.planned_cost || 0), 0).toLocaleString()}</div>
                    <div className="text-sm text-gray-500">Planned Cost</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="text-2xl font-bold">${jobs.reduce((sum, job) => sum + (job.actual_cost || 0), 0).toLocaleString()}</div>
                    <div className="text-sm text-gray-500">Actual Cost</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="text-2xl font-bold">${jobs.reduce((sum, job) => sum + (job.projected_cost || 0), 0).toLocaleString()}</div>
                    <div className="text-sm text-gray-500">Projected Cost</div>
                  </div>
                </div>

                {/* Dismantling Jobs section title */}
                <div className="p-4 bg-gray-100 border-t border-b">
                  <h3 className="text-lg font-semibold flex items-center">
                    <Wrench className="h-5 w-5 mr-2" /> Dismantling & Inspection Jobs
                  </h3>
                </div>

                {/* Jobs as cards in a grid */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {jobs
                    .filter(job =>
                      job.description?.toLowerCase().includes('dismantl') ||
                      job.description?.toLowerCase().includes('inspection') ||
                      job.work_center === 'DNI' ||
                      job.oper_short_text?.toLowerCase().includes('disassembly') ||
                      job.oper_short_text?.toLowerCase().includes('inspect')
                    )
                    .map((job) => (
                      <div
                        key={`dismantle-${job.job_number}`}
                        className="border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="border-l-4 border-blue-500 p-3">
                          <div className="flex justify-between items-start">
                            <input
                              className="font-medium text-lg w-full border-none bg-transparent"
                              value={editableJobData[job.job_number]?.reference_name ?? (job.title || job.reference_name || 'Add Reference Name')}
                              onChange={(e) => handleReferenceNameChange(job.job_number, e.target.value)}
                              onFocus={() => setActiveEditingJob(job.job_number)}
                              onBlur={() => {
                                if (editableJobData[job.job_number]?.reference_name) {
                                  updateReferenceNameMutation.mutate({
                                    jobId: job.job_number,
                                    referenceName: editableJobData[job.job_number].reference_name || ''
                                  });
                                }
                              }}
                            />
                            {activeEditingJob === job.job_number && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-green-600"
                                onClick={() => {
                                  if (editableJobData[job.job_number]?.reference_name) {
                                    updateReferenceNameMutation.mutate({
                                      jobId: job.job_number,
                                      referenceName: editableJobData[job.job_number].reference_name || ''
                                    });
                                  }
                                }}
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">#{job.job_number}</div>
                        </div>

                        <div className="p-3 border-t border-gray-100">
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div>
                              <div className="text-xs text-gray-500">Due Date:</div>
                              <input
                                type="date"
                                className="border-none bg-transparent p-0 w-full text-sm"
                                value={editableJobData[job.job_number]?.due_date || format(new Date(job.due_date), "yyyy-MM-dd")}
                                onChange={(e) => {
                                  setEditableJobData(prev => ({
                                    ...prev,
                                    [job.job_number]: {
                                      ...prev[job.job_number],
                                      due_date: e.target.value
                                    }
                                  }));
                                  updateDueDateMutation.mutate({
                                    jobId: job.job_number,
                                    newDate: e.target.value
                                  });
                                }}
                              />
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Profit Margin:</div>
                              <div className="text-sm font-medium">
                                {job.margin ? `${Number(job.margin).toFixed(2)}%` : 'N/A'}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mb-3">
                            <div>
                              <div className="text-xs text-gray-500">Planned:</div>
                              <div className="text-sm">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="border-none bg-transparent p-0 w-full"
                                  value={Number(job.planned_hours || 0).toFixed(2)}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    if (!isNaN(value)) {
                                      updateJobFieldMutation.mutate({
                                        jobId: job.job_number,
                                        field: 'planned_hours',
                                        value: value
                                      });
                                    }
                                  }}
                                /> hrs
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Actual:</div>
                              <div className="text-sm">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="border-none bg-transparent p-0 w-full"
                                  value={Number(job.actual_hours || 0).toFixed(2)}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    if (!isNaN(value)) {
                                      updateJobFieldMutation.mutate({
                                        jobId: job.job_number,
                                        field: 'actual_hours',
                                        value: value
                                      });
                                    }
                                  }}
                                /> hrs
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Projected:</div>
                              <div className="text-sm">
                                <span className={`${Number(job.projected_hours || 0) > Number(job.planned_hours || 0) ? 'text-red-600' : 'text-green-600'}`}>
                                  {Number(job.projected_hours || 0).toFixed(2)}
                                </span> hrs
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-blue-600 border-blue-200 hover:bg-blue-50"
                              onClick={() => {
                                console.log("Setting selectedJobForKPI for job:", job);
                                const preparedData = prepareJobKpiData(job);
                                console.log("Prepared KPI data:", preparedData);
                                setSelectedJobForKPI(preparedData);
                              }}
                            >
                              View Details
                            </Button>

                            <div className="flex space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-600 hover:bg-blue-50"
                                onClick={() => setSelectedJobForAssignment(job)}
                              >
                                <UserPlus className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-600 hover:bg-blue-50"
                                onClick={() => {
                                  setReportJobId(job.job_number);
                                  setIsReportDialogOpen(true);
                                }}
                              >
                                <Clipboard className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                  {jobs.filter(job =>
                    job.description?.toLowerCase().includes('dismantl') ||
                    job.description?.toLowerCase().includes('inspection') ||
                    job.work_center === 'DNI' ||
                    job.oper_short_text?.toLowerCase().includes('disassembly') ||
                    job.oper_short_text?.toLowerCase().includes('inspect')
                  ).length === 0 && (
                      <div className="col-span-full text-center py-8 text-gray-500">
                        No dismantling or inspection jobs found
                      </div>
                    )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Report Job Dialog */}
          <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Report Job Issue</DialogTitle>
                <DialogDescription>
                  Report issues with job {reportJobId} for immediate attention
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Issue Description</label>
                  <textarea
                    className="w-full p-2 border rounded-md"
                    rows={4}
                    value={reportMessage}
                    onChange={(e) => setReportMessage(e.target.value)}
                    placeholder="Describe the issue with this job..."
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    // Implementation of reporting job
                    toast({
                      title: "Report submitted",
                      description: "Your report has been submitted successfully",
                    });

                    // Add notification for all workers
                    addNotification({
                      title: `Job ${reportJobId} Reported`,
                      message: `Manager reported an issue: ${reportMessage}`,
                      type: 'job_update',
                      relatedJobId: String(reportJobId)
                    });

                    // Reset form
                    setReportMessage("");
                    setReportJobId(null);
                    setIsReportDialogOpen(false);
                  }}
                  disabled={!reportMessage || !reportJobId}
                >
                  Submit Report
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Job Details Dialog */}
          <Dialog open={!!selectedJobForAssignment} onOpenChange={() => setSelectedJobForAssignment(null)}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Job Details - {selectedJobForAssignment?.job_number}</DialogTitle>
              </DialogHeader>
              {selectedJobForAssignment && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-medium mb-2">Progress</h3>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${selectedJobForAssignment.progress < 30 ? "bg-red-500" :
                            selectedJobForAssignment.progress < 70 ? "bg-yellow-500" :
                              "bg-green-500"
                            }`}
                          style={{ width: `${selectedJobForAssignment.progress}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-500">{selectedJobForAssignment.progress}% Complete</span>
                    </div>

                    <div>
                      <h3 className="font-medium mb-2">Time</h3>
                      <div className="text-sm">
                        <div>Planned: {selectedJobForAssignment.planned_hours} hrs</div>
                        <div>Actual: {selectedJobForAssignment.actual_hours} hrs</div>
                        <div>Projected: {selectedJobForAssignment.projected_hours} hrs</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-medium mb-2">Due Date</h3>
                      <input
                        type="date"
                        className="w-full p-2 border rounded"
                        defaultValue={format(new Date(selectedJobForAssignment.due_date), "yyyy-MM-dd")}
                        onChange={(e) => updateDueDateMutation.mutate({
                          jobId: selectedJobForAssignment.job_number,
                          newDate: e.target.value
                        })}
                      />
                    </div>

                    <div>
                      <h3 className="font-medium mb-2">Status</h3>
                      <Select
                        value={selectedJobForAssignment.status}
                        onValueChange={(value) => updateJobStatusMutation.mutate({
                          jobId: selectedJobForAssignment.job_number,
                          newStatus: value
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Not Started">Not Started</SelectItem>
                          <SelectItem value="In Progress">In Progress</SelectItem>
                          <SelectItem value="On Hold">On Hold</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium mb-2">Assigned Employees</h3>
                    <div className="space-y-2">
                      {/* Show currently assigned employees */}
                      <div className="space-y-2">
                        {selectedJobForAssignment.assignedEmployees?.map(empId => {
                          const employee = employees.find(e => e.id === empId);
                          return employee ? (
                            <div key={empId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div>
                                <div className="font-medium">{employee.name}</div>
                                <div className="text-sm text-gray-500">{employee.department} - {employee.role}</div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-700"
                                onClick={() => {
                                  // TODO: Add employee removal functionality to useJobManager
                                  // For now, implement it directly
                                  const currentJobs = queryClient.getQueryData<any[]>(["/api/jobs"]) || [];
                                  const updatedJobs = currentJobs.map(job => {
                                    if (job.job_number === selectedJobForAssignment.job_number) {
                                      return {
                                        ...job,
                                        assignedEmployees: job.assignedEmployees?.filter((id: number) => id !== empId) || []
                                      };
                                    }
                                    return job;
                                  });
                                  queryClient.setQueryData(["/api/jobs"], updatedJobs);

                                  // Update employees data
                                  const currentEmployees = queryClient.getQueryData<Employee[]>(["/api/employees"]) || [];
                                  const updatedEmployees = currentEmployees.map(emp => {
                                    if (emp.id === empId) {
                                      return {
                                        ...emp,
                                        assignedJobs: emp.assignedJobs?.filter(jobId => jobId !== selectedJobForAssignment.job_number) || []
                                      };
                                    }
                                    return emp;
                                  });
                                  queryClient.setQueryData(["/api/employees"], updatedEmployees);

                                  toast({
                                    title: "Employee removed",
                                    description: "Employee has been removed from the job",
                                  });
                                }}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : null;
                        })}
                      </div>

                      {/* Add new employee */}
                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-2">Add Employee</h4>
                        <Select
                          onValueChange={(value) => {
                            // TODO: Add assignEmployeeMutation to useJobManager
                            // For now, implement it directly
                            const employeeId = Number(value);

                            // Update employee assignments in cache
                            const currentEmployees = queryClient.getQueryData<Employee[]>(["/api/employees"]) || [];
                            const updatedEmployees = currentEmployees.map(employee =>
                              employee.id === employeeId
                                ? { ...employee, assignedJobs: [...(employee.assignedJobs || []), selectedJobForAssignment.job_number] }
                                : employee
                            );
                            queryClient.setQueryData(["/api/employees"], updatedEmployees);

                            // Also update the job to show assigned employees
                            const currentJobs = queryClient.getQueryData<any[]>(["/api/jobs"]) || [];
                            const updatedJobs = currentJobs.map(job => {
                              if (job.job_number === selectedJobForAssignment.job_number) {
                                const currentAssignedEmployees = job.assignedEmployees || [];
                                return {
                                  ...job,
                                  assignedEmployees: [...currentAssignedEmployees, employeeId]
                                };
                              }
                              return job;
                            });
                            queryClient.setQueryData(["/api/jobs"], updatedJobs);

                            // Display toast notification
                            toast({
                              title: "Employee assigned",
                              description: "Employee has been assigned to the job successfully",
                            });

                            // Find employee name from the data
                            const employee = currentEmployees.find(emp => emp.id === employeeId);
                            const job = currentJobs.find(j => j.job_number === selectedJobForAssignment.job_number);

                            // Add notification for worker assignment
                            if (employee && job) {
                              addNotification({
                                title: `New Job Assignment`,
                                message: `${employee.name} has been assigned to job ${selectedJobForAssignment.job_number}: ${job.title || ''}`,
                                type: 'worker_assignment',
                                relatedJobId: String(selectedJobForAssignment.job_number),
                                relatedWorkerId: String(employeeId)
                              });
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select an employee" />
                          </SelectTrigger>
                          <SelectContent>
                            {employees
                              .filter(emp => !selectedJobForAssignment.assignedEmployees?.includes(emp.id))
                              .map(emp => (
                                <SelectItem key={emp.id} value={emp.id.toString()}>
                                  {emp.name} - {emp.department}
                                </SelectItem>
                              ))
                            }
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Worker Performance */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Worker Performance</CardTitle>
              <CardDescription>Individual employee productivity, efficiency metrics and attendance</CardDescription>
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
                      <th className="px-4 py-2">Status</th>
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
                              className={`h-1.5 rounded-full ${worker.completionPercentage < 30 ? "bg-red-500" :
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
                          <div className={`text-sm font-medium ${worker.efficiencyRate > 90 ? "text-green-600" :
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
                          <div className={`text-sm font-medium ${worker.onTimeCompletionRate > 90 ? "text-green-600" :
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
                        <td className="px-4 py-3">
                          <Badge
                            className={`${worker.checkInStatus === "checked-in"
                              ? "bg-green-100 text-green-800"
                              : worker.checkInStatus === "checked-out"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                              }`}
                          >
                            {worker.checkInStatus === "checked-in"
                              ? "Checked In"
                              : worker.checkInStatus === "checked-out"
                                ? "Checked Out"
                                : "Not Checked In"}
                          </Badge>
                          {worker.checkInTime && (
                            <div className="text-xs text-gray-500 mt-1">
                              {worker.checkInStatus === "checked-in"
                                ? `Since ${format(new Date(worker.checkInTime), "HH:mm")}`
                                : `Last seen ${format(new Date(worker.checkOutTime || worker.checkInTime), "HH:mm")}`
                              }
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}

                    {calculateWorkerPerformance().length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-gray-500">
                          No workers with assigned jobs found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
                        <span className={`text-sm font-medium ${dept.capacityPercentage > 90 ? "text-red-600" :
                          dept.capacityPercentage > 75 ? "text-yellow-600" :
                            "text-green-600"
                          }`}>
                          {dept.capacityPercentage}%
                        </span>
                      </div>
                      <Progress
                        value={dept.capacityPercentage}
                        className={`h-2 ${dept.capacityPercentage > 90 ? "bg-red-500" :
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

          {/* Work Center Summary */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Work Center Summary</CardTitle>
              <CardDescription>Current workload and backlog by work center</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 uppercase text-xs font-medium">
                    <tr>
                      <th className="px-4 py-3 text-left">Work Center</th>
                      <th className="px-4 py-3 text-right">Available Work</th>
                      <th className="px-4 py-3 text-right">Backlog</th>
                      <th className="px-4 py-3">View Available Work</th>
                      <th className="px-4 py-3">View Backlog</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(workCenters || []).map((wc) => (
                      <tr key={wc.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-blue-600">{wc.name}</td>
                        <td className="px-4 py-3 text-right">{(wc.availableWork || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">{(wc.backlog || 0).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            className="w-full bg-green-500 hover:bg-green-600 text-white"
                            onClick={() => toast({
                              title: `Available Work for ${wc.name}`,
                              description: `Viewing ${(wc.availableWork || 0).toFixed(2)} hours of available work`
                            })}
                          >
                            View Available Work
                          </Button>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            className="w-full bg-green-500 hover:bg-green-600 text-white"
                            onClick={() => toast({
                              title: `Backlog for ${wc.name}`,
                              description: `Viewing ${(wc.backlog || 0).toFixed(2)} hours of backlog`
                            })}
                          >
                            View Backlog
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {(!workCenters || workCenters.length === 0) && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                          No work center data available
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
                    className={`flex justify-between p-3 border rounded-lg ${isBefore(new Date(job.due_date), new Date()) ? "border-red-200 bg-red-50" : ""
                      }`}
                  >
                    <div>
                      <span className="font-medium">{job.job_number}</span>
                      <p className="text-sm text-gray-600">{job.title}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-medium ${isBefore(new Date(job.due_date), new Date()) ? "text-red-600" : ""
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

          {/* Job KPI Dialog */}
          <Dialog 
            open={!!selectedJobForKPI} 
            onOpenChange={(open) => {
              console.log("Dialog open change:", open);
              if (!open) {
                setSelectedJobForKPI(null);
                setActivePanel(null);
              }
            }}
          >
            <DialogContent className="max-w-4xl w-[calc(100vw-2rem)] p-4 md:p-6 overflow-y-auto max-h-[90vh]">
              <DialogHeader>
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                  <DialogTitle className="text-xl">
                    Job KPI
                    <span className="ml-2 text-blue-600">#{selectedJobForKPI?.job_number}</span>
                  </DialogTitle>
                  <div className="text-sm text-gray-500">
                    <div>Customer: {selectedJobForKPI?.customer || selectedJobForKPI?.reference_name}</div>
                    <div>Due Date: {selectedJobForKPI?.due_date ? format(new Date(selectedJobForKPI.due_date), "yyyy-MM-dd") : 'N/A'}</div>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 py-4">
                {/* Labor Metrics */}
                <div>
                  <h3 className="font-medium mb-3 pb-1 border-b">Labor Metrics</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Planned Hours</span>
                      <span className="font-medium">{selectedJobForKPI?.planned_hours?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Actual Hours</span>
                      <span className="font-medium">{selectedJobForKPI?.actual_hours?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Planned Labor Cost</span>
                      <span className="font-medium">${(selectedJobForKPI?.planned_cost * 0.55)?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Actual Labor Cost</span>
                      <span className="font-medium">${(selectedJobForKPI?.actual_cost * 0.55)?.toFixed(2) || '0.00'}</span>
                    </div>
                  </div>
                </div>

                {/* Cost Breakdown */}
                <div>
                  <h3 className="font-medium mb-3 pb-1 border-b">Cost Breakdown</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Planned Cost</span>
                      <span className="font-medium">${selectedJobForKPI?.planned_cost?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Actual Cost</span>
                      <span className="font-medium">${selectedJobForKPI?.actual_cost?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Goods Cost (All)</span>
                      <span className="font-medium">${(selectedJobForKPI?.planned_cost * 0.45)?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cost Received</span>
                      <span className="font-medium">${(selectedJobForKPI?.actual_cost * 0.12)?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cost to Receive</span>
                      <span className="font-medium">${(selectedJobForKPI?.planned_cost * 0.4 - selectedJobForKPI?.actual_cost * 0.12)?.toFixed(2) || '0.00'}</span>
                    </div>
                  </div>
                </div>

                {/* Profitability */}
                <div>
                  <h3 className="font-medium mb-3 pb-1 border-b">Profitability</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Order Value</span>
                      <span className="font-medium">{selectedJobForKPI?.order_value ? `$${selectedJobForKPI?.order_value.toFixed(2)}` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Profit Margin</span>
                      <span className="font-medium">{selectedJobForKPI?.margin ? `${selectedJobForKPI?.margin.toFixed(2)}%` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Profit Value</span>
                      <span className="font-medium">{selectedJobForKPI?.profit_value ? `$${selectedJobForKPI?.profit_value.toFixed(2)}` : 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Performance Stats */}
                <div>
                  <h3 className="font-medium mb-3 pb-1 border-b">Performance Stats</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600"># Ops Over Hours</span>
                      <span className="font-medium">{Math.floor(Math.random() * 100)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600"># Ops On/Under</span>
                      <span className="font-medium">{Math.floor(Math.random() * 250)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Performance Score</span>
                      <span className="font-medium">{Math.floor(80 + Math.random() * 20)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Logistics */}
              <div className="mt-4">
                <h3 className="font-medium mb-3 pb-1 border-b">Logistics</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Qty Goods Received</span>
                    <span className="font-medium">{Math.floor(Math.random() * 150)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Qty to be Received</span>
                    <span className="font-medium">{Math.floor(Math.random() * 150)}</span>
                  </div>
                </div>
              </div>

              {/* Operations Statistics */}
              <div className="mt-4">
                <h3 className="font-medium mb-3 pb-1 border-b">Operations Statistics</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Active Status</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Operations</span>
                        <span className="font-medium">{selectedJobForKPI?.operations?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">In Progress</span>
                        <span className="font-medium">{selectedJobForKPI?.operations?.filter(op => op?.status === 'In Progress')?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Completed</span>
                        <span className="font-medium">{selectedJobForKPI?.operations?.filter(op => op?.status === 'Complete')?.length || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Waiting Status</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Resource Wait</span>
                        <span className="font-medium">{selectedJobForKPI?.idle_time?.resource_wait || 0} hrs</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Material Wait</span>
                        <span className="font-medium">{selectedJobForKPI?.idle_time?.material_wait || 0} hrs</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Wait</span>
                        <span className="font-medium">{(selectedJobForKPI?.idle_time?.resource_wait || 0) + (selectedJobForKPI?.idle_time?.material_wait || 0)} hrs</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Counts by Status</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Not Started</span>
                        <span className="font-medium">{selectedJobForKPI?.idle_operations?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Blocked</span>
                        <span className="font-medium">{selectedJobForKPI?.operations?.filter(op => op?.status === 'Blocked')?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Progress %</span>
                        <span className="font-medium">{selectedJobForKPI?.progress || 0}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Idle Operations Table */}
              <div className="mt-4">
                <h3 className="font-medium mb-3 pb-1 border-b">Idle Operations</h3>
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle p-4 sm:p-0">
                    <table className="min-w-full text-sm divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-600">Part</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-600">Work Center</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-600">Task</th>
                          <th className="px-4 py-2 text-right font-medium text-gray-600">Planned Hours</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedJobForKPI?.idle_operations?.map((op, index) => (
                          <tr key={`idle-op-${index}`} className="hover:bg-gray-50">
                            <td className="px-4 py-2">{op.part || "—"}</td>
                            <td className="px-4 py-2">{op.work_center || "—"}</td>
                            <td className="px-4 py-2">{op.task || "—"}</td>
                            <td className="px-4 py-2 text-right">{op.planned_hours?.toFixed(1) || "—"}</td>
                            <td className="px-4 py-2">{op.status || "Not Started"}</td>
                          </tr>
                        ))}
                        {(!selectedJobForKPI?.idle_operations || selectedJobForKPI.idle_operations.length === 0) && (
                          <tr>
                            <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                              No idle operations found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Top Task Costs Table */}
              <div className="mt-4">
                <h3 className="font-medium mb-3 pb-1 border-b">Top Task Costs</h3>
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle p-4 sm:p-0">
                    <table className="min-w-full text-sm divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-600">Task</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-600">Part</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-600">Work Center</th>
                          <th className="px-4 py-2 text-right font-medium text-gray-600">Planned Cost</th>
                          <th className="px-4 py-2 text-right font-medium text-gray-600">Actual Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedJobForKPI?.task_costs?.map((task, index) => (
                          <tr key={`task-cost-${index}`} className="hover:bg-gray-50">
                            <td className="px-4 py-2">{task.task || "—"}</td>
                            <td className="px-4 py-2">{task.part || "—"}</td>
                            <td className="px-4 py-2">{task.work_center || "—"}</td>
                            <td className="px-4 py-2 text-right">${task.planned_cost?.toFixed(2) || "0.00"}</td>
                            <td className="px-4 py-2 text-right">${task.actual_cost?.toFixed(2) || "0.00"}</td>
                          </tr>
                        ))}
                        {(!selectedJobForKPI?.task_costs || selectedJobForKPI.task_costs.length === 0) && (
                          <tr>
                            <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                              No task cost data available
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Work Center Chart */}
              <div className="mt-6">
                <h3 className="font-medium mb-3 pb-1 border-b">Work Center Performance</h3>
                <div className="h-64 max-w-full">
                  <Bar
                    data={{
                      labels: ['ASSEMBLY', 'BALANCE', 'BUILD', 'CD', 'DNI', 'HYDRO', 'INSPECT'],
                      datasets: [
                        {
                          label: 'Planned Hours',
                          data: [4.5, 8.2, 3.1, 12.5, 9.7, 5.2, 7.8],
                          backgroundColor: 'rgba(52, 152, 219, 0.7)'
                        },
                        {
                          label: 'Actual Hours',
                          data: [5.2, 7.8, 3.9, 14.1, 8.5, 6.7, 9.2],
                          backgroundColor: 'rgba(231, 76, 60, 0.7)'
                        }
                      ]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'top',
                          labels: {
                            boxWidth: 12,
                            font: {
                              size: 10
                            }
                          }
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          title: {
                            display: true,
                            text: 'Hours',
                            font: {
                              size: 10
                            }
                          },
                          ticks: {
                            font: {
                              size: 9
                            }
                          }
                        },
                        x: {
                          title: {
                            display: true,
                            text: 'Work Center',
                            font: {
                              size: 10
                            }
                          },
                          ticks: {
                            font: {
                              size: 9
                            },
                            maxRotation: 45,
                            minRotation: 45
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>

              {/* Root Cause Analysis */}
              <div className="mt-6">
                <h3 className="font-medium mb-3 pb-1 border-b">Performance Issues Detected</h3>
                <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r">
                  <ul className="list-disc pl-5 space-y-1">
                    {selectedJobForKPI?.margin < 0 && (
                      <li className="text-red-600">🔴 Profit Margin Negative</li>
                    )}
                    {selectedJobForKPI?.actual_hours > selectedJobForKPI?.planned_hours * 1.2 && (
                      <li className="text-amber-600">⚠️ Significant labor overrun</li>
                    )}
                    {selectedJobForKPI?.idle_operations?.length > 0 && (
                      <li className="text-blue-600">⛔ Idle tasks with no recorded progress</li>
                    )}
                    {Math.random() > 0.5 && (
                      <li className="text-indigo-600">📦 Delayed purchase orders affecting job timeline</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* KPI Action Buttons */}
              <div className="mt-6 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="flex items-center"
                  onClick={() => {
                    console.log("Clicking Labor Overruns button");
                    toggleKpiPanel('laborOverruns');
                  }}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Labor Overruns
                </Button>

                <Button
                  variant="outline"
                  className="flex items-center"
                  onClick={() => {
                    console.log("Clicking Cost Drivers button");
                    toggleKpiPanel('costDrivers');
                  }}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Cost Drivers
                </Button>
                
                <Button
                  variant="outline"
                  className="flex items-center"
                  onClick={() => {
                    console.log("Clicking Work Center Trends button");
                    toggleKpiPanel('wcTrends');
                  }}
                >
                  <BarChart className="h-4 w-4 mr-2" />
                  Work Center Trends
                </Button>
                
                <Button
                  variant="outline"
                  className="flex items-center"
                  onClick={() => {
                    console.log("Clicking Idle Operations button");
                    toggleKpiPanel('idleOps');
                  }}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Idle Operations
                </Button>
                
                <Button
                  variant="outline"
                  className="flex items-center"
                  onClick={() => {
                    console.log("Clicking Logistics button");
                    toggleKpiPanel('logistics');
                  }}
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Logistics
                </Button>
                
                <Button
                  variant="outline"
                  className="flex items-center"
                  onClick={() => {
                    console.log("Clicking Equipment Runtime button");
                    toggleKpiPanel('equipmentRuntime');
                  }}
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Equipment Runtime
                </Button>
                
                <Button
                  variant="outline"
                  className="flex items-center"
                  onClick={() => {
                    console.log("Clicking Job Summary button");
                    toggleKpiPanel('jobSummary');
                  }}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Job Summary
                </Button>
              </div>

              {/* Labor Overruns Panel */}
              {activePanel === 'laborOverruns' && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
                  <div className="bg-white w-full sm:w-4/5 md:max-w-2xl h-full overflow-auto p-4 md:p-6 shadow-xl">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold">Labor Overrun Summary</h3>
                      <Button variant="ghost" size="sm" onClick={() => setActivePanel(null)}>
                        <XCircle className="h-5 w-5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-lg font-bold">8</div>
                        <div className="text-sm text-gray-500">Parts with Overruns</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-lg font-bold">24.5</div>
                        <div className="text-sm text-gray-500">Total Overrun Hours</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-lg font-bold">$4,875.50</div>
                        <div className="text-sm text-gray-500">Total Overrun Cost</div>
                      </div>
                    </div>

                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                      <div className="inline-block min-w-full align-middle p-4 sm:p-0">
                        <table className="min-w-full border-collapse">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="p-2 text-left">Part</th>
                              <th className="p-2 text-left">Work Center</th>
                              <th className="p-2 text-left">Task</th>
                              <th className="p-2 text-right">Extra Hours</th>
                              <th className="p-2 text-right">Extra Cost</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {[...Array(5)].map((_, i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="p-2">Part {i + 1}</td>
                                <td className="p-2">{['HBM', 'DNI', 'CD', 'INSPECT', 'MACHINING'][i]}</td>
                                <td className="p-2">Task description {i + 1}</td>
                                <td className="p-2 text-right">{(Math.random() * 10).toFixed(1)}</td>
                                <td className="p-2 text-right">${(Math.random() * 1000).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Cost Drivers Panel */}
              {activePanel === 'costDrivers' && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
                  <div className="bg-white w-full sm:w-4/5 md:max-w-2xl h-full overflow-auto p-4 md:p-6 shadow-xl">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold">Top Labor Cost Drivers</h3>
                      <Button variant="ghost" size="sm" onClick={() => setActivePanel(null)}>
                        <XCircle className="h-5 w-5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-lg font-bold">$12,450.23</div>
                        <div className="text-sm text-gray-500">Total Cost From Top 4</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-lg font-bold">68%</div>
                        <div className="text-sm text-gray-500">% of Total Overrun</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-lg font-bold">23.4%</div>
                        <div className="text-sm text-gray-500">Labor Cost Over Plan</div>
                      </div>
                    </div>

                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                      <div className="inline-block min-w-full align-middle p-4 sm:p-0">
                        <table className="min-w-full border-collapse text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="p-2 text-left">Part</th>
                              <th className="p-2 text-left">Task</th>
                              <th className="p-2 text-left">Work Center</th>
                              <th className="p-2 text-right">Planned</th>
                              <th className="p-2 text-right">Actual</th>
                              <th className="p-2 text-right">Cost Overrun</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {[...Array(4)].map((_, i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="p-2">{['Volute Casing', 'Impellers', 'Shaft Assembly', 'Bearing Housing'][i]}</td>
                                <td className="p-2">Task {i + 1}</td>
                                <td className="p-2">{['HBM', 'DNI', 'LATHE', 'MACHINING'][i]}</td>
                                <td className="p-2 text-right">{(Math.random() * 10 + 5).toFixed(1)} hrs</td>
                                <td className="p-2 text-right">{(Math.random() * 15 + 5).toFixed(1)} hrs</td>
                                <td className="p-2 text-right">${(Math.random() * 2000 + 500).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Work Center Trends Panel */}
              {activePanel === 'wcTrends' && selectedJobForKPI && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
                  <div className="bg-white w-full sm:w-4/5 md:max-w-2xl h-full overflow-auto p-4 md:p-6 shadow-xl">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold">Work Center Performance Trends</h3>
                      <Button variant="ghost" size="sm" onClick={() => setActivePanel(null)}>
                        <XCircle className="h-5 w-5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-lg font-bold">{(selectedJobForKPI?.operations?.filter(op => op?.status === 'Complete')?.length) || 0}</div>
                        <div className="text-sm text-gray-500">Completed Operations</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-lg font-bold">{selectedJobForKPI?.progress || 0}%</div>
                        <div className="text-sm text-gray-500">Overall Efficiency</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-lg font-bold">
                          {(selectedJobForKPI?.operations && selectedJobForKPI.operations.length > 0) 
                            ? selectedJobForKPI.operations.reduce((best, op) => 
                                best === null || (op.planned_hours > 0 && op.actual_hours / op.planned_hours < (best.ratio || Infinity)) 
                                  ? {wc: op.work_center, ratio: op.planned_hours > 0 ? op.actual_hours / op.planned_hours : 1} 
                                  : best, 
                                null)?.wc || 'N/A'
                            : 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">Best Work Center</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-lg font-bold">
                          {(selectedJobForKPI?.operations && selectedJobForKPI.operations.length > 0) 
                            ? selectedJobForKPI.operations.reduce((worst, op) => 
                                worst === null || (op.planned_hours > 0 && op.actual_hours / op.planned_hours > (worst.ratio || 0))
                                  ? {wc: op.work_center, ratio: op.planned_hours > 0 ? op.actual_hours / op.planned_hours : 1} 
                                  : worst, 
                                null)?.wc || 'N/A'
                            : 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">Worst Work Center</div>
                      </div>
                    </div>

                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                      <div className="inline-block min-w-full align-middle p-4 sm:p-0">
                        <table className="min-w-full border-collapse text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="p-2 text-left">Work Center</th>
                              <th className="p-2 text-left">Ops Completed</th>
                              <th className="p-2 text-right">Planned Hours</th>
                              <th className="p-2 text-right">Actual Hours</th>
                              <th className="p-2 text-right">Efficiency</th>
                              <th className="p-2 text-right">Planned Cost</th>
                              <th className="p-2 text-right">Actual Cost</th>
                              <th className="p-2 text-right">Cost Variance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {selectedJobForKPI?.operations && Array.from(new Set(selectedJobForKPI.operations.map(op => op.work_center))).map((wc, i) => {
                              const opsForWC = selectedJobForKPI.operations.filter(op => op.work_center === wc) || [];
                              const completedOps = opsForWC.filter(op => op.status === 'Complete').length;
                              const plannedHours = opsForWC.reduce((sum, op) => sum + (op.planned_hours || 0), 0);
                              const actualHours = opsForWC.reduce((sum, op) => sum + (op.actual_hours || 0), 0);
                              const efficiency = plannedHours > 0 ? Math.min(100, (plannedHours / Math.max(0.1, actualHours)) * 100) : 100;
                              const plannedCost = opsForWC.reduce((sum, op) => sum + (op.cost_planned || 0), 0);
                              const actualCost = opsForWC.reduce((sum, op) => sum + (op.cost_actual || 0), 0);
                              const costVariance = actualCost - plannedCost;
                              
                              return (
                                <tr key={`wc-trend-${i}`} className="hover:bg-gray-50">
                                  <td className="p-2">{wc || 'N/A'}</td>
                                  <td className="p-2">{completedOps}</td>
                                  <td className="p-2 text-right">{plannedHours.toFixed(1)}</td>
                                  <td className="p-2 text-right">{actualHours.toFixed(1)}</td>
                                  <td className={`p-2 text-right ${efficiency >= 95 ? 'text-green-600' : efficiency >= 85 ? 'text-amber-600' : 'text-red-600'}`}>
                                    {efficiency.toFixed(1)}%
                                  </td>
                                  <td className="p-2 text-right">${plannedCost.toFixed(2)}</td>
                                  <td className="p-2 text-right">${actualCost.toFixed(2)}</td>
                                  <td className={`p-2 text-right ${costVariance <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    ${costVariance.toFixed(2)}
                                  </td>
                                </tr>
                              );
                            })}
                            {(!selectedJobForKPI?.operations || selectedJobForKPI.operations.length === 0) && (
                              <tr>
                                <td colSpan={8} className="p-4 text-center text-gray-500">
                                  No operations data available
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Idle Operations Panel */}
              {activePanel === 'idleOps' && selectedJobForKPI && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
                  <div className="bg-white w-full sm:w-4/5 md:max-w-2xl h-full overflow-auto p-4 md:p-6 shadow-xl">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold">Idle Operations</h3>
                      <Button variant="ghost" size="sm" onClick={() => setActivePanel(null)}>
                        <XCircle className="h-5 w-5" />
                      </Button>
                    </div>

                    <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6 rounded-r">
                      <p className="text-amber-800">Operations with no hours logged that are preventing job completion. Addressing these can improve job throughput.</p>
                    </div>

                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                      <div className="inline-block min-w-full align-middle p-4 sm:p-0">
                        <table className="min-w-full border-collapse text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="p-2 text-left">Part</th>
                              <th className="p-2 text-left">Work Center</th>
                              <th className="p-2 text-left">Task</th>
                              <th className="p-2 text-right">Planned Hours</th>
                              <th className="p-2 text-left">Status</th>
                              <th className="p-2 text-left">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {selectedJobForKPI?.idle_operations?.map((op, i) => (
                              <tr key={`idle-ops-${i}`} className="hover:bg-gray-50">
                                <td className="p-2">{op.part || 'N/A'}</td>
                                <td className="p-2">{op.work_center || 'N/A'}</td>
                                <td className="p-2">{op.task || 'N/A'}</td>
                                <td className="p-2 text-right">{op.planned_hours?.toFixed(1) || '0.0'}</td>
                                <td className="p-2">{op.status || 'Not Started'}</td>
                                <td className="p-2">
                                  <Button variant="ghost" size="sm" className="text-blue-600">
                                    Assign
                                  </Button>
                                </td>
                              </tr>
                            ))}
                            {(!selectedJobForKPI?.idle_operations || selectedJobForKPI.idle_operations.length === 0) && (
                              <tr>
                                <td colSpan={6} className="p-4 text-center text-gray-500">
                                  No idle operations found
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Logistics Panel */}
              {activePanel === 'logistics' && selectedJobForKPI && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
                  <div className="bg-white w-full sm:w-4/5 md:max-w-2xl h-full overflow-auto p-4 md:p-6 shadow-xl">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold">Logistics Overview</h3>
                      <Button variant="ghost" size="sm" onClick={() => setActivePanel(null)}>
                        <XCircle className="h-5 w-5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-lg font-bold">{selectedJobForKPI?.quantity_goods_received || 0}</div>
                        <div className="text-sm text-gray-500">Goods Received</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-lg font-bold">{selectedJobForKPI?.quantity_goods_to_be_received || 0}</div>
                        <div className="text-sm text-gray-500">Goods to be Received</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-lg font-bold">${(selectedJobForKPI?.total_goods_cost * 0.12)?.toFixed(2) || '0.00'}</div>
                        <div className="text-sm text-gray-500">Cost Received</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-lg font-bold">${(selectedJobForKPI?.planned_cost * 0.4 - selectedJobForKPI?.actual_cost * 0.12)?.toFixed(2) || '0.00'}</div>
                        <div className="text-sm text-gray-500">Cost to Receive</div>
                      </div>
                    </div>

                    <h4 className="font-medium mb-3">Delayed Purchase Orders</h4>
                    <div className="overflow-x-auto -mx-4 sm:mx-0 mb-6">
                      <div className="inline-block min-w-full align-middle p-4 sm:p-0">
                        <table className="min-w-full border-collapse text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="p-2 text-left">PO Number</th>
                              <th className="p-2 text-left">Description</th>
                              <th className="p-2 text-left">Expected</th>
                              <th className="p-2 text-right">Days Late</th>
                              <th className="p-2 text-right">Pending Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {[...(selectedJobForKPI?.delayed_pos || []), 
                              // Add example data if none exists
                              ...((!selectedJobForKPI?.delayed_pos || selectedJobForKPI.delayed_pos.length === 0) ? [
                                { po_number: 'PO34982', description: 'Bearings', expected_delivery: '2023-05-15', days_late: 12, pending_value: 1250.00 },
                                { po_number: 'PO34990', description: 'Seals', expected_delivery: '2023-05-20', days_late: 7, pending_value: 350.00 },
                              ] : [])
                            ].map((po, i) => (
                              <tr key={`po-${i}`} className="hover:bg-gray-50">
                                <td className="p-2">{po.po_number}</td>
                                <td className="p-2">{po.description}</td>
                                <td className="p-2">{po.expected_delivery}</td>
                                <td className="p-2 text-right text-red-600">{po.days_late}</td>
                                <td className="p-2 text-right">${po.pending_value.toFixed(2)}</td>
                              </tr>
                            ))}
                            {(!selectedJobForKPI?.delayed_pos || selectedJobForKPI.delayed_pos.length === 0) && (
                              <tr className="bg-green-50">
                                <td colSpan={5} className="p-4 text-center text-green-600">
                                  No delayed purchase orders! 🎉
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Equipment Runtime Panel */}
              {activePanel === 'equipmentRuntime' && selectedJobForKPI && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
                  <div className="bg-white w-full sm:w-4/5 md:max-w-2xl h-full overflow-auto p-4 md:p-6 shadow-xl">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold">Equipment Runtime Analysis</h3>
                      <Button variant="ghost" size="sm" onClick={() => setActivePanel(null)}>
                        <XCircle className="h-5 w-5" />
                      </Button>
                    </div>

                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 rounded-r">
                      <p className="text-blue-800">Equipment runtime data is collected from IoT sensors installed on key machinery.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-2">Machine Utilization</h4>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">HBM-230</span>
                          <span className="text-sm">72%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: "72%" }}></div>
                        </div>
                        
                        <div className="flex justify-between mb-1 mt-4">
                          <span className="text-sm">LATHE-41</span>
                          <span className="text-sm">54%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: "54%" }}></div>
                        </div>
                        
                        <div className="flex justify-between mb-1 mt-4">
                          <span className="text-sm">DRILL-103</span>
                          <span className="text-sm">88%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: "88%" }}></div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-2">Vibration Analysis</h4>
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between">
                              <span className="text-sm">HBM-230</span>
                              <span className="text-sm text-green-600">Normal</span>
                            </div>
                            <div className="text-xs text-gray-500">Last reading: 1.2 mm/s</div>
                          </div>
                          
                          <div>
                            <div className="flex justify-between">
                              <span className="text-sm">LATHE-41</span>
                              <span className="text-sm text-amber-600">Warning</span>
                            </div>
                            <div className="text-xs text-gray-500">Last reading: 2.7 mm/s</div>
                          </div>
                          
                          <div>
                            <div className="flex justify-between">
                              <span className="text-sm">DRILL-103</span>
                              <span className="text-sm text-green-600">Normal</span>
                            </div>
                            <div className="text-xs text-gray-500">Last reading: 0.9 mm/s</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <h4 className="font-medium mb-3">Runtime Logs</h4>
                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                      <div className="inline-block min-w-full align-middle p-4 sm:p-0">
                        <table className="min-w-full border-collapse text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="p-2 text-left">Machine</th>
                              <th className="p-2 text-left">Operator</th>
                              <th className="p-2 text-right">Runtime (hrs)</th>
                              <th className="p-2 text-right">Idle Time (hrs)</th>
                              <th className="p-2 text-right">Power Draw (kW)</th>
                              <th className="p-2 text-left">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {[
                              { machine: 'HBM-230', operator: 'John Smith', runtime: 14.2, idle: 2.1, power: 5.5, status: 'Online' },
                              { machine: 'LATHE-41', operator: 'Maria Garcia', runtime: 8.7, idle: 3.8, power: 4.2, status: 'Offline' },
                              { machine: 'DRILL-103', operator: 'David Chen', runtime: 11.3, idle: 1.5, power: 3.1, status: 'Online' },
                            ].map((log, i) => (
                              <tr key={`runtime-${i}`} className="hover:bg-gray-50">
                                <td className="p-2">{log.machine}</td>
                                <td className="p-2">{log.operator}</td>
                                <td className="p-2 text-right">{log.runtime.toFixed(1)}</td>
                                <td className="p-2 text-right">{log.idle.toFixed(1)}</td>
                                <td className="p-2 text-right">{log.power.toFixed(1)}</td>
                                <td className="p-2">
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    log.status === 'Online' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {log.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Job Summary Panel */}
              {activePanel === 'jobSummary' && selectedJobForKPI && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
                  <div className="bg-white w-full sm:w-4/5 md:max-w-2xl h-full overflow-auto p-4 md:p-6 shadow-xl">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold">Job Summary Report</h3>
                      <Button variant="ghost" size="sm" onClick={() => setActivePanel(null)}>
                        <XCircle className="h-5 w-5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 mb-6">
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <h4 className="font-medium mb-2 text-blue-800">Job Overview</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="text-sm text-gray-600">Job Number:</div>
                            <div className="font-medium">{selectedJobForKPI?.job_number}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-600">Customer:</div>
                            <div className="font-medium">{selectedJobForKPI?.customer || selectedJobForKPI?.reference_name}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-600">Due Date:</div>
                            <div className="font-medium">{selectedJobForKPI?.due_date}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-600">Status:</div>
                            <div className="font-medium">
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                selectedJobForKPI?.status === 'Completed' ? 'bg-green-100 text-green-800' : 
                                selectedJobForKPI?.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 
                                'bg-amber-100 text-amber-800'
                              }`}>
                                {selectedJobForKPI?.status || 'In Progress'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-2">Time Summary</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Planned:</span>
                            <span className="font-medium">{selectedJobForKPI?.planned_hours?.toFixed(2) || '0.00'} hrs</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Actual:</span>
                            <span className="font-medium">{selectedJobForKPI?.actual_hours?.toFixed(2) || '0.00'} hrs</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Projected:</span>
                            <span className={`font-medium ${
                              (selectedJobForKPI?.projected_hours || 0) > (selectedJobForKPI?.planned_hours || 0) 
                                ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {selectedJobForKPI?.projected_hours?.toFixed(2) || '0.00'} hrs
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-2">Cost Summary</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Planned:</span>
                            <span className="font-medium">${selectedJobForKPI?.planned_cost?.toFixed(2) || '0.00'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Actual:</span>
                            <span className="font-medium">${selectedJobForKPI?.actual_cost?.toFixed(2) || '0.00'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Projected:</span>
                            <span className={`font-medium ${
                              (selectedJobForKPI?.projected_cost || 0) > (selectedJobForKPI?.planned_cost || 0) 
                                ? 'text-red-600' : 'text-green-600'
                            }`}>
                              ${selectedJobForKPI?.projected_cost?.toFixed(2) || '0.00'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-2">Profitability</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Order Value:</span>
                            <span className="font-medium">${selectedJobForKPI?.order_value?.toFixed(2) || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Profit Value:</span>
                            <span className={`font-medium ${
                              (selectedJobForKPI?.profit_value || 0) < 0 
                                ? 'text-red-600' : 'text-green-600'
                            }`}>
                              ${selectedJobForKPI?.profit_value?.toFixed(2) || 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Profit Margin:</span>
                            <span className={`font-medium ${
                              (selectedJobForKPI?.margin || 0) < 0 
                                ? 'text-red-600' : (selectedJobForKPI?.margin || 0) < 10
                                ? 'text-amber-600' : 'text-green-600'
                            }`}>
                              {selectedJobForKPI?.margin?.toFixed(2) || 'N/A'}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 mb-6">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-3">Progress Summary</h4>
                        <div className="space-y-2">
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-sm text-gray-600">Overall Completion</span>
                              <span className="text-sm">{selectedJobForKPI?.progress || 0}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                              <div className={`h-2 rounded-full ${
                                (selectedJobForKPI?.progress || 0) < 30 ? 'bg-red-500' :
                                (selectedJobForKPI?.progress || 0) < 70 ? 'bg-amber-500' :
                                'bg-green-500'
                              }`} 
                              style={{ width: `${selectedJobForKPI?.progress || 0}%` }}></div>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap">
                            <div className="w-full sm:w-1/3 pr-2 mb-3">
                              <div className="text-sm text-gray-600 mb-1">Operations Complete</div>
                              <div className="text-xl font-medium">
                                {selectedJobForKPI?.operations?.filter(op => op?.status === 'Complete')?.length || 0} / {selectedJobForKPI?.operations?.length || 0}
                              </div>
                            </div>
                            
                            <div className="w-full sm:w-1/3 px-2 mb-3">
                              <div className="text-sm text-gray-600 mb-1">Days Until Due</div>
                              <div className={`text-xl font-medium ${
                                (selectedJobForKPI?.days_until_due || 0) < 0 
                                  ? 'text-red-600' : (selectedJobForKPI?.days_until_due || 0) < 5
                                  ? 'text-amber-600' : 'text-green-600'
                              }`}>
                                {selectedJobForKPI?.days_until_due || 'N/A'}
                              </div>
                            </div>
                            
                            <div className="w-full sm:w-1/3 pl-2 mb-3">
                              <div className="text-sm text-gray-600 mb-1">Risk Assessment</div>
                              <div className="text-xl font-medium">
                                {(selectedJobForKPI?.is_at_risk || (selectedJobForKPI?.days_until_due || 0) < 3) 
                                  ? <span className="text-red-600">At Risk</span> 
                                  : <span className="text-green-600">On Track</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Print Report Button */}
                    <div className="flex justify-end">
                      <Button variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200">
                        <Clipboard className="h-4 w-4 mr-2" />
                        Generate Full Report
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Work Center Chart */}
          <div className="mt-6">
            <h3 className="font-medium mb-3 pb-1 border-b">Work Center Performance</h3>
            <div className="h-64 max-w-full">
              <Bar
                data={{
                  labels: ['ASSEMBLY', 'BALANCE', 'BUILD', 'CD', 'DNI', 'HYDRO', 'INSPECT'],
                  datasets: [
                    {
                      label: 'Planned Hours',
                      data: [4.5, 8.2, 3.1, 12.5, 9.7, 5.2, 7.8],
                      backgroundColor: 'rgba(52, 152, 219, 0.7)'
                    },
                    {
                      label: 'Actual Hours',
                      data: [5.2, 7.8, 3.9, 14.1, 8.5, 6.7, 9.2],
                      backgroundColor: 'rgba(231, 76, 60, 0.7)'
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'top',
                      labels: {
                        boxWidth: 12,
                        font: {
                          size: 10
                        }
                      }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      title: {
                        display: true,
                        text: 'Hours',
                        font: {
                          size: 10
                        }
                      },
                      ticks: {
                        font: {
                          size: 9
                        }
                      }
                    },
                    x: {
                      title: {
                        display: true,
                        text: 'Work Center',
                        font: {
                          size: 10
                        }
                      },
                      ticks: {
                        font: {
                          size: 9
                        },
                        maxRotation: 45,
                        minRotation: 45
                      }
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Root Cause Analysis */}
          <div className="mt-6">
            <h3 className="font-medium mb-3 pb-1 border-b">Performance Issues Detected</h3>
            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r">
              <ul className="list-disc pl-5 space-y-1">
                {selectedJobForKPI?.margin < 0 && (
                  <li className="text-red-600">🔴 Profit Margin Negative</li>
                )}
                {selectedJobForKPI?.actual_hours > selectedJobForKPI?.planned_hours * 1.2 && (
                  <li className="text-amber-600">⚠️ Significant labor overrun</li>
                )}
                {selectedJobForKPI?.idle_operations?.length > 0 && (
                  <li className="text-blue-600">⛔ Idle tasks with no recorded progress</li>
                )}
                {Math.random() > 0.5 && (
                  <li className="text-indigo-600">📦 Delayed purchase orders affecting job timeline</li>
                )}
              </ul>
            </div>
          </div>

          {/* KPI Action Buttons */}
          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="flex items-center"
              onClick={() => {
                console.log("Clicking Labor Overruns button");
                toggleKpiPanel('laborOverruns');
              }}
            >
              <Clock className="h-4 w-4 mr-2" />
              Labor Overruns
            </Button>

            <Button
              variant="outline"
              className="flex items-center"
              onClick={() => {
                console.log("Clicking Cost Drivers button");
                toggleKpiPanel('costDrivers');
              }}
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Cost Drivers
            </Button>
            
            <Button
              variant="outline"
              className="flex items-center"
              onClick={() => {
                console.log("Clicking Work Center Trends button");
                toggleKpiPanel('wcTrends');
              }}
            >
              <BarChart className="h-4 w-4 mr-2" />
              Work Center Trends
            </Button>
            
            <Button
              variant="outline"
              className="flex items-center"
              onClick={() => {
                console.log("Clicking Idle Operations button");
                toggleKpiPanel('idleOps');
              }}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Idle Operations
            </Button>
            
            <Button
              variant="outline"
              className="flex items-center"
              onClick={() => {
                console.log("Clicking Logistics button");
                toggleKpiPanel('logistics');
              }}
            >
              <Truck className="h-4 w-4 mr-2" />
              Logistics
            </Button>
            
            <Button
              variant="outline"
              className="flex items-center"
              onClick={() => {
                console.log("Clicking Equipment Runtime button");
                toggleKpiPanel('equipmentRuntime');
              }}
            >
              <Activity className="h-4 w-4 mr-2" />
              Equipment Runtime
            </Button>
            
            <Button
              variant="outline"
              className="flex items-center"
              onClick={() => {
                console.log("Clicking Job Summary button");
                toggleKpiPanel('jobSummary');
              }}
            >
              <FileText className="h-4 w-4 mr-2" />
              Job Summary
            </Button>
          </div>

          {/* Labor Overruns Panel */}
          {activePanel === 'laborOverruns' && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
              <div className="bg-white w-full sm:w-4/5 md:max-w-2xl h-full overflow-auto p-4 md:p-6 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold">Labor Overrun Summary</h3>
                  <Button variant="ghost" size="sm" onClick={() => setActivePanel(null)}>
                    <XCircle className="h-5 w-5" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-lg font-bold">8</div>
                    <div className="text-sm text-gray-500">Parts with Overruns</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-lg font-bold">24.5</div>
                    <div className="text-sm text-gray-500">Total Overrun Hours</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-lg font-bold">$4,875.50</div>
                    <div className="text-sm text-gray-500">Total Overrun Cost</div>
                  </div>
                </div>

                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle p-4 sm:p-0">
                    <table className="min-w-full border-collapse">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="p-2 text-left">Part</th>
                          <th className="p-2 text-left">Work Center</th>
                          <th className="p-2 text-left">Task</th>
                          <th className="p-2 text-right">Extra Hours</th>
                          <th className="p-2 text-right">Extra Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {[...Array(5)].map((_, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="p-2">Part {i + 1}</td>
                            <td className="p-2">{['HBM', 'DNI', 'CD', 'INSPECT', 'MACHINING'][i]}</td>
                            <td className="p-2">Task description {i + 1}</td>
                            <td className="p-2 text-right">{(Math.random() * 10).toFixed(1)}</td>
                            <td className="p-2 text-right">${(Math.random() * 1000).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cost Drivers Panel */}
          {activePanel === 'costDrivers' && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
              <div className="bg-white w-full sm:w-4/5 md:max-w-2xl h-full overflow-auto p-4 md:p-6 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold">Top Labor Cost Drivers</h3>
                  <Button variant="ghost" size="sm" onClick={() => setActivePanel(null)}>
                    <XCircle className="h-5 w-5" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-lg font-bold">$12,450.23</div>
                    <div className="text-sm text-gray-500">Total Cost From Top 4</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-lg font-bold">68%</div>
                    <div className="text-sm text-gray-500">% of Total Overrun</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-lg font-bold">23.4%</div>
                    <div className="text-sm text-gray-500">Labor Cost Over Plan</div>
                  </div>
                </div>

                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle p-4 sm:p-0">
                    <table className="min-w-full border-collapse text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="p-2 text-left">Part</th>
                          <th className="p-2 text-left">Task</th>
                          <th className="p-2 text-left">Work Center</th>
                          <th className="p-2 text-right">Planned</th>
                          <th className="p-2 text-right">Actual</th>
                          <th className="p-2 text-right">Cost Overrun</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {[...Array(4)].map((_, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="p-2">{['Volute Casing', 'Impellers', 'Shaft Assembly', 'Bearing Housing'][i]}</td>
                            <td className="p-2">Task {i + 1}</td>
                            <td className="p-2">{['HBM', 'DNI', 'LATHE', 'MACHINING'][i]}</td>
                            <td className="p-2 text-right">{(Math.random() * 10 + 5).toFixed(1)} hrs</td>
                            <td className="p-2 text-right">{(Math.random() * 15 + 5).toFixed(1)} hrs</td>
                            <td className="p-2 text-right">${(Math.random() * 2000 + 500).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;