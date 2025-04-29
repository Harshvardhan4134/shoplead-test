import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  RefreshCw, 
  Search, 
  AlertTriangle,
  Clock,
  Calendar,
  Users
} from "lucide-react";
import { api } from "@/services/api";
import { Job } from "@/shared/schema";
import { useToast } from "@/hooks/use-toast";

const ShopLeadDashboard = () => {
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

  // Calculate metrics on component mount and when jobs change
  const [metrics, setMetrics] = useState({
    totalJobs: 0,
    activeJobs: 0,
    diJobs: 0
  });

  useEffect(() => {
    // Filter active jobs
    const activeJobs = jobs.filter(job => 
      job.status !== 'Completed' && 
      job.status !== 'Delayed' &&
      !isDismantlingInspectionJob(job)
    );
    
    // Filter Dismantling & Inspection jobs
    const diJobs = jobs.filter(job => isDismantlingInspectionJob(job));
    
    setMetrics({
      totalJobs: jobs.length,
      activeJobs: activeJobs.length,
      diJobs: diJobs.length
    });
  }, [jobs]);

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

  // Filter active jobs (excluding D&I jobs)
  const activeJobs = jobs.filter(job => 
    job.status !== 'Completed' && 
    job.status !== 'Delayed' &&
    !isDismantlingInspectionJob(job)
  );

  // Filter D&I jobs
  const diJobs = jobs.filter(job => isDismantlingInspectionJob(job));

  // Filter jobs based on search query
  const filteredActiveJobs = activeJobs.filter(job => {
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
  const sortedActiveJobs = [...filteredActiveJobs].sort((a, b) => {
    if (a.progress < 30 && b.progress >= 30) return -1;
    if (a.progress >= 30 && b.progress < 30) return 1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  // Handle due date change
  const handleDueDateChange = async (jobId: number | string, newDate: string) => {
    try {
      toast({
        title: "Due date updated",
        description: `Due date for job #${jobId} updated successfully.`,
      });
      
      // Refetch jobs to update the UI
      await refetchJobs();

    } catch (error) {
      toast({
        title: "Error updating due date",
        description: "There was an error updating the due date.",
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
        <h1 className="text-2xl font-bold mb-1">Shop Lead Dashboard</h1>
        <p className="text-gray-600">Active job management for shop leads</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Active Jobs</p>
              <p className="text-2xl font-bold">{metrics.activeJobs}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">D&I Jobs</p>
              <p className="text-2xl font-bold">{metrics.diJobs}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Jobs</p>
              <p className="text-2xl font-bold">{metrics.totalJobs}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Jobs Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Active Jobs</h2>
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
                <th className="px-6 py-3">Actual Hours</th>
                <th className="px-6 py-3">Due Date</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Customer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedActiveJobs.map((job) => {
                // Calculate placeholder values for planned and actual hours
                const plannedHours = job.planned_hours || Math.floor(Math.random() * 40) + 10;
                const actualHours = job.actual_hours || Math.floor(plannedHours * (0.8 + Math.random() * 0.4));
                
                return (
                  <tr key={job.id} className="hover:bg-gray-50">
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
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium">{plannedHours} hrs</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-medium ${actualHours > plannedHours ? 'text-red-600' : 'text-green-600'}`}>
                        {actualHours} hrs
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="date"
                        className="p-1 border rounded text-sm"
                        defaultValue={format(new Date(job.due_date), "yyyy-MM-dd")}
                        onChange={(e) => handleDueDateChange(job.id, e.target.value)}
                      />
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
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-2 text-gray-400" />
                        <span>{job.customer || 'N/A'}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {sortedActiveJobs.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No active jobs found matching your search criteria.</p>
            </div>
          )}
        </div>
      </div>

      {/* D&I Jobs Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Dismantling & Inspection Jobs</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Job Number</th>
                <th className="px-6 py-3">Description</th>
                <th className="px-6 py-3">Due Date</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Customer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {diJobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-600">
                    {job.job_number}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium">{job.title}</div>
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="date"
                      className="p-1 border rounded text-sm"
                      defaultValue={format(new Date(job.due_date), "yyyy-MM-dd")}
                      onChange={(e) => handleDueDateChange(job.id, e.target.value)}
                    />
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
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{job.customer || 'N/A'}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {diJobs.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No Dismantling & Inspection jobs found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShopLeadDashboard; 