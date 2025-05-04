import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";
import { formatJob, recalculateJobMetrics } from "@/utils/jobUtils";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

// Add a console message to confirm when this hook is loaded
console.log("useJobManager hook loaded with formatJob");

export const useJobManager = () => {
  const { toast } = useToast(); 
  const queryClient = useQueryClient();
  const { addNotification } = useAuth();

  // Query for fetching jobs
  const {
    data: jobs = [],
    isLoading: isLoadingJobs,
    error: jobsError,
    refetch: refetchJobs
  } = useQuery({
    queryKey: ["/api/jobs"],
    queryFn: async () => {
      try {
        const raw = await api.getJobs();
        return (raw as any[]).map(formatJob);
      } catch (error) {
        console.error("Error fetching jobs:", error);
        throw error;
      }
    }
  });

  // Mutation for updating due date
  const updateDueDateMutation = useMutation({
    mutationFn: async ({ jobId, newDate }: { jobId: number | string, newDate: string }) => {
      console.log(`Updating due date for job ${jobId} to ${newDate}`);
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call

      // Update job in cache
      const currentJobs = queryClient.getQueryData<any[]>(["/api/jobs"]) || [];
      const updatedJobs = currentJobs.map(job =>
        job.job_number === jobId ? { ...job, due_date: newDate } : job
      );

      queryClient.setQueryData(["/api/jobs"], updatedJobs);
      return { success: true };
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Due date updated",
        description: "Job due date has been updated successfully",
      });

      addNotification({
        title: `Due Date Changed`,
        message: `Due date for job ${variables.jobId} has been updated to ${format(new Date(variables.newDate), "MMM dd, yyyy")}`,
        type: 'due_date_change',
        relatedJobId: String(variables.jobId)
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
      console.log(`Updating status for job ${jobId} to ${newStatus}`);
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call

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

  // Mutation for updating reference name
  const updateReferenceNameMutation = useMutation({
    mutationFn: async ({ jobId, referenceName }: { jobId: string | number, referenceName: string }) => {
      console.log(`Updating reference name for job ${jobId} to ${referenceName}`);
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
      
      // Update job in cache
      const currentJobs = queryClient.getQueryData<any[]>(["/api/jobs"]) || [];
      const updatedJobs = currentJobs.map(job =>
        job.job_number === jobId ? { ...job, reference_name: referenceName, title: referenceName } : job
      );
      
      queryClient.setQueryData(["/api/jobs"], updatedJobs);
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Reference name updated",
        description: "Job reference name has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating reference name",
        description: "There was a problem updating the reference name",
        variant: "destructive",
      });
    }
  });

  // General purpose mutation for updating any job field
  const updateJobFieldMutation = useMutation({
    mutationFn: async ({ jobId, field, value }: { jobId: string | number, field: string, value: any }) => {
      console.log(`Updating job ${jobId} field ${field} to:`, value);
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
      
      // Update job in cache
      const currentJobs = queryClient.getQueryData<any[]>(["/api/jobs"]) || [];
      const updatedJobs = currentJobs.map(job => {
        if (job.job_number === jobId) {
          const updatedJob = { ...job, [field]: value };
          // Recalculate metrics if needed based on field change
          if (['planned_hours', 'actual_hours', 'progress', 'order_value'].includes(field)) {
            return recalculateJobMetrics(updatedJob);
          }
          return updatedJob;
        }
        return job;
      });
      
      queryClient.setQueryData(["/api/jobs"], updatedJobs);
      return { success: true };
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Job updated",
        description: `Field ${variables.field} has been updated successfully`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating job",
        description: "There was a problem updating the job data",
        variant: "destructive",
      });
    }
  });

  return {
    jobs,
    isLoadingJobs,
    jobsError,
    refetchJobs,
    updateDueDateMutation,
    updateJobStatusMutation,
    updateReferenceNameMutation,
    updateJobFieldMutation
  };
}; 