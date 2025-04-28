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
  TrashIcon,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  FileText,
  Clock,
  Users,
  Calendar,
  BarChart4
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
import { toast as uiToast } from '@/components/ui/use-toast';
import { JobModal } from "@/components/jobs/JobModal";
import { motion } from "framer-motion";
import { PurchaseOrderModal } from "@/components/purchase/PurchaseOrderModal";
import { Badge } from "@/components/ui/badge";

// Add delay utility function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface Update {
  type: 'note' | 'reminder' | 'priority';
  job_id?: number | string;
  job_number?: string;
  content: string;
  title?: string;
  date: string;
}

// Add sound notification for reminders
const REMINDER_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/933/933-preview.mp3"; // Replace with your sound URL
const FALLBACK_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3"; // Fallback sound URL

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
    job_id?: number | string;
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

  // Add job view mode and current page state
  const [jobViewMode, setJobViewMode] = useState<"card" | "table">("card");
  const [currentPage, setCurrentPage] = useState(1);
  const jobsPerPage = 8; // Show 8 jobs per page in card view

  // Add state for PurchaseOrderModal
  const [selectedPONumber, setSelectedPONumber] = useState<string | null>(null);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [relatedPOs, setRelatedPOs] = useState<PurchaseOrder[]>([]);
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);

  // Add state for workspace view tabs
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<"jobs" | "purchase-orders">("jobs");

  // Add state for job card reminder dialog
  const [isJobCardReminderOpen, setIsJobCardReminderOpen] = useState(false);
  const [jobForReminder, setJobForReminder] = useState<Job | null>(null);

  // Add console log to track jobForReminder changes
  useEffect(() => {
    console.log("jobForReminder changed:", jobForReminder?.job_number);
  }, [jobForReminder]);

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

  // Add a helper function to play the reminder sound safely
  const playReminderSound = async () => {
    console.log("playReminderSound called");
    
    if (!reminderSoundRef.current) {
      console.error("Cannot play reminder sound - no audio element available");
      
      // Create an audio element on the fly as fallback
      try {
        console.log("Attempting to create audio element on the fly");
        const tempAudio = new Audio(REMINDER_SOUND_URL);
        
        // Try to play
        await tempAudio.play().catch(err => {
          console.error("Fallback play failed:", err);
          
          // Try alternate URL
          console.log("Trying alternate sound URL");
          const altAudio = new Audio(FALLBACK_SOUND_URL);
          return altAudio.play();
        });
        
        console.log("Fallback audio played successfully");
      } catch (e) {
        console.error("Complete failure playing any sound:", e);
      }
      
      return;
    }
    
    try {
      console.log("Attempting to play reminder sound");
      
      // Reset to beginning
      reminderSoundRef.current.currentTime = 0;
      
      // Make sure volume is up
      reminderSoundRef.current.volume = 1;
      
      // First create user gesture simulation for browsers that require it
      console.log("Audio readyState:", reminderSoundRef.current.readyState);
      console.log("Audio paused state:", reminderSoundRef.current.paused);
      
      // Play the sound
      const playPromise = reminderSoundRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => console.log("Reminder sound played successfully"))
          .catch(error => {
            console.error("Failed to play reminder sound:", error);
            
            // Create notification to manually enable sound
            const notification = document.createElement('div');
            notification.style.position = 'fixed';
            notification.style.bottom = '50px';
            notification.style.right = '50px';
            notification.style.backgroundColor = 'rgba(255, 0, 0, 0.9)';
            notification.style.color = 'white';
            notification.style.padding = '15px';
            notification.style.borderRadius = '5px';
            notification.style.zIndex = '10000';
            notification.innerHTML = `
              <p><strong>Sound Notification:</strong> Click here to enable reminder sounds</p>
            `;
            
            // Add click handler to try playing sound when clicked
            notification.addEventListener('click', async () => {
              try {
                if (reminderSoundRef.current) {
                  await reminderSoundRef.current.play();
                  console.log("Sound played after user interaction");
                  notification.innerHTML = "<p>✓ Sound enabled successfully!</p>";
                  
                  // Remove after 2 seconds
                  setTimeout(() => notification.remove(), 2000);
                }
              } catch (err) {
                console.error("Still failed after click:", err);
                notification.innerHTML = "<p>❌ Failed to enable sound</p>";
              }
            });
            
            document.body.appendChild(notification);
            
            // Remove after 10 seconds if not clicked
            setTimeout(() => {
              if (document.body.contains(notification)) {
                notification.remove();
              }
            }, 10000);
            
            // If play failed, try again after user interaction
            toast({
              title: "Sound Notice",
              description: "Click anywhere to enable reminder sounds",
              duration: 3000,
            });
          });
      }
    } catch (error) {
      console.error("Failed to play reminder sound:", error);
    }
  };

  // Update the addReminderMutation to properly handle reminders array and updates
  const addReminderMutation = useMutation({
    mutationFn: async ({ jobId, reminder }: { jobId: string | number, reminder: Reminder }) => {
      console.log("Add reminder mutation called with:", { jobId, reminder });
      
      // Try to find the job by id or job_number
      let job = jobs?.find(j => j.id === jobId);
      
      // If not found by id, try to find by job_number
      if (!job) {
        job = jobs?.find(j => String(j.job_number) === String(jobId));
        console.log("Looking for job by job_number:", jobId, "Found:", job?.job_number);
      }
      
      if (!job) {
        console.error("Job not found:", jobId);
        throw new Error('Job not found');
      }

      console.log("Found job:", job.job_number);
      
      // Create a deep copy of the job
      const updatedJob = {
        ...job,
        reminders: Array.isArray(job.reminders) ? [...job.reminders] : []
      };
      
      // Add the new reminder
      updatedJob.reminders.push(reminder);
      
      console.log("Updated job with new reminder:", updatedJob);

      // Update the jobs in cache immediately
      const currentJobs = queryClient.getQueryData<Job[]>(["/api/jobs"]) || [];
      queryClient.setQueryData(["/api/jobs"], currentJobs.map(j => 
        (j.id === job?.id || j.job_number === job?.job_number) ? updatedJob : j
      ));

      // Log the updated jobs
      const updatedJobs = queryClient.getQueryData<Job[]>(["/api/jobs"]) || [];
      console.log("All jobs after update:", updatedJobs.map(j => ({
        job_number: j.job_number,
        reminders: j.reminders ? j.reminders.length : 0
      })));

      // Add to updates immediately 
      setUpdates(prev => [{
        type: 'reminder',
        job_id: jobId,
        job_number: job.job_number,
        content: reminder.description,
        date: reminder.date
      }, ...prev]);

      // Call the API (this may be implemented in the future)
      try {
        // Convert jobId to number if needed
        const numericJobId = typeof jobId === 'string' ? Number(jobId) : jobId;
        return await api.addReminder(numericJobId, reminder);
      } catch (error) {
        console.error("API error:", error);
        // Even if the API fails, we'll keep the local changes
        return { success: true, message: "Added reminder locally" };
      }
    },
    onSuccess: (result) => {
      console.log("Reminder added successfully:", result);
      
      // Play the reminder sound when a reminder is added
      playReminderSound();
      
      // Update the jobs query cache
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      
      // Show a success toast
      toast({
        title: 'Success',
        description: 'Reminder added successfully'
      });
      
      // Immediately check if the reminder should trigger a notification
      // (in case it was set for the immediate future)
      console.log("Running immediate reminder check after adding new reminder");
      setTimeout(checkReminders, 500); // Short delay to ensure state updates first
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

  // Add ref for the audio element
  const reminderSoundRef = useRef<HTMLAudioElement | null>(null);

  // Create audio element for reminder sounds
  useEffect(() => {
    console.log("Initializing reminder sound with URL:", REMINDER_SOUND_URL);
    
    const initializeSound = (url) => {
      try {
        const audio = new Audio(url);
        
        // Preload the audio file
        audio.load();
        
        return audio;
      } catch (error) {
        console.error(`Failed to initialize sound with URL ${url}:`, error);
        return null;
      }
    };
    
    // Try the main sound first
    reminderSoundRef.current = initializeSound(REMINDER_SOUND_URL);
    
    // Add error listener to try fallback if main sound fails
    if (reminderSoundRef.current) {
      reminderSoundRef.current.addEventListener('error', (e) => {
        console.error("Error loading main reminder sound, trying fallback:", e);
        reminderSoundRef.current = initializeSound(FALLBACK_SOUND_URL);
      });
      
      reminderSoundRef.current.addEventListener('canplaythrough', () => {
        console.log("Reminder sound loaded successfully");
        
        // Test play on mount (will be muted)
        const testPlay = async () => {
          try {
            // Set volume to 0 for silent test
            reminderSoundRef.current.volume = 0;
            await reminderSoundRef.current.play();
            console.log("Test play successful");
            // Reset volume after successful test
            reminderSoundRef.current.pause();
            reminderSoundRef.current.currentTime = 0;
            reminderSoundRef.current.volume = 1;
          } catch (err) {
            console.warn("Test play failed, might need user interaction first:", err);
          }
        };
        
        testPlay();
      });
    } else {
      // If main sound initialization failed, try fallback directly
      console.warn("Main sound initialization failed, trying fallback");
      reminderSoundRef.current = initializeSound(FALLBACK_SOUND_URL);
    }
    
    return () => {
      if (reminderSoundRef.current) {
        reminderSoundRef.current.pause();
        reminderSoundRef.current = null;
      }
    };
  }, []);

  // Replace the checkReminders function to play sound
  const checkReminders = () => {
    const now = new Date();
    console.log("Checking reminders at:", now.toLocaleTimeString());
    
    // Debug all reminders in the system
    const allReminders = jobs.flatMap(job => 
      (Array.isArray(job.reminders) ? job.reminders : []).map(reminder => ({
        job_number: job.job_number,
        reminder_date: reminder.date,
        description: reminder.description,
        // Calculate time difference in minutes from now
        minutes_from_now: Math.round(((new Date(reminder.date)).getTime() - now.getTime()) / (1000 * 60))
      }))
    );
    console.log("All reminders in system:", allReminders);
    console.log("Number of reminders found:", allReminders.length);
    
    // Find reminders that are due now or in the next 1 minute
    const dueReminders = jobs.flatMap(job =>
      (Array.isArray(job.reminders) ? job.reminders : [])
        .filter(reminder => {
          // Parse the reminder date - handle both ISO strings and date objects
          const reminderDate = new Date(reminder.date);
          const nowTime = now.getTime();
          const reminderTime = reminderDate.getTime();
          
          // Calculate how many minutes until the reminder is due
          const diffMinutes = (reminderTime - nowTime) / (1000 * 60);
          
          // Debug this specific reminder
          console.log(
            `Checking reminder for job ${job.job_number}: ` +
            `"${reminder.description}" - ` +
            `due at ${reminderDate.toLocaleTimeString()} (${reminderDate.toISOString()}) - ` +
            `current time: ${now.toLocaleTimeString()} (${now.toISOString()}) - ` +
            `diff minutes: ${diffMinutes.toFixed(2)}`
          );
          
          // *** CHANGE: Widen the window for due reminders ***
          // A reminder is considered "due" if:
          // 1. It's happening now or within the next 5 minutes
          // 2. It happened within the last 10 minutes (in case we missed it)
          // This creates a wider 15-minute window to catch reminders
          const isDue = diffMinutes <= 5 && diffMinutes >= -10;
          
          if (isDue) {
            console.log("REMINDER IS DUE NOW:", reminder);
            console.log("REMINDER JOB DETAILS:", job.job_number, job.title);
          }
          
          return isDue;
        })
        .map(reminder => ({
          job,
          reminder
        }))
    );
    
    console.log("Due reminders found:", dueReminders.length);
    
    // Find reminders that are coming up soon (in the next 30 minutes, excluding those already due)
    const upcomingReminders = jobs.flatMap(job =>
      (Array.isArray(job.reminders) ? job.reminders : [])
        .filter(reminder => {
          const reminderDate = new Date(reminder.date);
          const diffMinutes = (reminderDate.getTime() - now.getTime()) / (1000 * 60);
          return diffMinutes > 5 && diffMinutes <= 30; // Only show upcoming that aren't already "due"
        })
        .map(reminder => ({
          job,
          reminder
        }))
    );
    
    console.log("Upcoming reminders found:", upcomingReminders.length);
    
    // Update the state with upcoming reminders (for display in the UI)
    setUpcomingReminders(upcomingReminders);
    
    // Handle due reminders (play sound and show prominent notifications)
    if (dueReminders.length > 0) {
      console.log("Due reminders found:", dueReminders);
      
      // Play sound for due reminders
      console.log("About to play reminder sound for due reminders");
      playReminderSound();
      
      // Show prominent notifications for each due reminder
      dueReminders.forEach(({ job, reminder }) => {
        // Format the time
        const formattedTime = format(new Date(reminder.date), "h:mm a");
        
        console.log("Showing toast notification for reminder:", 
                    job.job_number, reminder.description, formattedTime);
        
        // Try both toast methods to ensure notification appears
        // Show a prominent toast notification that stays visible longer
        toast({
          title: `⏰ REMINDER: Job #${job.job_number}`,
          description: `${reminder.description} - Due at ${formattedTime}`,
          variant: "destructive", // Use the destructive variant for more attention
          duration: 15000, // Keep visible for 15 seconds
        });
        
        // Also try with direct import
        uiToast({
          title: `⏰ REMINDER: Job #${job.job_number}`,
          description: `${reminder.description} - Due at ${formattedTime}`,
          variant: "destructive", // Use the destructive variant for more attention
          duration: 15000, // Keep visible for 15 seconds
        });
        
        // If we have document.body available, show a more attention-grabbing notification
        if (typeof document !== 'undefined') {
          try {
            console.log("Creating banner for reminder");
            // Add a prominent banner at the top of the page
            const bannerDiv = document.createElement('div');
            bannerDiv.className = 'reminder-banner';
            bannerDiv.style.position = 'fixed';
            bannerDiv.style.top = '0';
            bannerDiv.style.left = '0';
            bannerDiv.style.width = '100%';
            bannerDiv.style.backgroundColor = '#ff0000';
            bannerDiv.style.color = 'white';
            bannerDiv.style.padding = '15px';
            bannerDiv.style.textAlign = 'center';
            bannerDiv.style.zIndex = '9999';
            bannerDiv.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';
            bannerDiv.innerHTML = `
              <strong>REMINDER ALERT:</strong> Job #${job.job_number} - ${reminder.description} - Due at ${formattedTime}
              <button style="margin-left: 20px; padding: 2px 8px; border-radius: 4px; border: none; background: white; color: red; cursor: pointer;">
                Dismiss
              </button>
            `;
            
            // Add dismiss functionality
            document.body.appendChild(bannerDiv);
            console.log("Added reminder banner to document body");
            
            // Find the dismiss button and add a click handler
            const dismissButton = bannerDiv.querySelector('button');
            if (dismissButton) {
              dismissButton.addEventListener('click', () => {
                bannerDiv.remove();
              });
            }
            
            // Auto-remove after 30 seconds
            setTimeout(() => {
              if (document.body.contains(bannerDiv)) {
                bannerDiv.remove();
              }
            }, 30000);
          } catch (error) {
            console.error("Error showing reminder banner:", error);
          }
        }
      });
    }
    
    // Show toast notifications for upcoming reminders
    upcomingReminders.forEach(({ job, reminder }) => {
      const reminderDate = new Date(reminder.date);
      const diffMinutes = Math.ceil((reminderDate.getTime() - now.getTime()) / (1000 * 60));
      
      // Try both toast methods
      toast({
        title: `Upcoming Reminder for Job #${job.job_number}`,
        description: `${reminder.description} - Due in ${diffMinutes} minutes (${format(reminderDate, "h:mm a")})`,
        variant: "default",
        duration: 8000,
      });
      
      uiToast({
        title: `Upcoming Reminder for Job #${job.job_number}`,
        description: `${reminder.description} - Due in ${diffMinutes} minutes (${format(reminderDate, "h:mm a")})`,
        variant: "default",
        duration: 8000,
      });
    });
  };

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

  // Calculate the job indices to display for the current page
  const indexOfLastJob = currentPage * jobsPerPage;
  const indexOfFirstJob = indexOfLastJob - jobsPerPage;
  const currentJobs = sortedJobs.slice(indexOfFirstJob, indexOfLastJob);
  const totalPages = Math.ceil(sortedJobs.length / jobsPerPage);

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

  // Replace handleAddReminder to use addReminderMutation
  const handleAddReminder = async (jobId: number | string, reminderDate: string, reminderDescription: string) => {
    try {
      console.log(`Adding reminder for job ${jobId} at ${reminderDate}: ${reminderDescription}`);
      
      const job = jobs.find(j => j.id === jobId || String(j.job_number) === String(jobId));
      if (!job) {
        console.error("Job not found for reminder:", jobId);
        toast({
          title: "Error",
          description: "Job not found. Please try again.",
          variant: "destructive"
        });
        return;
      }

      const newReminder = {
        date: reminderDate,
        description: reminderDescription
      };

      // Use the mutation instead of direct API call
      await addReminderMutation.mutateAsync({ 
        jobId: jobId, 
        reminder: newReminder 
      });

      // Clear the form
      setReminderContent("");
      setReminderDate("");
      
      // Trigger immediate check
      console.log("Triggering immediate reminder check from handleAddReminder");
      setTimeout(checkReminders, 500);

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
      {/* Reminder updates */}
      {updates.filter(update => update.type === 'reminder').map((update, index) => (
        <div key={`reminder-${index}`} className="flex mb-4">
          <div className="flex-shrink-0 mr-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 text-yellow-600">
              <Bell className="h-4 w-4" />
            </div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 w-full">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Reminder for Job #{update.job_number}</h3>
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

  // Update the status display in the table and cards
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

  const getPriorityColor = (priority: string | undefined, progress: number) => {
    if (priority === "High" || progress < 30) return "text-red-500";
    if (priority === "Medium" || progress < 70) return "text-yellow-500";
    return "text-green-500";
  };

  // Purchase order display
  const renderPurchaseOrders = () => {
    return purchaseOrders.slice(0, 4).map(po => {
      // Validate the date and price
      const documentDate = po.document_date ? new Date(po.document_date) : null;
      const isValidDate = documentDate && !isNaN(documentDate.getTime());
      const netPrice = typeof po.net_price === 'number' ? po.net_price : 0;

      // Get the PO number from either purchasing_document or po_number field
      const poNumber = po.purchasing_document || '';

      return (
        <tr 
          key={po.id} 
          className="hover:bg-gray-50 cursor-pointer"
          onClick={() => {
            const po = purchaseOrders.find(p => p.purchasing_document === poNumber);
            setSelectedPONumber(poNumber);
            setSelectedPO(po || null);
            
            // Find all POs with the same PO number
            const allRelatedPOs = purchaseOrders.filter(p => p.purchasing_document === poNumber);
            setRelatedPOs(allRelatedPOs);
            
            setIsPOModalOpen(true);
          }}
        >
          <td className="py-3 px-4">
            <div className="font-medium text-blue-600">{poNumber}</div>
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
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              po.status === "Completed" ? "bg-green-100 text-green-800" :
              po.status === "Open" ? "bg-yellow-100 text-yellow-800" :
              po.status === "Cancelled" ? "bg-red-100 text-red-800" :
              "bg-gray-100 text-gray-800"
            }`}>
              {po.status}
            </span>
          </td>
          <td className="py-3 px-4 text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => {
                  setSelectedPONumber(poNumber);
                  setSelectedPO(po);
                  // Find all POs with the same PO number
                  const allRelatedPOs = purchaseOrders.filter(p => p.purchasing_document === poNumber);
                  setRelatedPOs(allRelatedPOs);
                  setIsPOModalOpen(true);
                }}>
                  <FileText className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                {po.req_tracking_number && (
                  <DropdownMenuItem>
                    <BarChart4 className="h-4 w-4 mr-2" />
                    View Job #{po.req_tracking_number}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </td>
        </tr>
      );
    });
  };

  // Redesign the Logistics & Purchase Orders section to be more prominent
  const renderPurchaseOrdersSection = () => (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <h2 className="text-lg font-medium">Logistics & Purchase Orders</h2>
          <Badge className="ml-2">{purchaseOrders.length}</Badge>
        </div>
        <Link to="/purchase" className="text-blue-600 text-sm hover:underline">
          View All
        </Link>
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
  );

  // Active Jobs Card View
  const renderJobCards = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {currentJobs.map((job) => (
          <motion.div
            key={job.id}
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
            className="bg-white border rounded-lg overflow-hidden shadow-sm hover:shadow-md cursor-pointer"
            onClick={() => {
              setSelectedJobNumber(job.job_number);
              setIsJobModalOpen(true);
            }}
          >
            <div className={`h-2 ${job.priority === "High" || job.progress < 30 ? "bg-red-500" : 
                             job.priority === "Medium" || job.progress < 70 ? "bg-yellow-500" : 
                             "bg-green-500"}`}></div>
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-gray-900">{job.job_number}</h3>
                <span className={`inline-block text-xs px-2 py-1 rounded-full ${getStatusColor(job.status)}`}>
                  {job.status}
                </span>
              </div>
              
              <h4 className="text-sm font-medium mb-2 line-clamp-1">{job.title}</h4>
              
              <div className="flex flex-col space-y-2 text-xs text-gray-600 mb-3">
                <div className="flex items-center">
                  <Calendar className="h-3 w-3 mr-2" />
                  <span>Due: {format(new Date(job.due_date), "MMM dd, yyyy")}</span>
                </div>
                {job.customer && (
                  <div className="flex items-center">
                    <Users className="h-3 w-3 mr-2" />
                    <span className="line-clamp-1">{job.customer}</span>
                  </div>
                )}
                {job.work_center && (
                  <div className="flex items-center">
                    <Clock className="h-3 w-3 mr-2" />
                    <span>{job.work_center}</span>
                  </div>
                )}
              </div>

              <div className="mt-3">
                <div className="bg-gray-200 h-1.5 w-full rounded-full">
                  <div
                    className={`h-1.5 rounded-full ${job.priority === "High" ? "bg-red-500" :
                      job.priority === "Medium" ? "bg-yellow-500" : "bg-green-500"}`}
                    style={{ width: `${job.progress}%` }}
                  ></div>
                </div>
                <div className="flex justify-between mt-1 text-xs text-gray-500">
                  <span>Progress: {job.progress}%</span>
                  <span className={getPriorityColor(job.priority, job.progress)}>
                    {job.priority || (job.progress < 30 ? "High" : job.progress < 70 ? "Medium" : "Low")}
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-2 border-t flex justify-between">
              <Button variant="ghost" size="sm" onClick={(e) => {
                e.stopPropagation();
                console.log("Bell button clicked for job:", job);
                // Make a clone of the job object to prevent any reference issues
                const jobCopy = {...job};
                console.log("Setting jobForReminder to:", jobCopy);
                setJobForReminder(jobCopy);
                setReminderContent("");
                setReminderDate(new Date().toISOString().slice(0, 16)); // Set default to current date/time
                setIsJobCardReminderOpen(true);
              }}>
                <Bell className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    updatePriorityMutation.mutate({ job_id: job.id, priority: "High" });
                  }}>
                    <Flag className="h-4 w-4 mr-2 text-red-500" />
                    Set High Priority
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    updatePriorityMutation.mutate({ job_id: job.id, priority: "Medium" });
                  }}>
                    <Flag className="h-4 w-4 mr-2 text-yellow-500" />
                    Set Medium Priority
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    updatePriorityMutation.mutate({ job_id: job.id, priority: "Low" });
                  }}>
                    <Flag className="h-4 w-4 mr-2 text-green-500" />
                    Set Low Priority
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </motion.div>
        ))}
      </div>
    );
  };

  // Table view for jobs
  const renderJobTable = () => {
    return (
      <div className="border rounded-lg">
        <table className="w-full border-collapse">
          <thead className="bg-white">
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
            {currentJobs.length > 0 ? (
              currentJobs.map((job) => (
                <motion.tr 
                  key={job.id} 
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  whileHover={{ backgroundColor: "#f9fafb" }}
                  onClick={() => {
                    setSelectedJobNumber(job.job_number);
                    setIsJobModalOpen(true);
                  }}
                >
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log("Bell button clicked for job:", job);
                          // Make a clone of the job object to prevent any reference issues
                          const jobCopy = {...job};
                          console.log("Setting jobForReminder to:", jobCopy);
                          setJobForReminder(jobCopy);
                          setReminderContent("");
                          setReminderDate(new Date().toISOString().slice(0, 16)); // Set default to current date/time
                          setIsJobCardReminderOpen(true);
                        }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <Bell className="h-4 w-4" />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button 
                            className="text-gray-400 hover:text-gray-600"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => {
                            updatePriorityMutation.mutate({ job_id: job.id, priority: "High" });
                          }}>
                            <Flag className="h-4 w-4 mr-2 text-red-500" />
                            Set High Priority
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            updatePriorityMutation.mutate({ job_id: job.id, priority: "Medium" });
                          }}>
                            <Flag className="h-4 w-4 mr-2 text-yellow-500" />
                            Set Medium Priority
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            updatePriorityMutation.mutate({ job_id: job.id, priority: "Low" });
                          }}>
                            <Flag className="h-4 w-4 mr-2 text-green-500" />
                            Set Low Priority
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </motion.tr>
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
    );
  };

  // Pagination controls
  const renderPagination = () => {
    return (
      <div className="flex justify-between items-center mt-4">
        <div className="text-sm text-gray-500">
          Showing {indexOfFirstJob + 1}-{Math.min(indexOfLastJob, sortedJobs.length)} of {sortedJobs.length} jobs
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            
            return (
              <Button
                key={i}
                variant={currentPage === pageNum ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentPage(pageNum)}
                className="w-9"
              >
                {pageNum}
              </Button>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  // Moved from inside the return statement, create a workspace tabs component
  const renderWorkspaceTabs = () => {
    return (
      <div className="mb-6">
        <div className="border-b flex">
          <button
            className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${
              activeWorkspaceTab === "jobs"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setActiveWorkspaceTab("jobs")}
          >
            Active Jobs
          </button>
          <button
            className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${
              activeWorkspaceTab === "purchase-orders"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setActiveWorkspaceTab("purchase-orders")}
          >
            Purchase Orders
          </button>
        </div>
      </div>
    );
  };

  // Set up the interval to check for reminders
  useEffect(() => {
    console.log("Setting up reminder check interval");
    
    // Check immediately on component mount
    checkReminders();
    
    // Then check every 10 seconds (increased frequency for better notification timing)
    const interval = setInterval(checkReminders, 10000);
    
    // Clean up the interval when component unmounts
    return () => {
      console.log("Cleaning up reminder check interval");
      clearInterval(interval);
    };
  }, [jobs]);  // Re-initialize if jobs change
  
  // Add immediate check when updates change (might include new reminders)
  useEffect(() => {
    console.log("Updates changed, checking reminders immediately");
    checkReminders();
  }, [updates.length]);

  // Add a more robust test for playing sound
  useEffect(() => {
    // Add a test banner after 5 seconds to verify DOM manipulation works
    const testBanner = setTimeout(() => {
      console.log("Attempting to create a test banner to verify DOM manipulation");
      try {
        if (typeof document !== 'undefined' && document.body) {
          const testDiv = document.createElement('div');
          testDiv.style.position = 'fixed';
          testDiv.style.bottom = '20px';
          testDiv.style.right = '20px';
          testDiv.style.backgroundColor = 'blue';
          testDiv.style.color = 'white';
          testDiv.style.padding = '10px';
          testDiv.style.borderRadius = '5px';
          testDiv.style.zIndex = '9999';
          testDiv.innerHTML = 'Test Banner - Click to dismiss';
          testDiv.style.cursor = 'pointer';
          
          testDiv.addEventListener('click', () => {
            testDiv.remove();
          });
          
          document.body.appendChild(testDiv);
          console.log("Test banner created successfully");
          
          // Auto-remove after 10 seconds
          setTimeout(() => {
            if (document.body.contains(testDiv)) {
              testDiv.remove();
            }
          }, 10000);
        }
      } catch (error) {
        console.error("Error creating test banner:", error);
      }
    }, 5000);
    
    return () => {
      clearTimeout(testBanner);
    };
  }, []);

  // Add a test function to manually trigger a reminder
  const testReminderNotification = () => {
    console.log("Creating a test reminder");
    
    // Create a reminder that's due right now
    const testReminder = {
      date: new Date().toISOString(),
      description: "TEST REMINDER - This is a test notification"
    };
    
    // Find the first job to attach it to
    if (jobs.length > 0) {
      const testJob = jobs[0];
      console.log("Using job for test reminder:", testJob.job_number);
      
      // Add the reminder directly to the job
      const updatedJob = {
        ...testJob,
        reminders: Array.isArray(testJob.reminders) ? [...testJob.reminders, testReminder] : [testReminder]
      };
      
      // Update the jobs in cache
      const currentJobs = queryClient.getQueryData<Job[]>(["/api/jobs"]) || [];
      queryClient.setQueryData(["/api/jobs"], currentJobs.map(j => 
        j.id === testJob.id ? updatedJob : j
      ));
      
      // Force a check for reminders immediately
      console.log("Forcing reminder check for test reminder");
      setTimeout(checkReminders, 500);
      
      // Play sound directly as well
      console.log("Playing test sound");
      playReminderSound();
      
      // Show a direct test notification
      const testDiv = document.createElement('div');
      testDiv.style.position = 'fixed';
      testDiv.style.top = '20px';
      testDiv.style.left = '50%';
      testDiv.style.transform = 'translateX(-50%)';
      testDiv.style.backgroundColor = 'green';
      testDiv.style.color = 'white';
      testDiv.style.padding = '15px';
      testDiv.style.borderRadius = '5px';
      testDiv.style.zIndex = '10000';
      testDiv.innerHTML = 'This is a direct test notification - Click to dismiss';
      testDiv.style.cursor = 'pointer';
      
      testDiv.addEventListener('click', () => {
        testDiv.remove();
      });
      
      document.body.appendChild(testDiv);
      
      // Add a direct toast message too
      toast({
        title: "Test Reminder",
        description: "This is a direct test toast notification",
        variant: "destructive",
        duration: 5000,
      });
    } else {
      console.error("No jobs available for test reminder");
    }
  };

  // Add a direct toast test function
  const testToastNotification = () => {
    console.log("Testing direct toast notification");
    
    // Try both toast methods to see which one works
    toast({
      title: "Test Toast via useToast hook",
      description: "This is a test toast notification using the hook",
      variant: "default",
      duration: 5000,
    });
    
    // Also try the direct toast import
        uiToast({
      title: "Test Toast via direct import",
      description: "This is a test toast notification using direct import",
      variant: "destructive", 
      duration: 5000,
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
            onClick={testReminderNotification}
            className="flex items-center h-9 bg-red-100"
          >
            <Bell className="h-4 w-4 mr-2" />
            Test Notification
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={testToastNotification}
            className="flex items-center h-9 bg-yellow-100"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Test Toast
          </Button>
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
                    onChange={(e) => {
                      console.log("Selected job ID:", e.target.value);
                      // Find job by job_number since that's what we have
                      const selectedJobObj = jobs.find(j => String(j.job_number) === e.target.value);
                      console.log("Found job:", selectedJobObj);
                      setSelectedJob(selectedJobObj || null);
                    }}
                    value={selectedJob?.job_number || ""}
                  >
                    <option value="">Select a job</option>
                    {jobs.map(job => (
                      <option key={`job-${job.job_number}`} value={job.job_number}>
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
                    console.log("Main Add Reminder button clicked. Selected job:", selectedJob);
                    if (selectedJob) {
                      console.log("Adding reminder for job from main dialog:", selectedJob.job_number, reminderDate, reminderContent);
                      
                      // Create the reminder object directly
                      const newReminder = {
                        date: reminderDate,
                        description: reminderContent
                      };
                      
                      addReminderMutation.mutate({
                        jobId: selectedJob.id || Number(selectedJob.job_number),
                        reminder: newReminder
                      });
                      
                      // Clear form
                      setReminderContent("");
                      setReminderDate("");
                      setSelectedJob(null);
                    } else {
                      console.error("No job selected for reminder in main dialog");
                      toast({
                        title: "Error",
                        description: "Please select a job first",
                        variant: "destructive"
                      });
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

      {/* Workspace tabs */}
      {renderWorkspaceTabs()}

      {/* Conditionally show either Active Jobs or Purchase Orders based on selected tab */}
      {activeWorkspaceTab === "jobs" ? (
        /* Redesigned Active Jobs section */
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-medium">Active Jobs</h2>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-gray-100 rounded-md p-1">
                <button
                  onClick={() => setJobViewMode("card")}
                  className={`p-1.5 rounded ${jobViewMode === "card" ? "bg-white shadow-sm" : ""}`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setJobViewMode("table")}
                  className={`p-1.5 rounded ${jobViewMode === "table" ? "bg-white shadow-sm" : ""}`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
              <input
                type="text"
                placeholder="Search jobs..."
                className="px-3 py-1 border rounded-md text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {jobViewMode === "card" ? renderJobCards() : renderJobTable()}
          
          {sortedJobs.length > jobsPerPage && renderPagination()}

          {sortedJobs.length === 0 && (
            <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed">
              <div className="mx-auto flex justify-center text-gray-400">
                <FileText className="h-8 w-8" />
              </div>
              <p className="mt-2 text-gray-600">No active jobs found</p>
              <p className="text-sm text-gray-500">Try adjusting your search or import new jobs</p>
            </div>
          )}
        </div>
      ) : (
        /* Purchase Orders section takes the full width when selected */
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-medium">Purchase Orders</h2>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Search purchase orders..."
                className="px-3 py-1 border rounded-md text-sm"
              />
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-1" /> Export
              </Button>
            </div>
          </div>
          
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">PO Number</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Related Job</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.length > 0 ? (
                  purchaseOrders.map(po => {
                    // Validate the date and price
                    const documentDate = po.document_date ? new Date(po.document_date) : null;
                    const isValidDate = documentDate && !isNaN(documentDate.getTime());
                    const netPrice = typeof po.net_price === 'number' ? po.net_price : 0;
                    
                    // Get the PO number from either purchasing_document or po_number field
                    const poNumber = po.purchasing_document || '';
                    
                    return (
                      <tr 
                        key={po.id} 
                        className="hover:bg-gray-50 cursor-pointer border-b"
                        onClick={() => {
                          const po = purchaseOrders.find(p => p.purchasing_document === poNumber);
                          setSelectedPONumber(poNumber);
                          setSelectedPO(po || null);
                          
                          // Find all POs with the same PO number
                          const allRelatedPOs = purchaseOrders.filter(p => p.purchasing_document === poNumber);
                          setRelatedPOs(allRelatedPOs);
                          
                          setIsPOModalOpen(true);
                        }}
                      >
                        <td className="py-3 px-4 font-medium text-blue-600">{poNumber}</td>
                        <td className="py-3 px-4">{po.vendor}</td>
                        <td className="py-3 px-4">
                          {isValidDate ? format(documentDate!, "MMM dd, yyyy") : "No date"}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            po.status === "Completed" ? "bg-green-100 text-green-800" :
                            po.status === "Open" ? "bg-yellow-100 text-yellow-800" :
                            po.status === "Cancelled" ? "bg-red-100 text-red-800" :
                            "bg-gray-100 text-gray-800"
                          }`}>
                            {po.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">${netPrice.toFixed(2)}</td>
                        <td className="py-3 px-4">
                          {po.req_tracking_number ? (
                            <button 
                              className="text-blue-600 hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedJobNumber(po.req_tracking_number);
                                setIsPOModalOpen(false);
                                setIsJobModalOpen(true);
                              }}
                            >
                              #{po.req_tracking_number}
                            </button>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPONumber(poNumber);
                              setSelectedPO(po);
                              setIsPOModalOpen(true);
                            }}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <FileText className="h-10 w-10 text-gray-300 mb-2" />
                        <p>No purchase orders found</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-2"
                          onClick={handleImportData}
                        >
                          <Upload className="h-4 w-4 mr-1" /> Import Purchase Orders
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                                console.log("Adding reminder from upcoming deadlines section for job:", job.id);
                                
                                // Create the reminder object directly
                                const newReminder = {
                                  date: reminderDate,
                                  description: reminderContent
                                };
                                
                                addReminderMutation.mutate({
                                  jobId: Number(job.id),
                                  reminder: newReminder
                                });
                                
                                // Clear form
                                setReminderContent("");
                                setReminderDate("");
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
                      <span className={getPriorityColor(job.priority, job.progress)}>
                        {job.priority || (job.progress < 30 ? "High" : job.progress < 70 ? "Medium" : "Low")}
                      </span>
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
      {activeWorkspaceTab === "jobs" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Logistics & Purchase Orders */}
          {renderPurchaseOrdersSection()}

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
      )}

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

      <PurchaseOrderModal
        poNumber={selectedPONumber}
        purchaseOrder={selectedPO}
        allPurchaseOrders={relatedPOs}
        isOpen={isPOModalOpen}
        onClose={() => {
          setIsPOModalOpen(false);
          setSelectedPONumber(null);
          setSelectedPO(null);
          setRelatedPOs([]);
        }}
      />

      <JobModal
        jobNumber={selectedJobNumber}
        isOpen={isJobModalOpen}
        onClose={() => {
          setIsJobModalOpen(false);
          setSelectedJobNumber(null);
        }}
      />

      {/* Job Card Reminder Dialog */}
      <Dialog open={isJobCardReminderOpen} onOpenChange={(open) => {
        // When closing dialog, don't reset the jobForReminder yet
        setIsJobCardReminderOpen(open);
        // Only clear reminder content and date if dialog is closing
        if (!open) {
          setReminderContent("");
          setReminderDate("");
        } else {
          // When opening, set a default time of 2 minutes from now
          const twoMinutesFromNow = new Date(Date.now() + 2 * 60 * 1000);
          setReminderDate(twoMinutesFromNow.toISOString().slice(0, 16));
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {jobForReminder ? `Add Reminder for Job #${jobForReminder.job_number}` : 'Add Reminder'}
            </DialogTitle>
            <DialogDescription>
              Set a reminder for this job to stay on track.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Selected Job:</Label>
              <div className="p-2 border rounded mt-1 bg-gray-50">
                {jobForReminder ? `#${jobForReminder.job_number} - ${jobForReminder.title}` : 'No job selected'}
              </div>
            </div>
            <div>
              <Label>Reminder Date</Label>
              <Input
                type="datetime-local"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                {reminderDate ? 
                  `Reminder will trigger at ${new Date(reminderDate).toLocaleString()}` : 
                  'Please select a date and time'
                }
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => {
                  const twoMinutesFromNow = new Date(Date.now() + 2 * 60 * 1000);
                  setReminderDate(twoMinutesFromNow.toISOString().slice(0, 16));
                }}
              >
                2 Min
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => {
                  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
                  setReminderDate(fiveMinutesFromNow.toISOString().slice(0, 16));
                }}
              >
                5 Min
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => {
                  const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000);
                  setReminderDate(tenMinutesFromNow.toISOString().slice(0, 16));
                }}
              >
                10 Min
              </Button>
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
                console.log("Add reminder button clicked for job:", jobForReminder);
                if (jobForReminder) {
                  console.log("Adding reminder for job:", jobForReminder.job_number, reminderDate, reminderContent);
                  console.log("Reminder time parsed:", new Date(reminderDate).toLocaleString());
                  
                  // Create the reminder object directly instead of passing through handleAddReminder
                  const newReminder = {
                    date: reminderDate,
                    description: reminderContent
                  };
                  
                  // Use the mutation with the correct ID field
                  console.log("About to call mutation with job:", jobForReminder); 
                  addReminderMutation.mutate({
                    jobId: jobForReminder.id || Number(jobForReminder.job_number),
                    reminder: newReminder
                  });
                  
                  // Clear content but keep the job selected for potentially adding more reminders
                  setReminderContent("");
                  
                  // Set a new default time 2 minutes from now for the next reminder
                  const twoMinutesFromNow = new Date(Date.now() + 2 * 60 * 1000);
                  setReminderDate(twoMinutesFromNow.toISOString().slice(0, 16));
                  
                  // Close the dialog
                  setIsJobCardReminderOpen(false);
                } else {
                  console.error("No job selected for reminder");
                  toast({
                    title: "Error",
                    description: "No job selected. Please try again.",
                    variant: "destructive"
                  });
                }
              }}
              disabled={!jobForReminder || !reminderContent.trim() || !reminderDate}
            >
              Add Reminder
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}