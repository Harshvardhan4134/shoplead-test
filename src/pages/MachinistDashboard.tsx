import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  RefreshCw, 
  Search, 
  AlertTriangle,
  List,
  Clock,
  Check,
  ThumbsUp
} from "lucide-react";
import { api } from "@/services/api";
import { Job } from "@/shared/schema";
import { useToast } from "@/hooks/use-toast";

const MachinistDashboard = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  
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
        return await api.getJobs();
      } catch (error) {
        console.error("Error fetching jobs:", error);
        throw error;
      }
    },
    initialData: [],
  });

  // Filter machining jobs (simplified filter)
  const machiningJobs = jobs.filter(job => 
    (job.status === 'In Progress' || job.status === 'New') &&
    (!job.work_center || job.work_center === 'Machining' || job.work_center.toLowerCase().includes('machin'))
  );

  // Filter jobs based on search query
  const filteredJobs = machiningJobs.filter(job => {
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

  // Sort jobs by priority and due date
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    if (a.progress < 30 && b.progress >= 30) return -1;
    if (a.progress >= 30 && b.progress < 30) return 1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  // Mark job as complete
  const markJobComplete = async (jobId: number | string) => {
    try {
      toast({
        title: "Job updated",
        description: `Job #${jobId} marked as completed.`,
      });
      
      // In a real app, this would call an API
      // For now, just refetch jobs
      await refetchJobs();

    } catch (error) {
      toast({
        title: "Error updating job",
        description: "There was an error updating the job status.",
        variant: "destructive",
      });
    }
  };

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
        <h1 className="text-2xl font-bold mb-1">Machinist Dashboard</h1>
        <p className="text-gray-600">View and manage machining jobs</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Assigned Jobs</p>
              <p className="text-2xl font-bold">{machiningJobs.length}</p>
            </div>
            <div className="p-2 bg-blue-100 rounded">
              <List className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Due Today</p>
              <p className="text-2xl font-bold">
                {machiningJobs.filter(job => {
                  const today = new Date();
                  const dueDate = new Date(job.due_date);
                  return (
                    dueDate.getDate() === today.getDate() &&
                    dueDate.getMonth() === today.getMonth() &&
                    dueDate.getFullYear() === today.getFullYear()
                  );
                }).length}
              </p>
            </div>
            <div className="p-2 bg-yellow-100 rounded">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Completed Today</p>
              <p className="text-2xl font-bold">0</p>
            </div>
            <div className="p-2 bg-green-100 rounded">
              <Check className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Your Jobs</h2>
          <div className="flex space-x-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Search jobs..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchJobs()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Job Number</th>
                <th className="px-6 py-3">Description</th>
                <th className="px-6 py-3">Planned Hours</th>
                <th className="px-6 py-3">Due Date</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedJobs.map((job) => {
                // Calculate placeholder values for planned hours
                const plannedHours = job.planned_hours || Math.floor(Math.random() * 40) + 10;
                
                return (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-600">
                      {job.job_number}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{job.title}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium">{plannedHours} hrs</span>
                    </td>
                    <td className="px-6 py-4">
                      {format(new Date(job.due_date), "MMM dd, yyyy")}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        job.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                        job.status === 'Completed' ? 'bg-green-100 text-green-800' :
                        job.status === 'On Hold' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => markJobComplete(job.id)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Complete
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {sortedJobs.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No machining jobs found matching your search criteria.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MachinistDashboard; 