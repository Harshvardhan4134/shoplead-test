import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  RefreshCw,
  Search,
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Move
} from "lucide-react";
import { api } from "@/services/api";
import { Job, WorkOrder } from "@/shared/schema";
import { useToast } from "@/hooks/use-toast";
import "react-big-calendar/lib/css/react-big-calendar.css";

// Set up the localizer for the calendar
const localizer = momentLocalizer(moment);

// Define the status colors for work orders
const statusColors = {
  "Not Started": "#e5e7eb", // gray-200
  "In Progress": "#bfdbfe", // blue-200
  "Completed": "#bbf7d0", // green-200
  "On Hold": "#fef08a", // yellow-200
  "Cancelled": "#fecaca", // red-200
};

// Define the event types for the calendar
interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  jobId: number | string;
  workOrderId?: number | string;
  status: string;
  allDay?: boolean;
  workCenter?: string;
}

const Scheduling = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<"month" | "week" | "day">("week");
  const [date, setDate] = useState(new Date());
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [jobTypeFilter, setJobTypeFilter] = useState<string>("all");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [draggingWorkOrder, setDraggingWorkOrder] = useState<WorkOrder | null>(null);
  const queryClient = useQueryClient();
  const [debugInfo, setDebugInfo] = useState<string>("");

  // Fetch jobs
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
        return data || []; // Ensure we return an empty array if data is undefined
      } catch (error) {
        console.error("Error fetching jobs:", error);
        throw error;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
    refetchOnWindowFocus: false,
  });

  // Function to identify D&I jobs
  const isDismantlingInspectionJob = (job: Job): boolean => {
    // Check if job has only one work order
    const hasOneWorkOrder = !job.work_orders || job.work_orders.length === 1;
    
    // Check if job title or part name contains D&I related terms
    const titleLower = (job.title || '').toLowerCase();
    const partNameLower = (job.part_name || '').toLowerCase();
    
    const diTerms = ['dismantling', 'dismantle', 'inspection', 'inspect', 'd&i'];
    const hasDITerms = diTerms.some(term => 
      titleLower.includes(term) || partNameLower.includes(term)
    );
    
    return hasOneWorkOrder && hasDITerms;
  };

  // Filter active jobs (excluding D&I jobs if not selected)
  const activeJobs = jobs.filter(job => 
    job.status !== 'Completed' && 
    job.status !== 'Delayed' &&
    (jobTypeFilter === 'all' || 
     (jobTypeFilter === 'regular' && !isDismantlingInspectionJob(job)) ||
     (jobTypeFilter === 'di' && isDismantlingInspectionJob(job)))
  );

  // Filter jobs based on search query and selected job
  const filteredJobs = activeJobs.filter(job => {
    const searchLower = searchQuery.toLowerCase();
    const jobNumber = String(job.job_number);
    const title = String(job.title || '');
    const customer = String(job.customer || '');

    const matchesSearch = 
      jobNumber.toLowerCase().includes(searchLower) ||
      title.toLowerCase().includes(searchLower) ||
      customer.toLowerCase().includes(searchLower);

    const matchesJobFilter = jobFilter === 'all' || jobNumber === jobFilter;

    return matchesSearch && matchesJobFilter;
  });

  // Extract all work orders from filtered jobs
  const allWorkOrders: WorkOrder[] = [];
  filteredJobs.forEach(job => {
    if (job.work_orders && job.work_orders.length > 0) {
      job.work_orders.forEach(wo => {
        allWorkOrders.push({
          ...wo,
          job_id: job.id,
          job_number: job.job_number
        });
      });
    } else {
      // If no work orders, create a placeholder one
      allWorkOrders.push({
        id: `placeholder-${job.id}`,
        description: job.title || `Job #${job.job_number}`,
        status: job.status || "Not Started",
        job_id: job.id,
        job_number: job.job_number,
        operation_number: "1",
        planned_hours: job.planned_hours || 24
      });
    }
  });

  // Generate calendar events from job data
  useEffect(() => {
    const newEvents: CalendarEvent[] = [];
    
    jobs.forEach(job => {
      // Skip jobs that don't match the filter
      if (jobFilter !== 'all' && String(job.job_number) !== jobFilter) {
        return;
      }
      
      // Skip jobs that don't match the job type filter
      if (
        (jobTypeFilter === 'regular' && isDismantlingInspectionJob(job)) ||
        (jobTypeFilter === 'di' && !isDismantlingInspectionJob(job))
      ) {
        return;
      }
      
      if (job.scheduled_date) {
        // If the job has work orders, create an event for each work order
        if (job.work_orders && job.work_orders.length > 0) {
          job.work_orders.forEach((workOrder, index) => {
            // Calculate start and end times based on work order sequence
            const startDate = new Date(job.scheduled_date || job.due_date);
            startDate.setHours(8 + (index * 4) % 8);
            startDate.setDate(startDate.getDate() + Math.floor((index * 4) / 8));
            
            const endDate = new Date(startDate);
            const duration = workOrder.planned_hours || 4; // Default to 4 hours
            endDate.setHours(endDate.getHours() + Math.min(duration, 8));
            
            newEvents.push({
              id: `wo-${workOrder.id || index}-${job.id}`,
              title: `${job.job_number} - ${workOrder.description || `Operation ${workOrder.operation_number || index + 1}`}`,
              start: startDate,
              end: endDate,
              jobId: job.id,
              workOrderId: workOrder.id,
              status: workOrder.status || "Not Started",
              workCenter: workOrder.work_center
            });
          });
        } else {
          // If the job has no work orders, create a single all-day event
          const startDate = new Date(job.scheduled_date || job.due_date);
          const endDate = new Date(startDate);
          endDate.setHours(endDate.getHours() + 8);
          
          newEvents.push({
            id: `job-${job.id}`,
            title: `${job.job_number} - ${job.title || "No description"}`,
            start: startDate,
            end: endDate,
            jobId: job.id,
            status: job.status || "Not Started",
            workCenter: job.work_center
          });
        }
      }
    });
    
    setEvents(newEvents);
  }, [jobs, jobFilter, jobTypeFilter]);

  // Handle calendar event selection
  const handleSelectEvent = (event: CalendarEvent) => {
    // Find the job for this event
    const job = jobs.find(j => j.id === event.jobId);
    if (!job) return;
    
    toast({
      title: `Job #${job.job_number}`,
      description: `${event.title} - ${event.status}`,
    });
  };

  // Handle calendar slot selection (for adding new events)
  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
    if (jobFilter === 'all') {
      toast({
        title: "Please select a job",
        description: "Select a specific job to add to the schedule",
        variant: "destructive",
      });
      return;
    }
    
    // Find the selected job
    const selectedJob = jobs.find(job => String(job.job_number) === jobFilter);
    if (!selectedJob) return;
    
    // Create a placeholder work order
    const newWorkOrder = {
      id: `new-wo-${Date.now()}`,
      description: `Scheduled operation for ${selectedJob.job_number}`,
      status: "Not Started",
      job_id: selectedJob.id,
      job_number: selectedJob.job_number,
      operation_number: "1",
      planned_hours: 4,
      scheduled_date: start.toISOString()
    };
    
    // Create a new event
    const newEvent: CalendarEvent = {
      id: `new-event-${Date.now()}`,
      title: `${selectedJob.job_number} - New Operation`,
      start,
      end,
      jobId: selectedJob.id,
      workOrderId: newWorkOrder.id,
      status: "Not Started"
    };
    
    // Add the new event
    setEvents([...events, newEvent]);
    
    toast({
      title: "New operation scheduled",
      description: `Added operation for Job #${selectedJob.job_number}`,
    });
  };

  // A more direct approach to drag and drop 
  useEffect(() => {
    const initDragAndDrop = () => {
      console.log("Initializing drag and drop...");
      
      // Find all draggable work order elements
      const draggableElements = document.querySelectorAll('[data-workorder]');
      console.log("Found draggable elements:", draggableElements.length);
      
      const dropTarget = document.querySelector('[data-droppable="true"]');
      console.log("Found drop target:", !!dropTarget);
      
      if (!dropTarget) {
        console.error("No drop target found");
        return;
      }
      
      // Function to handle drag start
      const handleDragStart = (e) => {
        const workOrderJSON = e.currentTarget.getAttribute('data-workorder');
        if (!workOrderJSON) {
          console.error("No work order data found");
          return;
        }
        
        try {
          const workOrder = JSON.parse(workOrderJSON);
          console.log("Drag started for work order:", workOrder.id);
          setDraggingWorkOrder(workOrder);
          setDebugInfo(`Dragging: ${workOrder.description || workOrder.id}`);
          
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', workOrderJSON);
            
            // Create a custom drag image
            const ghostEl = document.createElement('div');
            ghostEl.textContent = workOrder.description || `Operation ${workOrder.operation_number}`;
            ghostEl.style.backgroundColor = '#bfdbfe';
            ghostEl.style.padding = '8px';
            ghostEl.style.borderRadius = '4px';
            ghostEl.style.position = 'absolute';
            ghostEl.style.top = '-1000px';
            document.body.appendChild(ghostEl);
            
            e.dataTransfer.setDragImage(ghostEl, 0, 0);
            
            // Remove ghost after drag
            setTimeout(() => {
              document.body.removeChild(ghostEl);
            }, 0);
          }
        } catch (error) {
          console.error("Error parsing work order data", error);
        }
      };
      
      // Function to handle drag over
      const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
      };
      
      // Function to handle drag enter
      const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropTarget.classList.add('bg-blue-50');
      };
      
      // Function to handle drag leave
      const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropTarget.classList.remove('bg-blue-50');
      };
      
      // Function to handle drop
      const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropTarget.classList.remove('bg-blue-50');
        console.log("Drop event triggered");
        
        try {
          const workOrderJSON = e.dataTransfer?.getData('text/plain');
          console.log("Data from drop event:", workOrderJSON ? "data found" : "no data");
          
          let workOrderData = null;
          
          if (workOrderJSON) {
            workOrderData = JSON.parse(workOrderJSON);
            setDebugInfo(`Drop: using data from dataTransfer`);
          } else if (draggingWorkOrder) {
            workOrderData = draggingWorkOrder;
            setDebugInfo(`Drop: using data from state`);
          }
          
          if (!workOrderData) {
            console.error("No work order data available for drop");
            setDebugInfo("Drop failed: No work order data");
            return;
          }
          
          console.log("Processing drop for work order:", workOrderData.id);
          
          // Create a default start date (current date at 8 AM)
          const startDate = new Date();
          startDate.setHours(8, 0, 0, 0);
          
          // Create a default end date based on planned hours
          const endDate = new Date(startDate);
          endDate.setHours(endDate.getHours() + (workOrderData.planned_hours || 4));
          
          // Create a new calendar event
          const newEvent = {
            id: `drag-event-${workOrderData.id}-${Date.now()}`,
            title: `${workOrderData.job_number} - ${workOrderData.description || `Operation ${workOrderData.operation_number}`}`,
            start: startDate,
            end: endDate,
            jobId: workOrderData.job_id,
            workOrderId: workOrderData.id,
            status: workOrderData.status || "Not Started",
            workCenter: workOrderData.work_center
          };
          
          console.log("Created new event:", newEvent);
          
          // Add the new event to the calendar
          setEvents(prev => [...prev, newEvent]);
          
          toast({
            title: "Work order scheduled",
            description: `Added ${workOrderData.description || `Operation ${workOrderData.operation_number}`} to schedule`,
          });
          
          // Clear dragging state
          setDraggingWorkOrder(null);
        } catch (error) {
          console.error("Error processing drop:", error);
          setDebugInfo(`Drop error: ${error instanceof Error ? error.message : String(error)}`);
        }
      };
      
      // Set up drag event listeners for each work order
      draggableElements.forEach(element => {
        element.addEventListener('dragstart', handleDragStart);
      });
      
      // Set up drop target event listeners
      dropTarget.addEventListener('dragover', handleDragOver);
      dropTarget.addEventListener('dragenter', handleDragEnter);
      dropTarget.addEventListener('dragleave', handleDragLeave);
      dropTarget.addEventListener('drop', handleDrop);
      
      // Return cleanup function
      return () => {
        draggableElements.forEach(element => {
          element.removeEventListener('dragstart', handleDragStart);
        });
        
        dropTarget.removeEventListener('dragover', handleDragOver);
        dropTarget.removeEventListener('dragenter', handleDragEnter);
        dropTarget.removeEventListener('dragleave', handleDragLeave);
        dropTarget.removeEventListener('drop', handleDrop);
      };
    };
    
    // Wait for DOM to be ready
    setTimeout(initDragAndDrop, 500);
    
  }, [jobs, jobFilter, jobTypeFilter, toast, draggingWorkOrder, setDebugInfo]);

  // Format events for the calendar
  const calendarEvents = events.map(event => ({
    ...event,
    title: event.title,
    backgroundColor: statusColors[event.status] || statusColors["Not Started"]
  }));
  
  // Custom event component for the calendar
  const EventComponent = ({ event }: any) => {
    return (
      <div
        style={{
          backgroundColor: statusColors[event.status] || statusColors["Not Started"],
          border: `1px solid ${event.status === "Not Started" ? "#9ca3af" : 
                           event.status === "In Progress" ? "#3b82f6" :
                           event.status === "Completed" ? "#22c55e" :
                           event.status === "On Hold" ? "#eab308" : "#ef4444"}`,
          borderRadius: "4px",
          padding: "2px 4px",
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          fontSize: "12px",
          height: "100%"
        }}
      >
        <div className="font-medium">{event.title}</div>
        {event.workCenter && (
          <div className="text-xs">{event.workCenter}</div>
        )}
      </div>
    );
  };

  // Show loading states
  if (isLoadingJobs) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>Loading scheduling data...</span>
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
                {jobsError instanceof Error ? jobsError.message : "Failed to load scheduling data"}
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
        <h1 className="text-2xl font-bold mb-1">Scheduling</h1>
        <p className="text-gray-600">Manage job operations and scheduling</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar with job list and work orders */}
        <div className="lg:col-span-1">
          {/* Job filter controls */}
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <h2 className="text-lg font-medium mb-4">Job Selection</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Job Type
                </label>
                <Select
                  value={jobTypeFilter}
                  onValueChange={setJobTypeFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Jobs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Jobs</SelectItem>
                    <SelectItem value="regular">Regular Jobs</SelectItem>
                    <SelectItem value="di">D&I Jobs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Select Job Number
                </label>
                <Select
                  value={jobFilter}
                  onValueChange={setJobFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Jobs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Jobs</SelectItem>
                    {activeJobs.map(job => (
                      <SelectItem key={job.id} value={String(job.job_number)}>
                        {job.job_number} - {job.title?.substring(0, 20)}
                        {job.title && job.title.length > 20 ? "..." : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Search Jobs
                </label>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search by job number or description..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Draggable work orders using HTML5 Drag & Drop */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">Work Orders</h2>
              <span className="text-sm text-gray-500">{allWorkOrders.length} items</span>
            </div>
            
            <p className="text-sm text-gray-500 mb-4">
              Drag work orders to the calendar to schedule them
            </p>
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {allWorkOrders.map((workOrder, index) => (
                <div
                  key={String(workOrder.id)}
                  draggable
                  data-workorder={JSON.stringify(workOrder)}
                  className="border rounded p-2 bg-gray-50 hover:bg-gray-100 cursor-move"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-medium text-blue-600">
                        Job #{workOrder.job_number}
                      </div>
                      <div className="text-sm">
                        {workOrder.description || `Operation ${workOrder.operation_number || "-"}`}
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div className={`px-2 py-1 text-xs rounded-full ${
                        workOrder.status === "Completed" ? "bg-green-100 text-green-800" :
                        workOrder.status === "In Progress" ? "bg-blue-100 text-blue-800" :
                        workOrder.status === "On Hold" ? "bg-yellow-100 text-yellow-800" :
                        "bg-gray-100 text-gray-800"
                      }`}>
                        {workOrder.status || "Not Started"}
                      </div>
                      <Move className="h-4 w-4 ml-1 text-gray-400" />
                    </div>
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-gray-500">
                    <span>
                      {workOrder.work_center || "No work center"}
                    </span>
                    <span>
                      {workOrder.planned_hours ? `${workOrder.planned_hours} hrs` : "No hours"}
                    </span>
                  </div>
                </div>
              ))}
              
              {allWorkOrders.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  No work orders found for the selected filters
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Calendar with drop zone */}
        <div 
          className="lg:col-span-3"
        >
          <div className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setDate(new Date())}
                >
                  Today
                  </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    const newDate = new Date(date);
                    if (view === "day") {
                      newDate.setDate(newDate.getDate() - 1);
                    } else if (view === "week") {
                      newDate.setDate(newDate.getDate() - 7);
                    } else {
                      newDate.setMonth(newDate.getMonth() - 1);
                    }
                    setDate(newDate);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    const newDate = new Date(date);
                    if (view === "day") {
                      newDate.setDate(newDate.getDate() + 1);
                    } else if (view === "week") {
                      newDate.setDate(newDate.getDate() + 7);
                    } else {
                      newDate.setMonth(newDate.getMonth() + 1);
                    }
                    setDate(newDate);
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                  </Button>
                <h2 className="text-lg font-medium">
                  {view === "day" ? format(date, "MMMM d, yyyy") :
                   view === "week" ? "Week of " + format(date, "MMMM d, yyyy") :
                   format(date, "MMMM yyyy")}
                </h2>
                </div>

              <div className="flex items-center space-x-2">
                <Button 
                  variant={view === "month" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setView("month")}
                >
                  Month
                </Button>
                <Button 
                  variant={view === "week" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setView("week")}
                >
                  Week
                  </Button>
                <Button 
                  variant={view === "day" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setView("day")}
                >
                  Day
                  </Button>
                </div>
              </div>

            <div 
              className="h-[600px]"
              data-droppable="true"
            >
              <Calendar
                localizer={localizer}
                events={calendarEvents}
                startAccessor="start"
                endAccessor="end"
                view={view}
                date={date}
                onNavigate={setDate}
                onView={(newView: any) => setView(newView)}
                selectable
                onSelectEvent={handleSelectEvent}
                onSelectSlot={handleSelectSlot}
                components={{
                  event: EventComponent
                }}
                eventPropGetter={(event) => ({
                  style: {
                    backgroundColor: statusColors[event.status] || statusColors["Not Started"]
                  }
                })}
              />
                    </div>
                </div>
              </div>
            </div>
      
      {/* Legend */}
      <div className="mt-6 bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-medium mb-2">Status Legend</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center">
            <div className="w-4 h-4 rounded mr-2" style={{ backgroundColor: statusColors["Not Started"] }}></div>
            <span className="text-sm">Not Started</span>
                      </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded mr-2" style={{ backgroundColor: statusColors["In Progress"] }}></div>
            <span className="text-sm">In Progress</span>
                    </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded mr-2" style={{ backgroundColor: statusColors["Completed"] }}></div>
            <span className="text-sm">Completed</span>
                    </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded mr-2" style={{ backgroundColor: statusColors["On Hold"] }}></div>
            <span className="text-sm">On Hold</span>
                  </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded mr-2" style={{ backgroundColor: statusColors["Cancelled"] }}></div>
            <span className="text-sm">Cancelled</span>
            </div>
        </div>
      </div>

      {/* Drag and drop status indicator */}
      {draggingWorkOrder && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white p-3 rounded-lg shadow-lg z-50">
          <div className="flex items-center">
            <Move className="h-4 w-4 mr-2 animate-pulse" />
            <span>Dragging: {draggingWorkOrder.description || `Operation ${draggingWorkOrder.operation_number}`}</span>
          </div>
          <div className="text-xs mt-1 text-blue-100">
            Drop on calendar to schedule
          </div>
        </div>
      )}

      {/* Debug info */}
      {debugInfo && (
        <div className="fixed bottom-4 left-4 bg-gray-800 text-white p-3 rounded-lg shadow-lg z-50 max-w-md">
          <div className="text-xs font-mono">{debugInfo}</div>
        </div>
      )}
    </div>
  );
};

export default Scheduling;