import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import ActionButtons from "@/components/dashboard/ActionButtons";
import { Calendar, RefreshCw, List } from "lucide-react";
import { format, formatISO, parseISO, isSameDay } from "date-fns";
import { WorkCenter, Job } from "@/shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { db } from '@/lib/db';
import { useToast } from "@/components/ui/use-toast";

// Type for raw job data from database
interface DbJob {
  id: number;
  job_number: string;
  title: string;
  description: string;
  status: "New" | "In Progress" | "Delayed" | "Completed" | "On Hold";
  due_date: string;
  scheduled_date: string;
  priority: string;
  progress: number;
  work_center: string;
  customer: string;
  employee_name?: string;
  operator?: string;
  shift?: string;
  job_type?: string;
}

export default function Scheduling() {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [selectedWorkCenter, setSelectedWorkCenter] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // Fetch jobs data from database with proper type handling
  const { data: jobsData = [], isLoading: isLoadingJobs } = useQuery<Job[]>({
    queryKey: ["jobs"],
    queryFn: async () => {
      try {
        const data = await db.getJobs() as DbJob[];
        // Transform data to ensure it matches Job interface
        return data.map(job => ({
          ...job,
          sap_data: [], // Empty array as default since it's required
          priority: (job.priority as "High" | "Medium" | "Low") || "Medium", // Cast to valid priority
          vendor_operations: [],
          notes: [],
          reminders: [],
          timeline: [],
          ncr: []
        }));
      } catch (error) {
        console.error("Error fetching jobs:", error);
        return [];
      }
    },
  });

  // Fetch work centers data
  const { data: workCenters = [], isLoading: isLoadingWorkCenters } = useQuery<WorkCenter[]>({
    queryKey: ["workCenters"],
    queryFn: async () => {
      try {
        const data = await db.getWorkCenters();
        return data;
      } catch (error) {
        console.error("Error fetching work centers:", error);
        return [];
      }
    },
  });

  // Fetch last updated timestamp
  useQuery({
    queryKey: ["lastUpdated"],
    queryFn: async () => {
      try {
        const timestamp = await db.getLastUpdated();
        setLastUpdated(timestamp || "");
        return timestamp;
      } catch (error) {
        console.error("Error fetching last updated:", error);
        return "";
      }
    },
  });

  // Filter jobs based on selected filters with type safety
  const filteredJobs = jobsData.filter(job => {
    const workCenterMatch = selectedWorkCenter === "all" || job.work_center === selectedWorkCenter;
    const statusMatch = selectedStatus === "all" || job.status === selectedStatus;
    return workCenterMatch && statusMatch;
  });

  // Filter scheduled jobs - show all jobs that have a work center assigned
  const scheduledJobs = filteredJobs.filter(job =>
    job.work_center && job.work_center.trim() !== ""
  );

  const isLoading = isLoadingJobs || isLoadingWorkCenters;

  // Get current date
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  // Create calendar days for 6 weeks
  const calendarDays = Array.from({ length: 42 }).map((_, index) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + index - startOfWeek.getDay());
    return {
      date,
      jobs: scheduledJobs.filter(job => {
        if (!job.scheduled_date) return false;
        // Use isSameDay helper from date-fns for reliable date comparison
        return isSameDay(parseISO(job.scheduled_date), date);
      })
    };
  });

  // Add drag and drop functionality
  const handleDragStart = (e: React.DragEvent, job: Job) => {
    e.dataTransfer.setData("text/plain", JSON.stringify(job));
    // Add visual feedback for drag
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    // Reset visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleDrop = async (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const jobData = JSON.parse(e.dataTransfer.getData("text/plain")) as Job;

      // Format date in ISO format for database
      const updatedJob: Job = {
        ...jobData,
        scheduled_date: formatISO(date, { representation: 'date' })
      };

      // Update the job in the database
      await db.upsertJobs([updatedJob]);

      // Update the cache
      queryClient.setQueryData<Job[]>(["jobs"], (oldData) => {
        if (!oldData) return [];
        return oldData.map(job =>
          job.id === updatedJob.id ? updatedJob : job
        );
      });

      // Update last updated timestamp
      await db.updateLastUpdated();

      // Invalidate and refetch queries
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["lastUpdated"] });

      // Show success message
      toast({
        title: "Job scheduled",
        description: `Job #${jobData.job_number} has been scheduled for ${format(date, "MMM dd, yyyy")}`,
        variant: "default",
      });
    } catch (error) {
      console.error("Error updating job:", error);
      // Show error message
      toast({
        title: "Error scheduling job",
        description: "Failed to update job schedule. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Add visual feedback for valid drop target
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Reset visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.backgroundColor = '';
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>Loading schedule data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <ActionButtons />

      <div className="flex flex-col mb-6 animate-fade-in">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Production Schedule</h1>
          {lastUpdated && (
            <span className="text-sm text-gray-500">
              Last updated: {format(new Date(lastUpdated), "MMM dd, yyyy HH:mm")}
            </span>
          )}
        </div>

        <div className="flex justify-between items-center mt-4">
          <div className="flex">
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              className="mr-2"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4 mr-2" />
              List View
            </Button>
            <Button
              variant={viewMode === "calendar" ? "default" : "outline"}
              onClick={() => setViewMode("calendar")}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Calendar View
            </Button>
          </div>

          <div className="flex items-center">
            <select
              className="bg-white border border-gray-300 rounded-md px-4 py-2 text-sm"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="New">New</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Delayed">Delayed</option>
              <option value="On Hold">On Hold</option>
            </select>

            <Button variant="outline" className="ml-2 p-2" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-lg border border-gray-200 mb-6">
            <h3 className="text-lg font-semibold mb-4">Filters</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Work Center</label>
              <select
                className="w-full bg-white border border-gray-300 rounded-md px-4 py-2 text-sm"
                value={selectedWorkCenter}
                onChange={(e) => setSelectedWorkCenter(e.target.value)}
              >
                <option value="all">All Work Centers</option>
                {workCenters.map(workCenter => (
                  <option key={workCenter.name} value={workCenter.name}>{workCenter.name}</option>
                ))}
              </select>
            </div>

            <Button className="w-full bg-[#1a2133]">
              Apply Filters
            </Button>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Scheduled Jobs</h3>

            <div className="space-y-4">
              {scheduledJobs.map((job, index) => (
                <div
                  key={index}
                  className="bg-gray-50 p-4 rounded-md cursor-move"
                  draggable
                  onDragStart={(e) => handleDragStart(e, job)}
                  onDragEnd={handleDragEnd}
                >
                  <p className="text-sm font-medium text-gray-900">Job #{job.job_number}</p>
                  <p className="text-xs text-gray-500">Title: {job.title}</p>
                  <p className="text-xs text-gray-500">Status: {job.status}</p>
                  <p className="text-xs text-gray-500">Work Center: {job.work_center}</p>
                  <p className="text-xs text-gray-500">{job.description}</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs font-medium">
                      {job.scheduled_date
                        ? `Scheduled: ${format(new Date(job.scheduled_date), "MMM dd, yyyy")}`
                        : 'Not scheduled'
                      }
                    </span>
                    <span className="text-xs text-gray-500">Drag to schedule</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          {viewMode === "calendar" ? (
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Production Calendar</h3>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" className="p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </Button>

                  <Button variant="outline" size="sm" className="p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </Button>

                  <Button variant="outline" size="sm">
                    today
                  </Button>
                </div>

                <div className="flex items-center">
                  <h2 className="text-xl font-bold">{format(today, "MMMM yyyy")}</h2>
                </div>

                <div className="flex space-x-2">
                  <Button variant="default" size="sm" className="bg-[#1a2133]">
                    month
                  </Button>
                  <Button variant="outline" size="sm">
                    week
                  </Button>
                </div>
              </div>

              <div className="border border-gray-200 rounded-md overflow-hidden">
                <div className="grid grid-cols-7 bg-gray-50">
                  {calendarDays.slice(0, 7).map((day, index) => (
                    <div key={`header-${index}`} className="text-center py-2 border-r border-b border-gray-200 text-sm font-medium">
                      {format(day.date, "EEE")}
                      <div className="text-[10px] text-gray-500">{format(day.date, "MMM d")}</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {calendarDays.map((day, index) => (
                    <div
                      key={`day-${index}`}
                      className={`min-h-[120px] border-r border-b border-gray-200 p-1 ${day.date.getMonth() === today.getMonth() ? "bg-white" : "bg-gray-50"
                        }`}
                      onDrop={(e) => handleDrop(e, day.date)}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                    >
                      <div className="text-right text-sm text-gray-500 mb-1">
                        {format(day.date, "d")}
                      </div>
                      {day.jobs.map((job, jobIndex) => (
                        <div
                          key={`${job.id}-${jobIndex}`}
                          className={`mb-1 px-1 py-0.5 rounded text-xs truncate cursor-move ${job.status === 'Completed' ? 'bg-green-200 text-green-800' :
                            job.status === 'In Progress' ? 'bg-blue-200 text-blue-800' :
                              job.status === 'Delayed' ? 'bg-red-200 text-red-800' :
                                job.status === 'On Hold' ? 'bg-yellow-200 text-yellow-800' :
                                  'bg-gray-200 text-gray-800'
                            }`}
                          title={`Job #${job.job_number} - ${job.title}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, job)}
                          onDragEnd={handleDragEnd}
                        >
                          #{job.job_number}
                          {job.work_center && (
                            <span className="text-[10px] block opacity-75">{job.work_center}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Job List</h3>
              <div className="space-y-4">
                {scheduledJobs.map((job, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-md">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Job #{job.job_number}</p>
                        <p className="text-xs text-gray-500">Title: {job.title}</p>
                        <p className="text-xs text-gray-500">Status: {job.status}</p>
                        <p className="text-xs text-gray-500">Work Center: {job.work_center}</p>
                        <p className="text-xs text-gray-500">{job.description}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-between items-center">
                      <span className="text-xs font-medium">
                        {job.scheduled_date
                          ? `Scheduled: ${format(new Date(job.scheduled_date), "MMM dd, yyyy")}`
                          : 'Not scheduled'
                        }
                      </span>
                      <span className="text-xs text-gray-500">
                        Progress: {job.progress}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}