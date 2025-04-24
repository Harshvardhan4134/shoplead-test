import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, isAfter, isBefore, addMinutes } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Job,
  PurchaseOrder,
  ShipmentLog,
  WorkCenter,
  NCR,
  JobTimeline,
  VendorOperation,
  Reminder
} from "@/shared/schema";
import {
  RefreshCw,
  Check,
  Upload,
  Plus,
  Bell,
  AlertTriangle,
  MoreVertical,
  Edit,
  Flag,
  TrashIcon
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { handleImport } from "@/api/import";
import { api } from "@/services/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from '@/components/ui/use-toast';
import { JobModal } from "@/components/jobs/JobModal";

// Add delay utility function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface Update {
  type: 'note' | 'reminder' | 'priority';
  job_id?: number;
  job_number?: string;
  content: string;
  title?: string;
  date: string;
}

export default function Dashboard() {
  const [isImporting, setIsImporting] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [reminderContent, setReminderContent] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [upcomingReminders, setUpcomingReminders] = useState<Array<{
    job: Job;
    reminder: {
      date: string;
      description: string;
    }
  }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"updates" | "reminders">("updates");

  // Add state for tracking updates
  const [updates, setUpdates] = useState<Array<{
    type: 'note' | 'reminder' | 'priority';
    job_id?: number;
    job_number?: string;
    content: string;
    title?: string;
    date: string;
  }>>([]);

  // Add real-time clock state
  const [currentTime, setCurrentTime] = useState(new Date());

  // Add state for JobModal
  const [selectedJobNumber, setSelectedJobNumber] = useState<string | null>(null);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);

  // Fetch jobs with proper error handling and loading states
  const {
    data: jobs = [],
    isLoading: isLoadingJobs,
    error: jobsError,
    refetch: refetchJobs
  } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    queryFn: async () => {
      try {
        // Try to get data from cache first
        const cachedData = queryClient.getQueryData<Job[]>(["/api/jobs"]);
        if (cachedData && cachedData.length > 0) {
          console.log("Using cached jobs data:", cachedData.length);
          return cachedData;
        }

        // If no cached data, fetch from API
        const data = await api.getJobs();
        console.log("Fetched jobs data from API:", data.length);
        return data;
      } catch (error) {
        console.error("Error fetching jobs:", error);
        throw error;
      }
    },
    initialData: [],
  });

  // Fetch purchase orders with proper error handling
  const {
    data: purchaseOrders = [],
    isLoading: isLoadingPOs,
    error: posError,
    refetch: refetchPOs
  } = useQuery<PurchaseOrder[]>({
    queryKey: ["/api/purchase-orders"],
    queryFn: async () => {
      try {
        const cachedData = queryClient.getQueryData<PurchaseOrder[]>(["/api/purchase-orders"]);
        if (cachedData && cachedData.length > 0) {
          console.log("Using cached purchase orders data:", cachedData.length);
          return cachedData;
        }

        // If no cached data, fetch from API
        const data = await api.getPurchaseOrders();
        console.log("Fetched purchase orders from API:", data.length);
        return data;
      } catch (error) {
        console.error("Error fetching purchase orders:", error);
        throw error;
      }
    },
    initialData: [],
  });

  // Fetch shipment logs with proper error handling
  const {
    data: shipmentLogs = [],
    isLoading: isLoadingShipments,
    error: shipmentsError,
    refetch: refetchShipments
  } = useQuery<ShipmentLog[]>({
    queryKey: ["/api/shipment-logs"],
    queryFn: async () => {
      try {
        const cachedData = queryClient.getQueryData<ShipmentLog[]>(["/api/shipment-logs"]);
        if (cachedData && cachedData.length > 0) {
          console.log("Using cached shipment logs data:", cachedData.length);
          return cachedData;
        }

        // If no cached data, fetch from API
        const data = await api.getShipmentLogs();
        console.log("Fetched shipment logs from API:", data.length);
        return data;
      } catch (error) {
        console.error("Error fetching shipment logs:", error);
        throw error;
      }
    },
    initialData: [],
  });

  // Fetch work centers
  const { data: workCenters = [] } = useQuery<WorkCenter[]>({
    queryKey: ["/api/work-centers"],
  });

  // Fetch NCRs
  const { data: ncrs = [] } = useQuery<NCR[]>({
    queryKey: ["/api/ncrs"],
  });

  // Filter active jobs
  const activeJobs = jobs?.filter(job =>
    job.status !== 'Completed' &&
    job.status !== 'Delayed'
  ) || [];

  // Filter jobs based on search query with type safety
  const filteredJobs = activeJobs.filter(job => {
    const searchLower = searchQuery.toLowerCase();
    const jobNumber = String(job.job_number); // Convert to string
    const title = String(job.title || ''); // Convert to string with fallback
    const customer = String(job.customer || ''); // Convert to string with fallback

    return (
      jobNumber.toLowerCase().includes(searchLower) ||
      title.toLowerCase().includes(searchLower) ||
      customer.toLowerCase().includes(searchLower)
    );
  });

  // Sort jobs by priority and due date
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    if (a.progress < 30 && b.progress >= 30) return -1;
    if (a.progress >= 30 && b.progress < 30) return 1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  // Add clock update effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Update the addNoteMutation to properly handle notes array and updates
  const addNoteMutation = useMutation({
    mutationFn: async (data: { note: { title: string; content: string } }) => {
      await delay(500);

      // Get current jobs from cache
      const currentJobs = queryClient.getQueryData<Job[]>(["/api/jobs"]) || [];

      // Create new note
      const newNote = {
        title: data.note.title,
        content: data.note.content,
        createdAt: new Date().toISOString()
      };

      // Update all jobs with the new note
      const updatedJobs = currentJobs.map(job => ({
        ...job,
        notes: Array.isArray(job.notes) ? [newNote, ...job.notes] : [newNote]
      }));

      // Update the cache immediately
      queryClient.setQueryData(["/api/jobs"], updatedJobs);

      // Add to updates
      setUpdates(prev => [{
        type: 'note',
        content: data.note.content,
        title: data.note.title,
        date: new Date().toISOString()
      }, ...prev]);

      // Force a refetch of the jobs query
      await queryClient.invalidateQueries({ exact: true, queryKey: ["/api/jobs"] });

      return newNote;
    },
    onSuccess: () => {
      toast({
        title: "Note added successfully",
        description: "Your note has been added to all jobs",
      });
      setNoteTitle("");
      setNoteContent("");
    },
    onError: (error) => {
      console.error("Error adding note:", error);
      toast({
        title: "Failed to add note",
        description: "There was an error adding your note",
        variant: "destructive",
      });
    },
  });

  // Update the addReminderMutation to properly handle reminders array and updates
  const addReminderMutation = useMutation({
    mutationFn: async ({ jobId, reminder }: { jobId: number, reminder: Reminder }) => {
      const job = jobs?.find(j => j.id === jobId);
      if (!job) throw new Error('Job not found');

      const updatedJob = {
        ...job,
        reminders: [...job.reminders, JSON.stringify({ date: reminder.date, description: reminder.description })]
      };

      return await api.addReminder(jobId, reminder);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({
        title: 'Success',
        description: 'Reminder added successfully'
      });
    },
    onError: (error) => {
      console.error('Error adding reminder:', error);
      toast({
        title: 'Error',
        description: 'Failed to add reminder',
        variant: 'destructive'
      });
    }
  });

  // Add metrics calculation
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
      ((completedJobs - delayedJobs) / totalJobs * 100).toFixed(0) : 0;

    const machineUtilization = workCenters.length > 0 ?
      (workCenters.reduce((acc, wc) => acc + wc.utilization, 0) / workCenters.length).toFixed(0) : 0;

    const qualityRating = totalJobs > 0 ?
      ((totalJobs - ncrs.length) / totalJobs * 100).toFixed(0) : 0;

    return {
      onTimeDelivery,
      machineUtilization,
      qualityRating,
      inProgressJobs,
      completedJobs,
      scheduledJobs,
      delayedJobs
    };
  };

  // Add scheduling data calculation
  const calculateSchedulingData = () => {
    // Get current date
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Start from Sunday

    // Calculate work center utilization based on jobs
    const workCenterUtilization = workCenters.map(wc => {
      const workCenterJobs = jobs.filter(job =>
        job.work_center === wc.name &&
        (job.status === "In Progress" || job.status === "New")
      );

      const utilization = workCenterJobs.length > 0
        ? Math.round((workCenterJobs.filter(job => job.status === "In Progress").length / workCenterJobs.length) * 100)
        : 0;

      return {
        name: wc.name,
        utilization: utilization,
        activeJobs: workCenterJobs.length
      };
    }).sort((a, b) => b.utilization - a.utilization); // Sort by utilization

    // Get all scheduled jobs
    const scheduledJobs = jobs
      .filter(job => job.status === "In Progress" || job.status === "New")
      .map(job => ({
        id: job.id,
        job_number: job.job_number,
        title: job.title,
        due_date: job.due_date,
        scheduled_date: job.scheduled_date || job.due_date,
        priority: job.priority || (job.progress < 30 ? "High" : job.progress < 70 ? "Medium" : "Low"),
        work_center: job.work_center
      }));

    // Create calendar days
    const calendarDays = Array.from({ length: 14 }).map((_, index) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + index);
      return {
        date,
        jobs: scheduledJobs.filter(job => {
          const jobDate = new Date(job.scheduled_date);
          return jobDate.getDate() === date.getDate() &&
            jobDate.getMonth() === date.getMonth() &&
            jobDate.getFullYear() === date.getFullYear();
        })
      };
    });

    return {
      workCenterUtilization,
      calendarDays,
      scheduledJobs
    };
  };

  // Update the priority mutation to handle updates
  const updatePriorityMutation = useMutation({
    mutationFn: async ({ job_id, priority }: { job_id: number | string; priority: "High" | "Medium" | "Low" }) => {
      await delay(500);
      const currentJobs = queryClient.getQueryData<Job[]>(["/api/jobs"]) || [];
      const job = currentJobs.find(j => j.id === Number(job_id));

      const updatedJobs = currentJobs.map(j => {
        if (j.id === Number(job_id)) {
          return {
            ...j,
            priority: priority,
            progress: priority === "High" ? 20 : priority === "Medium" ? 50 : 80
          };
        }
        return j;
      });

      // Update the cache immediately
      queryClient.setQueryData(["/api/jobs"], updatedJobs);

      // Add to updates
      setUpdates(prev => [{
        type: 'priority',
        job_id: Number(job_id),
        job_number: job?.job_number?.toString(),
        content: `Priority changed to ${priority}`,
        date: new Date().toISOString()
      }, ...prev]);

      // Force a refetch to ensure UI updates
      await queryClient.invalidateQueries({ exact: true, queryKey: ["/api/jobs"] });

      return { job_id: Number(job_id), priority };
    },
    onSuccess: (data) => {
      // Force a re-render of the component
      const currentJobs = queryClient.getQueryData<Job[]>(["/api/jobs"]) || [];
      queryClient.setQueryData(["/api/jobs"], [...currentJobs]);

      toast({
        title: "Priority updated",
        description: "Job priority has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update priority",
        description: "There was an error updating the job priority",
        variant: "destructive",
      });
    },
  });

  // Update the reminder check effect
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const upcoming = jobs.flatMap(job =>
        (Array.isArray(job.reminders) ? job.reminders : [])
          .filter(reminder => {
            const reminderDate = new Date(reminder.date);
            const diffMinutes = (reminderDate.getTime() - now.getTime()) / (1000 * 60);
            return diffMinutes > 0 && diffMinutes <= 15;
          })
          .map(reminder => ({
            job_number: job.job_number,
            job_title: job.title,
            ...reminder
          }))
      );

      setUpcomingReminders(upcoming.map(reminder => ({
        job: jobs.find(j => j.job_number === reminder.job_number)!,
        reminder: {
          date: reminder.date,
          description: reminder.description
        }
      })));

      upcoming.forEach(reminder => {
        toast({
          title: `Upcoming Reminder for Job #${reminder.job_number}`,
          description: `${reminder.description} - Due at ${format(new Date(reminder.date), "HH:mm")}`,
          variant: "default",
          duration: 10000,
        });
      });
    };

    const interval = setInterval(checkReminders, 60000);
    checkReminders();

    return () => clearInterval(interval);
  }, [jobs, toast]);

  // Import Data mutation with logistics handling
  const importDataMutation = useMutation({
    mutationFn: async (file: File) => {
      setIsImporting(true);
      try {
        const data = await handleImport(file);
        console.log("Import data:", {
          jobs: data.jobs?.length,
          workCenters: data.workCenters?.length,
          purchaseOrders: data.purchaseOrders?.length,
          shipmentLogs: data.shipmentLogs?.length
        });

        // Immediately update the cache with the new data
        if (data.jobs?.length > 0) {
          queryClient.setQueryData(["/api/jobs"], data.jobs);
        }
        if (data.purchaseOrders?.length > 0) {
          queryClient.setQueryData(["/api/purchase-orders"], data.purchaseOrders);
        }
        if (data.shipmentLogs?.length > 0) {
          queryClient.setQueryData(["/api/shipment-logs"], data.shipmentLogs);
        }

        return data;
      } catch (error) {
        console.error("Import error:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("Import successful, data:", {
        jobs: data.jobs?.length || 0,
        workCenters: data.workCenters?.length || 0,
        purchaseOrders: data.purchaseOrders?.length || 0,
        shipmentLogs: data.shipmentLogs?.length || 0
      });
      setIsImporting(false);

      // Force a refetch of all queries
      refetchJobs();
      refetchPOs();
      refetchShipments();

      toast({
        title: "Data imported successfully",
        description: `Imported ${data.jobs?.length || 0} jobs, ${data.purchaseOrders?.length || 0} purchase orders, ${data.shipmentLogs?.length || 0} shipment logs`,
      });
    },
    onError: (error) => {
      console.error("Import failed:", error);
      setIsImporting(false);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Failed to import data",
        variant: "destructive",
      });
    },
  });

  const handleImportData = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log("Uploading file:", file.name); // Debug log
    importDataMutation.mutate(file);
  };

  // Show loading states
  if (isLoadingJobs || isLoadingPOs || isLoadingShipments) {
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
  if (jobsError || posError || shipmentsError) {
    return (
      <div className="container mx-auto p-8">
        <Alert variant="destructive">
          <AlertTitle>Error loading dashboard</AlertTitle>
          <AlertDescription>
            {jobsError instanceof Error ? jobsError.message : "Failed to load dashboard data"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleAddNote = () => {
    if (!noteTitle.trim() || !noteContent.trim()) return;
    addNoteMutation.mutate({
      note: {
        title: noteTitle.trim(),
        content: noteContent.trim(),
      }
    });
  };

  const handleAddReminder = async (jobId: number | string, reminderDate: string, reminderDescription: string) => {
    try {
      const job = jobs.find(j => j.id === Number(jobId));
      if (!job) return;

      const newReminder = {
        date: reminderDate,
        description: reminderDescription
      };

      // Update the job with the new reminder
      await api.addReminder(Number(jobId), newReminder);

      // Refetch jobs to update the UI
      await refetchJobs();

      // Add to updates
      const update: Update = {
        type: 'reminder',
        job_id: Number(jobId),
        job_number: job.job_number,
        content: reminderDescription,
        date: reminderDate
      };

      setUpdates(prev => [...prev, update]);

      // Clear the form
      setReminderContent("");
      setReminderDate("");

      toast({
        title: "Reminder added",
        description: "The reminder has been added successfully."
      });
    } catch (error) {
      console.error("Error adding reminder:", error);
      toast({
        title: "Error",
        description: "Failed to add reminder. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteReminder = async (index: number) => {
    if (!selectedJob) return;

    try {
      const updatedReminders = selectedJob.reminders.filter((_, i) => i !== index);
      const updatedJob = {
        ...selectedJob,
        reminders: updatedReminders
      };

      // Since we don't have an updateJob API method, we'll just update the local state for now
      setSelectedJob(updatedJob);
    } catch (error) {
      console.error('Error deleting reminder:', error);
    }
  };

  // Update the reminder display
  const reminderAlerts = upcomingReminders.map(({ job, reminder }) => (
    <Alert key={`${job.id}-${reminder.date}`} className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Upcoming Reminder</AlertTitle>
      <AlertDescription>
        <div className="flex justify-between items-center">
          <div>
            <p className="font-medium">Job #{job.job_number}</p>
            <p>{reminder.description}</p>
            <p className="text-sm text-gray-500">
              Due: {format(new Date(reminder.date), "MMM dd, yyyy HH:mm")}
            </p>
          </div>
          <Button variant="outline" size="sm">
            View Job
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  ));

  // Add debug logging for data
  useEffect(() => {
    console.log("Current jobs data:", jobs);
    console.log("Current purchase orders:", purchaseOrders);
  }, [jobs, purchaseOrders]);

  // Update the Daily Updates section to show all updates
  const dailyUpdates = activeTab === "updates" ? (
    <>
      {/* Notes section */}
      {updates.filter(update => update.type === 'note').map((update, index) => (
        <div key={`note-${index}`} className="flex mb-4">
          <div className="flex-shrink-0 mr-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600">
              {update.title?.slice(0, 2).toUpperCase() || 'NA'}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 w-full">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">{update.title || 'Untitled'}</h3>
              </div>
              <span className="text-xs text-gray-500">
                {format(new Date(update.date), "MMM dd, yyyy HH:mm")}
              </span>
            </div>
            <p className="text-sm mt-1">{update.content}</p>
          </div>
        </div>
      ))}
      {/* Priority updates */}
      {updates.filter(update => update.type === 'priority').map((update, index) => (
        <div key={`priority-${index}`} className="flex mb-4">
          <div className="flex-shrink-0 mr-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600">
              <Flag className="h-4 w-4" />
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 w-full">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Job #{update.job_number}</h3>
              </div>
              <span className="text-xs text-gray-500">
                {format(new Date(update.date), "MMM dd, yyyy HH:mm")}
              </span>
            </div>
            <p className="text-sm mt-1">{update.content}</p>
          </div>
        </div>
      ))}
    </>
  ) : (
    // Reminders section
    <>
      {selectedJob?.reminders?.map((reminder, index) => (
        <div key={index} className="flex items-center justify-between p-2 border-b">
          <div>
            <p className="text-sm font-medium">{reminder.description}</p>
            <p className="text-xs text-gray-500">{format(new Date(reminder.date), "MMM dd, yyyy HH:mm")}</p>
          </div>
          <button
            onClick={() => handleDeleteReminder(index)}
            className="text-red-500 hover:text-red-700"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ))}
    </>
  );

  // Update the status display in the table
  const getStatusColor = (status: string) => {
    switch (status) {
      case "In Progress":
        return "bg-blue-100 text-blue-800";
      case "New":
        return "bg-gray-100 text-gray-800";
      case "On Hold":
        return "bg-yellow-100 text-yellow-800";
      case "Completed":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Purchase order display
  const renderPurchaseOrders = () => {
    return purchaseOrders.slice(0, 4).map(po => {
      // Validate the date and price
      const documentDate = po.document_date ? new Date(po.document_date) : null;
      const isValidDate = documentDate && !isNaN(documentDate.getTime());
      const netPrice = typeof po.net_price === 'number' ? po.net_price : 0;

      return (
        <tr key={po.id} className="hover:bg-gray-50">
          <td className="py-3 px-4">
            <div className="font-medium text-blue-600">{po.purchasing_document}</div>
            <div className="text-xs text-gray-500">
              {isValidDate ? format(documentDate!, "MMM dd, yyyy") : "No date"}
            </div>
          </td>
          <td className="py-3 px-4">
            <div className="font-medium">{po.vendor}</div>
            <div className="text-xs text-gray-500">
              ${netPrice.toFixed(2)}
            </div>
          </td>
          <td className="py-3 px-4">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${po.status === "Completed" ? "bg-green-100 text-green-800" :
              po.status === "Open" ? "bg-yellow-100 text-yellow-800" :
                po.status === "Cancelled" ? "bg-red-100 text-red-800" :
                  "bg-gray-100 text-gray-800"
              }`}>
              {po.status}
            </span>
          </td>
          <td className="py-3 px-4 text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit PO
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Flag className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </td>
        </tr>
      );
    });
  };

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <span className="text-gray-500">|</span>
          <div className="flex items-center space-x-2 text-gray-600">
            <span>{format(currentTime, "EEEE")}</span>
            <span>|</span>
            <span>{format(currentTime, "MMM dd, yyyy")}</span>
            <span>|</span>
            <span className="font-medium">{format(currentTime, "HH:mm:ss")}</span>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="flex items-center h-9"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleImportData}
            className="flex items-center bg-blue-600 text-white h-9"
            disabled={isImporting}
          >
            {isImporting ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import Data
              </>
            )}
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center h-9">
                <Plus className="h-4 w-4 mr-2" />
                Add Note
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Daily Update Note</DialogTitle>
                <DialogDescription>
                  Add a new note to track daily updates and progress.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="Note title"
                    required
                  />
                </div>
                <div>
                  <Label>Note Content</Label>
                  <Textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Note content"
                    required
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => {
                    setNoteTitle("");
                    setNoteContent("");
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddNote} disabled={!noteTitle.trim() || !noteContent.trim()}>
                    Save Note
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center h-9">
                <Bell className="h-4 w-4 mr-2" />
                Add Reminder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Reminder</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Select Job</Label>
                  <select
                    className="w-full p-2 border rounded"
                    onChange={(e) => setSelectedJob(jobs.find(j => j.id === Number(e.target.value)) || null)}
                  >
                    <option value="">Select a job</option>
                    {jobs.map(job => (
                      <option key={`job-${job.id}`} value={job.id}>
                        {job.job_number} - {job.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Reminder Date</Label>
                  <Input
                    type="datetime-local"
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Reminder Content</Label>
                  <Textarea
                    value={reminderContent}
                    onChange={(e) => setReminderContent(e.target.value)}
                    placeholder="Enter your reminder here..."
                  />
                </div>
                <Button
                  onClick={() => {
                    if (selectedJob?.id) {
                      handleAddReminder(selectedJob.id, reminderDate, reminderContent)
                    }
                  }}
                  disabled={!selectedJob || !reminderContent.trim() || !reminderDate}
                >
                  Add Reminder
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {reminderAlerts.length > 0 && (
        <div className="mb-6">
          {reminderAlerts}
        </div>
      )}

      {/* Active Jobs section with scrollable container */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-medium">Active Jobs</h2>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Search jobs..."
              className="px-3 py-1 border rounded-md text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="border rounded-lg">
          <div className="overflow-x-auto" style={{ maxHeight: "500px" }}>
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Job Number</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedJobs.length > 0 ? (
                  sortedJobs.map((job) => (
                    <tr key={job.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => {
                      setSelectedJobNumber(job.job_number);
                      setIsJobModalOpen(true);
                    }}>
                      <td className="py-3 px-4 font-medium">{job.job_number}</td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium">{job.title}</div>
                          {job.description && (
                            <div className="text-sm text-gray-500">{job.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">{format(new Date(job.due_date), "MMM dd, yyyy")}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-1 text-xs rounded-md ${getStatusColor(job.status)}`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`
                          ${job.progress < 30 || job.priority === "High" ? "text-red-500 font-medium" :
                            job.progress < 70 || job.priority === "Medium" ? "text-yellow-500 font-medium" : "text-gray-600"}
                      `}>
                          {job.priority || (job.progress < 30 ? "High" : job.progress < 70 ? "Medium" : "Normal")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end space-x-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <button
                                onClick={() => setSelectedJob(job)}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <Bell className="h-4 w-4" />
                              </button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Add Reminder for Job #{job.job_number}</DialogTitle>
                                <DialogDescription>
                                  Set a reminder for this job to stay on track.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label>Reminder Date</Label>
                                  <Input
                                    type="datetime-local"
                                    value={reminderDate}
                                    onChange={(e) => setReminderDate(e.target.value)}
                                  />
                                </div>
                                <div>
                                  <Label>Reminder Content</Label>
                                  <Textarea
                                    value={reminderContent}
                                    onChange={(e) => setReminderContent(e.target.value)}
                                    placeholder="Enter your reminder here..."
                                  />
                                </div>
                                <Button
                                  onClick={() => {
                                    setSelectedJob(job);
                                    handleAddReminder(job.id, reminderDate, reminderContent);
                                  }}
                                  disabled={!reminderContent.trim() || !reminderDate}
                                >
                                  Add Reminder
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="text-gray-400 hover:text-gray-600">
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                updatePriorityMutation.mutate({ job_id: job.id, priority: "High" });
                              }}>
                                <Flag className="h-4 w-4 mr-2 text-red-500" />
                                Set High Priority
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                updatePriorityMutation.mutate({ job_id: job.id, priority: "Medium" });
                              }}>
                                <Flag className="h-4 w-4 mr-2 text-yellow-500" />
                                Set Medium Priority
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                updatePriorityMutation.mutate({ job_id: job.id, priority: "Low" });
                              }}>
                                <Flag className="h-4 w-4 mr-2 text-green-500" />
                                Set Low Priority
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-sm text-gray-500">
                      No active jobs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="text-right text-sm p-2 border-t">
            <span className="text-gray-500">Showing {sortedJobs.length} of {activeJobs.length} jobs</span>
          </div>
        </div>
      </div>

      {/* Upcoming Deadlines and Daily Updates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Upcoming Deadlines with scrollable container */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium">Upcoming Deadlines</h2>
          </div>
          <div className="border rounded-lg">
            <div className="overflow-y-auto" style={{ maxHeight: "400px" }}>
              {sortedJobs.map(job => (
                <div key={job.id} className={`border-l-4 ${job.priority === "High" ? "border-red-500" :
                  job.priority === "Medium" ? "border-yellow-500" :
                    job.priority === "Low" ? "border-green-500" :
                      job.progress < 30 ? "border-red-500" :
                        job.progress < 70 ? "border-yellow-500" :
                          "border-green-500"
                  } pl-4 py-2`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-sm font-medium">Job #{job.job_number} - {job.title}</h3>
                      <p className="text-xs text-gray-500">Due: {format(new Date(job.due_date), "MMM dd, yyyy")}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className={`${job.priority === "High" ? "text-red-500" :
                            job.priority === "Medium" ? "text-yellow-500" :
                              job.priority === "Low" ? "text-green-500" :
                                ""
                            }`}>
                            <Flag className="h-4 w-4 mr-2" />
                            {job.priority || "Priority"}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            updatePriorityMutation.mutate({ job_id: job.id, priority: "High" });
                          }}>
                            <Flag className="h-4 w-4 mr-2 text-red-500" />
                            Set High Priority
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            updatePriorityMutation.mutate({ job_id: job.id, priority: "Medium" });
                          }}>
                            <Flag className="h-4 w-4 mr-2 text-yellow-500" />
                            Set Medium Priority
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            updatePriorityMutation.mutate({ job_id: job.id, priority: "Low" });
                          }}>
                            <Flag className="h-4 w-4 mr-2 text-green-500" />
                            Set Low Priority
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Bell className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Reminder for Job #{job.job_number}</DialogTitle>
                            <DialogDescription>
                              Set a reminder for this job to stay on track.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>Reminder Date</Label>
                              <Input
                                type="datetime-local"
                                value={reminderDate}
                                onChange={(e) => setReminderDate(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label>Reminder Content</Label>
                              <Textarea
                                value={reminderContent}
                                onChange={(e) => setReminderContent(e.target.value)}
                                placeholder="Enter your reminder here..."
                              />
                            </div>
                            <Button
                              onClick={() => {
                                setSelectedJob(job);
                                handleAddReminder(job.id, reminderDate, reminderContent);
                              }}
                              disabled={!reminderContent.trim() || !reminderDate}
                            >
                              Add Reminder
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="bg-gray-200 h-1.5 w-full rounded-full">
                      <div
                        className={`h-1.5 rounded-full ${job.priority === "High" ? "bg-red-500" :
                          job.priority === "Medium" ? "bg-yellow-500" :
                            job.priority === "Low" ? "bg-green-500" :
                              job.progress < 30 ? "bg-red-500" :
                                job.progress < 70 ? "bg-yellow-500" :
                                  "bg-green-500"
                          }`}
                        style={{ width: `${job.progress}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-gray-500">
                      <span>Progress: {job.progress}%</span>
                      <span>Priority: {job.priority ||
                        (job.progress < 30 ? "High" :
                          job.progress < 70 ? "Medium" :
                            "Low")
                      }</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Daily Updates with tabs and scrollable container */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium">Daily Updates</h2>
            <div className="flex space-x-4">
              <button
                className={`text-sm px-3 py-1 border-b-2 ${activeTab === "updates"
                  ? "text-blue-600 border-blue-600"
                  : "text-gray-500 border-transparent"
                  }`}
                onClick={() => setActiveTab("updates")}
              >
                Updates
              </button>
              <button
                className={`text-sm px-3 py-1 border-b-2 ${activeTab === "reminders"
                  ? "text-blue-600 border-blue-600"
                  : "text-gray-500 border-transparent"
                  }`}
                onClick={() => setActiveTab("reminders")}
              >
                Reminders
              </button>
            </div>
          </div>
          <div className="border rounded-lg">
            <div className="overflow-y-auto p-4" style={{ maxHeight: "400px" }}>
              {dailyUpdates}
            </div>
          </div>
        </div>
      </div>

      {/* Logistics & Purchase Orders and Scheduling Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Logistics & Purchase Orders */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium">Logistics & Purchase Orders</h2>
            <Button variant="outline" size="sm" className="text-blue-600">
              View All ({purchaseOrders.length})
            </Button>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">PO Number</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.length > 0 ? (
                  renderPurchaseOrders()
                ) : (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-sm text-gray-500">
                      No purchase orders found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Scheduling Overview */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium">Scheduling Overview</h2>
            <Link to="/scheduling" className="text-blue-600 text-sm hover:underline">
              Go to Scheduling
            </Link>
          </div>
          <div className="mb-4">
            <h3 className="text-sm text-gray-500 mb-2">Current production schedule:</h3>
            <div className="grid grid-cols-7 gap-1">
              {/* Calendar header and days */}
              {calculateSchedulingData().calendarDays.slice(0, 7).map((day, index) => (
                <div key={`header-${index}`} className="py-2 bg-gray-100 text-center">
                  <div className="text-xs font-medium">{format(day.date, "EEE")}</div>
                  <div className="text-[10px] text-gray-500">{format(day.date, "MMM d")}</div>
                  {day.jobs.length > 0 && (
                    <div className="mt-1">
                      <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        {day.jobs.length}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <h3 className="text-sm text-gray-500 mb-2">Work Center Utilization</h3>
          <div className="space-y-2">
            {calculateSchedulingData().workCenterUtilization.map((wc, index) => (
              <div key={index}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-medium">{wc.name}</span>
                  <span className="text-xs">
                    {wc.utilization}% ({wc.activeJobs} jobs)
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${wc.utilization > 80 ? 'bg-red-500' :
                      wc.utilization > 50 ? 'bg-yellow-500' :
                        'bg-blue-500'
                      }`}
                    style={{ width: `${wc.utilization}%` }}
                  ></div>
                </div>
              </div>
            ))}
            {calculateSchedulingData().workCenterUtilization.length === 0 && (
              <div className="text-sm text-gray-500 text-center py-4">
                No work center data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Performance Metrics & Status Overview */}
      <div className="mb-8">
        <h2 className="text-lg font-medium mb-2">Performance Metrics & Status Overview</h2>
        <p className="text-sm text-gray-500 mb-3">Real-time efficiency and productivity metrics</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
          <div className="text-center p-4 border rounded-lg">
            <div className="text-4xl font-bold text-blue-600 mb-1">{calculateMetrics().onTimeDelivery}%</div>
            <div className="text-sm font-medium">On-Time Delivery</div>
            <div className="text-xs text-gray-500">Based on completed jobs</div>
          </div>

          <div className="text-center p-4 border rounded-lg">
            <div className="text-4xl font-bold text-blue-600 mb-1">{calculateMetrics().machineUtilization}%</div>
            <div className="text-sm font-medium">Machine Utilization</div>
            <div className="text-xs text-gray-500">Average across work centers</div>
          </div>

          <div className="text-center p-4 border rounded-lg">
            <div className="text-4xl font-bold text-blue-600 mb-1">{calculateMetrics().qualityRating}%</div>
            <div className="text-sm font-medium">Quality Rating</div>
            <div className="text-xs text-gray-500">Based on NCR reports</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold mb-1">{calculateMetrics().inProgressJobs}</div>
            <div className="text-sm text-gray-600">In Progress</div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold mb-1">{calculateMetrics().completedJobs}</div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold mb-1">{calculateMetrics().scheduledJobs}</div>
            <div className="text-sm text-gray-600">Scheduled</div>
          </div>

          <div className="bg-red-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold mb-1">{calculateMetrics().delayedJobs}</div>
            <div className="text-sm text-gray-600">Delayed</div>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-gray-400 mb-4">
        ShopLead Dashboard © 2025
      </div>

      {selectedJob && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Selected Job Details</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">{selectedJob.job_number} - {selectedJob.title}</h3>
              {selectedJob.description && (
                <p className="text-sm text-gray-600 mt-1">{selectedJob.description}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Status: {selectedJob.status}</p>
                <p className="text-sm text-gray-600">
                  Due Date: {selectedJob.due_date ? format(new Date(selectedJob.due_date), 'MMM d, yyyy') : 'Not set'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">
                  Scheduled Date: {selectedJob.scheduled_date ? format(new Date(selectedJob.scheduled_date), 'MMM d, yyyy') : 'Not set'}
                </p>
                <p className="text-sm text-gray-600">Priority: {selectedJob.priority}</p>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full ${selectedJob.priority === 'High'
                  ? 'bg-red-600'
                  : selectedJob.priority === 'Medium'
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                  }`}
                style={{ width: `${selectedJob.progress}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      <JobModal
        jobNumber={selectedJobNumber}
        isOpen={isJobModalOpen}
        onClose={() => {
          setIsJobModalOpen(false);
          setSelectedJobNumber(null);
        }}
      />
    </div>
  );
}