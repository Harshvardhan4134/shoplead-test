import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Truck,
  Package,
  ArrowRight,
  Calendar,
  Filter,
  Search,
  Download,
  Clock,
  CheckCircle,
  AlertTriangle,
  Info,
  Map,
  MapPin,
  Plus,
  ExternalLink,
  ShoppingCart,
  LayoutDashboard
} from "lucide-react";
import { db } from "@/lib/db";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useQueryClient } from "@tanstack/react-query";

// Add type definitions
interface ShipmentLog {
  id: number;
  po_number: string | null;
  vendor: string;
  shipment_date: string;
  received_date: string | null;
  status: string;
  tracking_number: string | null;
  carrier: string | null;
}

interface PurchaseOrder {
  id: number;
  po_number: string;
  job_id: number | null;
  vendor: string;
  amount: number;
  status: string;
  issue_date: string;
  expected_date: string | null;
  received_date: string | null;
  notes: string | null;
  description: string | null;
  severity: string | null;
}

interface Job {
  id: number;
  job_number: string;
  title: string;
  description?: string;
  status: string;
  due_date: string;
  scheduled_date: string;
  priority?: string;
  progress?: number;
  work_center?: string;
  customer: string;
  sap_data?: any[];
  vendor_operations?: any[];
  notes?: any[];
  reminders?: any[];
  timeline?: any[];
  ncr?: any[];
}

interface VendorOperation {
  id: number;
  job_id: number;
  operation: string;
  vendor: string;
  date_range: string;
  status: string;
  notes: string | null;
}

interface JobTimeline {
  id: number;
  job_id: number;
  status: string;
  date: string;
  description: string;
  vendor?: string;
  title?: string;
}

interface TimelineEvent {
  id: number;
  title: string;
  date: string;
  description: string;
  status: 'completed' | 'in-progress' | 'pending';
}

export default function Logistics() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "po-tracking" | "shipment-log" | "job-status" | "tracking" | "inbound" | "outbound">("dashboard");
  const [selectedShipment, setSelectedShipment] = useState<ShipmentLog | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobStatusTab, setJobStatusTab] = useState<"vendor-operations" | "timeline" | "related-pos" | "purchase-orders">("vendor-operations");

  const queryClient = useQueryClient();

  // Add error state
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Initialize database tables when component mounts
  useEffect(() => {
    const initializeTables = async () => {
      try {
        console.log('Initializing logistics tables...');
        setIsInitializing(true);
        
        // Check if tables exist, create if they don't
        const tablesExist = await db.checkTablesExist();
        console.log('Table check results:', tablesExist);
        
        // If any required logistics tables are missing, insert sample data
        if (!tablesExist.vendorOps || !tablesExist.jobTimelines || 
            !tablesExist.purchaseOrders || !tablesExist.shipmentLogs) {
          console.log('Some logistics tables missing, inserting test data...');
          await db.insertTestData();
          
          // Refresh queries
          queryClient.invalidateQueries();
        } else {
          console.log('All logistics tables exist');
        }
      } catch (err) {
        console.error('Error initializing tables:', err);
        setError('Failed to initialize database tables. Please try again.');
      } finally {
        setIsInitializing(false);
      }
    };
    
    initializeTables();
  }, [queryClient]);

  // Helper function to handle errors
  const handleError = (error: Error) => {
    console.error('Error:', error);
    setError(error.message);
    // Clear error after 5 seconds
    setTimeout(() => setError(null), 5000);
  };

  // Sample outbound shipments
  const outboundShipments = [
    {
      id: 101,
      shipmentNumber: "OUT-2023-156",
      customerName: "Acme Corp",
      shipmentDate: new Date("2023-07-15"),
      deliveryDate: new Date("2023-07-20"),
      status: "In Transit",
      carrier: "FedEx",
      trackingNumber: "FX7865412390"
    },
    {
      id: 102,
      shipmentNumber: "OUT-2023-157",
      customerName: "TechSystems Inc",
      shipmentDate: new Date("2023-07-16"),
      deliveryDate: new Date("2023-07-22"),
      status: "Scheduled",
      carrier: "UPS",
      trackingNumber: "1Z9845W23947834"
    },
    {
      id: 103,
      shipmentNumber: "OUT-2023-158",
      customerName: "Industrial Solutions",
      shipmentDate: new Date("2023-07-14"),
      deliveryDate: new Date("2023-07-19"),
      status: "Delivered",
      carrier: "DHL",
      trackingNumber: "DHL2349857340"
    }
  ];

  // Tracking info mock data
  const trackingUpdates = [
    {
      date: new Date("2023-07-15T08:30:00"),
      status: "Picked up",
      location: "Manufacturing Facility, Houston, TX",
      notes: "Package picked up by carrier"
    },
    {
      date: new Date("2023-07-15T14:45:00"),
      status: "Departed Facility",
      location: "FedEx Facility, Houston, TX",
      notes: "Package sorted and in transit"
    },
    {
      date: new Date("2023-07-16T07:15:00"),
      status: "Arrived at Facility",
      location: "FedEx Hub, Memphis, TN",
      notes: "Package arrived at hub facility"
    },
    {
      date: new Date("2023-07-16T19:30:00"),
      status: "Departed Facility",
      location: "FedEx Hub, Memphis, TN",
      notes: "Package in transit to destination"
    },
    {
      date: new Date("2023-07-17T10:20:00"),
      status: "Out for Delivery",
      location: "FedEx Facility, Chicago, IL",
      notes: "Package is out for delivery"
    },
    {
      date: new Date("2023-07-17T15:45:00"),
      status: "Delivered",
      location: "Acme Corp, Chicago, IL",
      notes: "Package delivered, signed by J. Smith"
    }
  ];

  // Inside the component, add this mock data for timeline
  const timelineEvents: TimelineEvent[] = [
    {
      id: 1,
      title: "Job Started",
      date: "2023-06-15",
      description: "Initial materials ordered",
      status: "completed"
    },
    {
      id: 2,
      title: "Sent to CNC Machining",
      date: "2023-06-20",
      description: "Parts sent to Precision Machining Co.",
      status: "completed"
    },
    {
      id: 3,
      title: "CNC Machining Completed",
      date: "2023-07-05",
      description: "All machined parts received",
      status: "completed"
    },
    {
      id: 4,
      title: "Sent to Surface Treatment",
      date: "2023-07-10",
      description: "Parts sent to Surface Solutions Inc.",
      status: "in-progress"
    }
  ];

  // Update the data fetching functions to handle errors
  const { data: shipmentLogs, isLoading: isLoadingShipments } = useQuery<ShipmentLog[]>({
    queryKey: ["shipmentLogs"],
    queryFn: async () => {
      try {
        return await db.getShipmentLogs();
      } catch (error) {
        handleError(error as Error);
        return [];
      }
    }
  });

  // Fetch purchase orders with improved error handling
  const { data: purchaseOrders = [], isLoading: isLoadingPOs } = useQuery<PurchaseOrder[]>({
    queryKey: ["purchaseOrders"],
    queryFn: async () => {
      try {
        console.log('Fetching purchase orders...');
        const pos = await db.getPurchaseOrders();
        console.log('Fetched purchase orders:', pos);
        return pos;
      } catch (error) {
        console.error('Error fetching purchase orders:', error);
        handleError(error as Error);
        return [];
      }
    }
  });

  // Fetch jobs with improved error handling
  const { data: jobs = [], isLoading: isLoadingJobs } = useQuery<Job[]>({
    queryKey: ["jobs"],
    queryFn: async () => {
      try {
        console.log('Fetching jobs...');
        const jobList = await db.getJobs();
        console.log('Fetched jobs:', jobList);
        // Ensure jobList items match our Job interface
        return jobList.map(job => ({
          id: job.id || 0,
          job_number: job.job_number,
          title: job.title || '',
          description: job.description || '',
          status: job.status || 'New',
          due_date: job.due_date,
          scheduled_date: job.scheduled_date,
          priority: job.priority || 'Medium',
          progress: job.progress || 0,
          work_center: job.work_center || '',
          customer: job.customer || '',
          sap_data: job.sap_data || []
        })) as Job[];
      } catch (error) {
        console.error('Error fetching jobs:', error);
        handleError(error as Error);
        return [];
      }
    }
  });

  // Add test data
  const insertTestData = async () => {
    try {
      await db.insertTestData();
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['vendorOperations'] });
      queryClient.invalidateQueries({ queryKey: ['jobTimelines'] });
      queryClient.invalidateQueries({ queryKey: ['relatedPOs'] });
    } catch (error) {
      console.error('Error inserting test data:', error);
    }
  };

  // Fetch vendor operations with improved error handling
  const { data: vendorOperations = [], isLoading: isLoadingVendorOps } = useQuery<VendorOperation[]>({
    queryKey: ["vendorOperations", selectedJob?.id],
    queryFn: async () => {
      if (!selectedJob?.id) return [];
      console.log('Fetching vendor operations for job:', selectedJob.id);
      try {
        const operations = await db.getVendorOperations();
        console.log('All vendor operations:', operations);
        const filtered = operations.filter(op => op.job_id === selectedJob.id);
        console.log('Filtered vendor operations:', filtered);
        return filtered;
      } catch (error) {
        console.error('Error fetching vendor operations:', error);
        handleError(error as Error);
        return [];
      }
    },
    enabled: !!selectedJob?.id
  });

  // Fetch job timelines with improved error handling
  const { data: jobTimelines = [], isLoading: isLoadingTimelines } = useQuery<JobTimeline[]>({
    queryKey: ["jobTimelines", selectedJob?.id],
    queryFn: async () => {
      if (!selectedJob?.id) return [];
      console.log('Fetching timelines for job:', selectedJob.id);
      try {
        const timelines = await db.getJobTimelines(selectedJob.id);
        console.log('Job timelines:', timelines);
        return timelines;
      } catch (error) {
        console.error('Error fetching job timelines:', error);
        handleError(error as Error);
        return [];
      }
    },
    enabled: !!selectedJob?.id
  });

  // Fetch related purchase orders with improved error handling
  const { data: relatedPOs = [], isLoading: isLoadingRelatedPOs } = useQuery<PurchaseOrder[]>({
    queryKey: ["relatedPOs", selectedJob?.id],
    queryFn: async () => {
      if (!selectedJob?.id) return [];
      console.log('Fetching related POs for job:', selectedJob.id);
      try {
        const pos = await db.getPurchaseOrders();
        console.log('All POs:', pos);
        const filtered = pos.filter(po => po.job_id === selectedJob.id);
        console.log('Filtered POs:', filtered);
        return filtered;
      } catch (error) {
        console.error('Error fetching related POs:', error);
        handleError(error as Error);
        return [];
      }
    },
    enabled: !!selectedJob?.id
  });

  // Purchase Order Status Counts
  const poStatusCounts = {
    open: purchaseOrders?.filter(po => po.status === "Open")?.length || 0,
    inProgress: purchaseOrders?.filter(po => po.status === "In Progress")?.length || 0,
    closed: purchaseOrders?.filter(po => po.status === "Closed")?.length || 0
  }

  // Recent shipments - most recent 3 shipments
  const recentShipments = shipmentLogs?.sort((a, b) => 
    new Date(b.shipment_date).getTime() - new Date(a.shipment_date).getTime()
  ).slice(0, 3);

  // Active jobs
  const activeJobs = jobs?.filter(job => 
    job.status !== "Completed"
  ).slice(0, 3);

  // Filter for inbound shipments (received = null or in the future)
  const inboundShipments = shipmentLogs?.filter(shipment => 
    !shipment.received_date || new Date(shipment.received_date) > new Date()
  );

  // Update the data filtering sections
  const pendingPOs = purchaseOrders?.filter(po => po.status === "pending") || [];
  const inProgressPOs = purchaseOrders?.filter(po => po.status === "in-progress") || [];
  const completedPOs = purchaseOrders?.filter(po => po.status === "completed") || [];

  // Inbound shipments columns
  const inboundColumns = [
    {
      header: "PO Number",
      accessorKey: "po_number",
      cell: (row: ShipmentLog) => (
        <div className="font-medium text-primary">{row.po_number || "No PO"}</div>
      )
    },
    {
      header: "Vendor",
      accessorKey: "vendor"
    },
    {
      header: "Shipment Date",
      accessorKey: (row: ShipmentLog) => format(isValid(new Date(row.shipment_date)) ? new Date(row.shipment_date) : new Date(), "MMM d, yyyy"),
    },
    {
      header: "Est. Delivery",
      accessorKey: (row: ShipmentLog) => {
        const estDelivery = new Date(row.shipment_date);
        estDelivery.setDate(estDelivery.getDate() + 5);
        return format(estDelivery, "MMM d, yyyy");
      },
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row: ShipmentLog) => (
        <StatusBadge status={row.status} />
      )
    },
    {
      header: "Carrier",
      accessorKey: "carrier",
      cell: (row: ShipmentLog) => (
        <div>{row.carrier || "Not specified"}</div>
      )
    },
    {
      header: "Tracking",
      accessorKey: "tracking_number",
      cell: (row: ShipmentLog) => (
        <div className="flex items-center">
          {row.tracking_number ? (
            <a 
              href="#" 
              className="text-primary hover:underline flex items-center"
              onClick={(e) => {
                e.preventDefault();
                setSelectedShipment(row);
                setActiveTab("tracking");
              }}
            >
              {row.tracking_number.substring(0, 10)}...
              <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          ) : (
            <span className="text-gray-500">No tracking</span>
          )}
        </div>
      )
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (row: ShipmentLog) => (
        <div className="flex space-x-2 justify-end">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  // Outbound shipments columns
  const outboundColumns = [
    {
      header: "Shipment #",
      accessorKey: "id",
      cell: (row: any) => (
        <div className="font-medium text-primary">{row.id}</div>
      )
    },
    {
      header: "Customer",
      accessorKey: "customerName"
    },
    {
      header: "Shipment Date",
      accessorKey: (row: any) => format(isValid(new Date(row.shipmentDate)) ? new Date(row.shipmentDate) : new Date(), "MMM d, yyyy"),
    },
    {
      header: "Est. Delivery",
      accessorKey: (row: any) => format(isValid(new Date(row.deliveryDate)) ? new Date(row.deliveryDate) : new Date(), "MMM d, yyyy"),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row: any) => (
        <StatusBadge status={row.status} />
      )
    },
    {
      header: "Carrier",
      accessorKey: "carrier"
    },
    {
      header: "Tracking",
      accessorKey: "trackingNumber",
      cell: (row: any) => (
        <div className="flex items-center">
          <a 
            href="#" 
            className="text-primary hover:underline flex items-center"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab("tracking");
              setSelectedShipment({
                id: row.id,
                po_number: null,
                vendor: row.customerName,
                shipment_date: row.shipmentDate,
                received_date: null,
                status: row.status,
                tracking_number: row.trackingNumber,
                carrier: row.carrier
              } as ShipmentLog);
            }}
          >
            {row.trackingNumber.substring(0, 10)}...
            <ExternalLink className="ml-1 h-3 w-3" />
          </a>
        </div>
      )
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (row: any) => (
        <div className="flex space-x-2 justify-end">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  // Function to get the status icon for tracking
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "picked up":
        return <Package className="h-5 w-5 text-blue-500" />;
      case "departed facility":
        return <Truck className="h-5 w-5 text-blue-500" />;
      case "arrived at facility":
        return <MapPin className="h-5 w-5 text-yellow-500" />;
      case "out for delivery":
        return <Truck className="h-5 w-5 text-yellow-500" />;
      case "delivered":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };

  // Add diagnostic function
  const runDiagnostics = async () => {
    try {
      setError(null);
      console.log('Running diagnostics...');
      const diagnosticResults = await db.diagnosePageData('logistics');
      console.log('Diagnostic results:', diagnosticResults);
      
      if (diagnosticResults.status !== 'ok') {
        setError(`Diagnostics found issues: ${diagnosticResults.message}`);
      } else {
        setError('Diagnostics completed successfully. All required tables exist and have data.');
      }
      
      // Refresh queries after diagnostics
      queryClient.invalidateQueries();
      
    } catch (err) {
      console.error('Error running diagnostics:', err);
      setError(`Error running diagnostics: ${err.message}`);
    }
  };

  // Add fix data function
  const fixPageData = async (pageName: string) => {
    try {
      setError(null);
      console.log(`Fixing data for ${pageName} page...`);
      const fixResults = await db.fixPageData(pageName);
      console.log(`Fix results for ${pageName}:`, fixResults);
      
      if (fixResults.success) {
        setError(`Successfully fixed data for ${pageName} page: ${fixResults.message}`);
      } else {
        setError(`Failed to fix data for ${pageName} page: ${fixResults.message}`);
      }
      
      // Refresh queries after fix
      queryClient.invalidateQueries();
      
    } catch (err) {
      console.error(`Error fixing ${pageName} page data:`, err);
      setError(`Error fixing ${pageName} page data: ${err.message}`);
    }
  };

  // Add dropdown options for other pages
  const [selectedPage, setSelectedPage] = useState<string>('logistics');
  const pageOptions = [
    { value: 'logistics', label: 'Logistics Page' },
    { value: 'purchase', label: 'Purchase Page' },
    { value: 'forecasting', label: 'Forecasting Page' },
    { value: 'work-centers', label: 'Work Centers Page' },
    { value: 'ncr', label: 'NCR Page' }
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {isInitializing ? (
        <div className="flex items-center justify-center h-[80vh]">
          <div className="text-center">
            <LoadingSpinner />
            <p className="mt-4 text-gray-600">Initializing logistics data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Admin tools */}
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="text-lg font-medium mb-3">Admin Tools</h3>
            <div className="flex items-center space-x-3">
              <select 
                className="border border-gray-300 rounded px-3 py-2"
                value={selectedPage}
                onChange={(e) => setSelectedPage(e.target.value)}
              >
                {pageOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              
              <Button variant="outline" className="flex items-center" onClick={() => runDiagnostics()}>
                <Info className="mr-2 h-4 w-4" />
                Diagnose Current Page
              </Button>
              
              <Button variant="outline" className="flex items-center" onClick={() => fixPageData(selectedPage)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Fix {selectedPage.charAt(0).toUpperCase() + selectedPage.slice(1)} Page
              </Button>
              
              <Button variant="outline" className="flex items-center" onClick={() => insertTestData()}>
                <Plus className="mr-2 h-4 w-4" />
                Insert Test Data
              </Button>
            </div>
          </div>
          
          {/* Page header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold">Logistics</h1>
              <p className="text-gray-600 mt-1">Manage shipping, receiving, and track items in transit</p>
            </div>
            <div className="flex space-x-3">
              <Button variant="outline" className="flex items-center">
                <Filter className="mr-2 h-4 w-4" />
                Filter
              </Button>
              <Button variant="outline" className="flex items-center">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button className="flex items-center">
                <Plus className="mr-2 h-4 w-4" />
                New Order
              </Button>
            </div>
          </div>

          {/* Tab navigation */}
          <div className="flex border-b border-gray-200 mb-6">
            <button
              className={`px-4 py-2 font-medium text-sm border-b-2 flex items-center ${
                activeTab === "dashboard"
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("dashboard")}
            >
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard
            </button>
            <button
              className={`px-4 py-2 font-medium text-sm border-b-2 flex items-center ${
                activeTab === "po-tracking"
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("po-tracking")}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              PO Tracking
            </button>
            <button
              className={`px-4 py-2 font-medium text-sm border-b-2 flex items-center ${
                activeTab === "shipment-log"
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("shipment-log")}
            >
              <Truck className="mr-2 h-4 w-4" />
              Shipment Log
            </button>
            <button
              className={`px-4 py-2 font-medium text-sm border-b-2 flex items-center ${
                activeTab === "job-status"
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("job-status")}
            >
              <Clock className="mr-2 h-4 w-4" />
              Job Status
            </button>
            <button
              className={`px-4 py-2 font-medium text-sm border-b-2 flex items-center ${
                activeTab === "inbound"
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("inbound")}
            >
              <Package className="mr-2 h-4 w-4" />
              Inbound
            </button>
            <button
              className={`px-4 py-2 font-medium text-sm border-b-2 flex items-center ${
                activeTab === "outbound"
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("outbound")}
            >
              <ArrowRight className="mr-2 h-4 w-4" />
              Outbound
            </button>
          </div>

          {/* Dashboard View */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* Purchase Order Status */}
              <Card className="mb-6">
                <CardHeader className="pb-2">
                  <CardTitle>Purchase Order Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">{poStatusCounts.open}</div>
                      <div className="text-sm text-gray-600 mt-1">Open</div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-amber-600">{poStatusCounts.inProgress}</div>
                      <div className="text-sm text-gray-600 mt-1">In Progress</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">{poStatusCounts.closed}</div>
                      <div className="text-sm text-gray-600 mt-1">Closed</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Shipments */}
              <Card className="mb-6">
                <CardHeader className="pb-2">
                  <CardTitle>Recent Shipments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {isLoadingShipments ? (
                      <div className="text-center py-4">Loading shipments...</div>
                    ) : (
                      recentShipments?.length > 0 ? (
                        recentShipments.map(shipment => (
                          <div key={shipment.id} className="flex justify-between border-b border-gray-100 pb-3">
                            <div>
                              <div className="font-medium">{shipment.po_number || "No PO"}</div>
                              <div className="text-sm text-gray-500">{shipment.vendor} - {shipment.status}</div>
                            </div>
                            <div className="text-sm text-gray-500">
                              {format(isValid(new Date(shipment.shipment_date)) ? new Date(shipment.shipment_date) : new Date(), "yyyy-MM-dd")}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 text-gray-500">No recent shipments</div>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Active Jobs */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Active Jobs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="grid grid-cols-6 text-sm font-medium text-gray-500 pb-2 border-b">
                      <div className="col-span-1">JOB NUMBER</div>
                      <div className="col-span-2">TITLE</div>
                      <div className="col-span-1">CUSTOMER</div>
                      <div className="col-span-1">DUE DATE</div>
                      <div className="col-span-1">STATUS</div>
                    </div>
                    {isLoadingJobs ? (
                      <div className="text-center py-4">Loading jobs...</div>
                    ) : (
                      activeJobs?.length > 0 ? (
                        activeJobs.map(job => (
                          <div key={job.id} className="grid grid-cols-6 py-3 text-sm border-b border-gray-100">
                            <div className="col-span-1 text-primary font-medium">{job.job_number}</div>
                            <div className="col-span-2">{job.title}</div>
                            <div className="col-span-1">{job.customer}</div>
                            <div className="col-span-1">{format(new Date(job.due_date), "yyyy-MM-dd")}</div>
                            <div className="col-span-1">
                              <StatusBadge status={job.status} />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 text-gray-500">No active jobs</div>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* PO Tracking View */}
          {activeTab === "po-tracking" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Purchase Order Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between mb-4">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      placeholder="Search POs..."
                      className="pl-9 pr-4 py-2 w-full border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <select className="border border-gray-300 rounded-md text-sm p-2">
                    <option value="all">All Status</option>
                    <option value="open">Open</option>
                    <option value="in-progress">In Progress</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-2 font-medium text-gray-500">PO NUMBER</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-500">JOB NUMBER</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-500">VENDOR</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-500">DESCRIPTION</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-500">ISSUE DATE</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-500">EXPECTED DELIVERY</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-500">STATUS</th>
                        <th className="text-right py-3 px-2 font-medium text-gray-500">TOTAL</th>
                        <th className="text-center py-3 px-2 font-medium text-gray-500">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingPOs ? (
                        <tr>
                          <td colSpan={9} className="text-center py-4">
                            <LoadingSpinner message="Loading purchase orders..." />
                          </td>
                        </tr>
                      ) : purchaseOrders?.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center py-4 text-gray-500">
                            No purchase orders found. Click "Insert Test Data" to add sample data.
                          </td>
                        </tr>
                      ) : (
                        purchaseOrders.map((po) => (
                          <tr key={po.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-2 font-medium text-primary">{po.po_number}</td>
                            <td className="py-3 px-2">{po.job_id || "-"}</td>
                            <td className="py-3 px-2">{po.vendor}</td>
                            <td className="py-3 px-2">{po.description || "-"}</td>
                            <td className="py-3 px-2">{format(new Date(po.issue_date), "yyyy-MM-dd")}</td>
                            <td className="py-3 px-2">
                              {po.expected_date ? format(new Date(po.expected_date), "yyyy-MM-dd") : "-"}
                            </td>
                            <td className="py-3 px-2">
                              <StatusBadge status={po.status} />
                            </td>
                            <td className="py-3 px-2 text-right">{po.amount ? `$${po.amount.toFixed(2)}` : "-"}</td>
                            <td className="py-3 px-2 text-center">
                              <button className="text-primary hover:text-primary-dark transition-colors font-medium">
                                View
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Shipment Log View */}
          {activeTab === "shipment-log" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Shipment Log</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  data={shipmentLogs || []}
                  columns={inboundColumns}
                  searchKey="po_number"
                  isLoading={isLoadingShipments}
                  pageSize={10}
                />
              </CardContent>
            </Card>
          )}

          {/* Job Status View */}
          {activeTab === "job-status" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-semibold">Job Status Dashboard</h1>
                <Button onClick={insertTestData} variant="outline">
                  Insert Test Data
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {/* Job selection */}
                <div>
                  <h3 className="text-base font-medium mb-2">Select Job</h3>
                  <select 
                    className="w-full border border-gray-300 rounded-md p-2"
                    value={selectedJob?.id || ""}
                    onChange={(e) => {
                      const jobId = parseInt(e.target.value);
                      console.log('Selected job ID:', jobId);
                      const job = jobs?.find(j => j.id === jobId) || null;
                      console.log('Selected job:', job);
                      setSelectedJob(job);
                    }}
                  >
                    <option value="">Select a job...</option>
                    {jobs?.map(job => (
                      <option key={job.id} value={job.id}>
                        {job.job_number} - {job.title}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedJob && (
                  <>
                    {/* Job Overview */}
                    <div className="bg-white rounded-lg p-6">
                      <div className="flex items-start justify-between mb-6">
                        <div>
                          <h2 className="text-xl font-semibold">{selectedJob.title}</h2>
                          <p className="text-gray-500 mt-1">{selectedJob.customer}</p>
                        </div>
                        <div className="px-3 py-1 text-sm font-medium rounded-full bg-amber-100 text-amber-800">
                          In Progress
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${selectedJob?.progress ?? 0}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">{selectedJob?.progress ?? 0}%</span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-6">
                        <div>
                          <div className="text-sm text-gray-500">Start Date</div>
                          <div className="mt-1">{format(new Date(selectedJob.scheduled_date), "yyyy-MM-dd")}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">Due Date</div>
                          <div className="mt-1">{format(new Date(selectedJob.due_date), "yyyy-MM-dd")}</div>
                        </div>
                      </div>

                      <div>
                        <p className="text-gray-500">Scheduled Date</p>
                        <p>{selectedJob?.scheduled_date ? format(new Date(selectedJob.scheduled_date), "MMM d, yyyy") : "-"}</p>
                      </div>
                    </div>

                    {/* Tabs Section */}
                    <div className="bg-white rounded-lg">
                      <div className="border-b border-gray-200">
                        <div className="flex">
                          <button
                            className={`px-6 py-4 text-sm font-medium border-b-2 ${
                              jobStatusTab === "vendor-operations"
                                ? "border-blue-600 text-blue-600"
                              : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                            onClick={() => setJobStatusTab("vendor-operations")}
                          >
                            Vendor Operations
                          </button>
                          <button
                            className={`px-6 py-4 text-sm font-medium border-b-2 ${
                              jobStatusTab === "timeline"
                                ? "border-blue-600 text-blue-600"
                              : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                            onClick={() => setJobStatusTab("timeline")}
                          >
                            Timeline
                          </button>
                          <button
                            className={`px-6 py-4 text-sm font-medium border-b-2 ${
                              jobStatusTab === "related-pos"
                                ? "border-blue-600 text-blue-600"
                              : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                            onClick={() => setJobStatusTab("related-pos")}
                          >
                            Related POs
                          </button>
                          <button
                            className={`px-6 py-4 text-sm font-medium border-b-2 ${
                              jobStatusTab === "purchase-orders"
                                ? "border-blue-600 text-blue-600"
                              : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                            onClick={() => setJobStatusTab("purchase-orders")}
                          >
                            Purchase Orders
                          </button>
                        </div>
                      </div>

                      <div className="p-6">
                        {/* Vendor Operations View */}
                        {jobStatusTab === "vendor-operations" && (
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="text-left text-gray-500 text-sm border-b border-gray-200">
                                  <th className="py-3 font-medium">OPERATION</th>
                                  <th className="py-3 font-medium">VENDOR</th>
                                  <th className="py-3 font-medium">DATE RANGE</th>
                                  <th className="py-3 font-medium">STATUS</th>
                                  <th className="py-3 font-medium">NOTES</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {isLoadingVendorOps ? (
                                  <tr>
                                    <td colSpan={5} className="text-center py-4">
                                      <LoadingSpinner message="Loading operations..." />
                                    </td>
                                  </tr>
                                ) : vendorOperations.length === 0 ? (
                                  <tr>
                                    <td colSpan={5} className="text-center py-4 text-gray-500">
                                      No vendor operations found. Click "Insert Test Data" to add sample data.
                                    </td>
                                  </tr>
                                ) : (
                                  vendorOperations.map(operation => (
                                    <tr key={operation.id}>
                                      <td className="py-4 font-medium">{operation.operation}</td>
                                      <td className="py-4 text-gray-600">{operation.vendor}</td>
                                      <td className="py-4 text-gray-600">{operation.date_range}</td>
                                      <td className="py-4">
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium
                                          ${operation.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                            operation.status === 'In Progress' ? 'bg-amber-100 text-amber-800' :
                                            'bg-blue-100 text-blue-800'}`}>
                                          {operation.status}
                                        </span>
                                      </td>
                                      <td className="py-4 text-gray-600">{operation.notes || "-"}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Timeline View */}
                        {jobStatusTab === "timeline" && (
                          <div className="relative pl-8">
                            {isLoadingTimelines ? (
                              <div className="text-center py-4">
                                <LoadingSpinner message="Loading timeline..." />
                              </div>
                            ) : jobTimelines.length === 0 ? (
                              <div className="relative mb-12">
                                {/* Timeline dot */}
                                <div className="absolute -left-10 mt-1">
                                  <div className="h-8 w-8 rounded-full flex items-center justify-center bg-gray-500">
                                    <div className="h-6 w-6 rounded-full bg-white flex items-center justify-center">
                                      <div className="h-4 w-4 rounded-full bg-gray-500" />
                                    </div>
                                  </div>
                                </div>
                                {/* Content */}
                                <div>
                                  <h3 className="text-base font-medium">Pending</h3>
                                  <p className="text-sm text-gray-500 mt-1">No timeline events yet</p>
                                  <p className="text-sm text-gray-600 mt-1">Timeline will be updated as the job progresses</p>
                                </div>
                              </div>
                            ) : (
                              jobTimelines.map((event, index) => (
                                <div key={event.id} className="relative mb-12">
                                  {/* Timeline dot */}
                                  <div className="absolute -left-10 mt-1">
                                    <div className={`h-8 w-8 rounded-full flex items-center justify-center
                                      ${event.status.toLowerCase() === 'completed' ? 'bg-emerald-500' : 
                                        event.status.toLowerCase() === 'in progress' ? 'bg-amber-500' : 
                                        'bg-blue-500'}`}
                                    >
                                      <div className="h-6 w-6 rounded-full bg-white flex items-center justify-center">
                                        <div className={`h-4 w-4 rounded-full 
                                          ${event.status.toLowerCase() === 'completed' ? 'bg-emerald-500' : 
                                            event.status.toLowerCase() === 'in progress' ? 'bg-amber-500' : 
                                            'bg-blue-500'}`}
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Vertical line */}
                                  {index < jobTimelines.length - 1 && (
                                    <div className="absolute -left-7 top-8 w-0.5 bg-gray-200" style={{ height: '64px' }}></div>
                                  )}

                                  {/* Content */}
                                  <div>
                                    <h3 className="text-base font-medium">{event.title}</h3>
                                    <p className="text-sm text-gray-500 mt-1">{format(new Date(event.date), "MMM d, yyyy")}</p>
                                    <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                                    {event.vendor && (
                                      <p className="text-sm text-gray-500 mt-1">Vendor: {event.vendor}</p>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}

                        {/* Related POs View */}
                        {jobStatusTab === "related-pos" && (
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="text-left text-gray-500 text-sm border-b border-gray-200">
                                  <th className="py-3 font-medium">PO NUMBER</th>
                                  <th className="py-3 font-medium">VENDOR</th>
                                  <th className="py-3 font-medium">DATE</th>
                                  <th className="py-3 font-medium">DESCRIPTION</th>
                                  <th className="py-3 font-medium">STATUS</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {isLoadingRelatedPOs ? (
                                  <tr>
                                    <td colSpan={5} className="text-center py-4">
                                      <LoadingSpinner message="Loading purchase orders..." />
                                    </td>
                                  </tr>
                                ) : relatedPOs.length === 0 ? (
                                  <tr>
                                    <td colSpan={5} className="text-center py-4 text-gray-500">
                                      No related purchase orders found.
                                    </td>
                                  </tr>
                                ) : (
                                  relatedPOs.map(po => (
                                    <tr key={po.id}>
                                      <td className="py-4">
                                        <a href="#" className="text-blue-600 hover:underline">{po.po_number}</a>
                                      </td>
                                      <td className="py-4 text-gray-600">{po.vendor}</td>
                                      <td className="py-4 text-gray-600">{format(new Date(po.issue_date), "yyyy-MM-dd")}</td>
                                      <td className="py-4 text-gray-600">{po.description || "-"}</td>
                                      <td className="py-4">
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium
                                          ${po.status.toLowerCase() === 'received' ? 'bg-emerald-100 text-emerald-800' :
                                            po.status.toLowerCase() === 'ordered' ? 'bg-blue-100 text-blue-800' :
                                            'bg-gray-100 text-gray-800'}`}>
                                          {po.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Purchase Orders View */}
                        {jobStatusTab === "purchase-orders" && (
                          <div className="space-y-4">
                            {isLoadingRelatedPOs ? (
                              <div className="text-center py-4">
                                <LoadingSpinner message="Loading purchase orders..." />
                              </div>
                            ) : relatedPOs && relatedPOs.length > 0 ? (
                              relatedPOs.map((po) => (
                                <div key={po.id} className="bg-white p-4 rounded-lg shadow">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <h3 className="text-lg font-medium">PO #{po.po_number}</h3>
                                      <p className="text-sm text-gray-500">Vendor: {po.vendor}</p>
                                    </div>
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full
                                      ${po.status.toLowerCase() === 'received' ? 'bg-emerald-100 text-emerald-800' :
                                        po.status.toLowerCase() === 'ordered' ? 'bg-blue-100 text-blue-800' :
                                        'bg-gray-100 text-gray-800'}`}
                                    >
                                      {po.status}
                                    </span>
                                  </div>
                                  <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <p className="text-gray-500">Order Date</p>
                                      <p>{format(new Date(po.issue_date), "MMM d, yyyy")}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500">Expected Date</p>
                                      <p>{po.expected_date ? format(new Date(po.expected_date), "MMM d, yyyy") : "-"}</p>
                                    </div>
                                    {po.received_date && (
                                      <div>
                                        <p className="text-gray-500">Received Date</p>
                                        <p>{format(new Date(po.received_date), "MMM d, yyyy")}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-4 text-gray-500">No purchase orders found</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === "outbound" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Outbound Shipments</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  data={outboundShipments}
                  columns={outboundColumns}
                  searchKey="shipmentNumber"
                  pageSize={10}
                />
              </CardContent>
            </Card>
          )}

          {activeTab === "tracking" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Shipment Details */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle>Shipment Details</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedShipment ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-medium text-primary">
                            {selectedShipment.tracking_number ? selectedShipment.tracking_number.substring(0, 10) : `Shipment ${selectedShipment.id}`}
                          </h3>
                          {selectedShipment.po_number && (
                            <p className="text-sm text-gray-500">
                              PO: {selectedShipment.po_number}
                            </p>
                          )}
                        </div>
                        <StatusBadge status={selectedShipment.status} />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-500">Vendor/Customer</h4>
                          <p className="mt-1">{selectedShipment.vendor}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-500">Carrier</h4>
                          <p className="mt-1">{selectedShipment.carrier || "Not specified"}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-500">Shipment Date</h4>
                          <p className="mt-1">
                            {format(isValid(new Date(selectedShipment.shipment_date)) ? new Date(selectedShipment.shipment_date) : new Date(), "MMM d, yyyy")}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-500">Tracking Number</h4>
                          <p className="mt-1 break-all">{selectedShipment.tracking_number || "None"}</p>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-gray-100">
                        <h4 className="text-sm font-medium text-gray-500 mb-2">Carrier Website</h4>
                        <Button variant="outline" className="w-full justify-start">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open Carrier Tracking
                        </Button>
                      </div>

                      <div className="pt-4 border-t border-gray-100">
                        <h4 className="text-sm font-medium text-gray-500 mb-2">Related Documents</h4>
                        <div className="space-y-2">
                          <Button variant="outline" className="w-full justify-start">
                            <ShoppingCart className="mr-2 h-4 w-4" />
                            View Purchase Order
                          </Button>
                          <Button variant="outline" className="w-full justify-start">
                            <Package className="mr-2 h-4 w-4" />
                            Packing List
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                        <Package className="h-6 w-6 text-gray-400" />
                      </div>
                      <h3 className="mt-4 text-sm font-medium text-gray-900">No Shipment Selected</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Select a shipment to view tracking details
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tracking Timeline */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle>Tracking Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedShipment ? (
                    <div className="relative">
                      {/* Vertical line */}
                      <div className="absolute left-5 top-6 bottom-0 w-0.5 bg-gray-200"></div>

                      {/* Timeline events */}
                      <div className="space-y-8">
                        {trackingUpdates.map((update, index) => (
                          <div key={index} className="flex items-start relative">
                            {/* Status icon */}
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center z-10">
                              {getStatusIcon(update.status)}
                            </div>

                            {/* Event details */}
                            <div className="ml-4 flex-grow">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-medium">{update.status}</div>
                                  <div className="text-sm text-gray-500">{update.location}</div>
                                </div>
                                <div className="text-sm text-gray-500">
                                  {format(new Date(update.date), "MMM d, h:mm a")}
                                </div>
                              </div>
                              {update.notes && (
                                <div className="mt-1 text-sm text-gray-600">{update.notes}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                        <Map className="h-6 w-6 text-gray-400" />
                      </div>
                      <h3 className="mt-4 text-sm font-medium text-gray-900">No Tracking Information</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Select a shipment to view tracking history
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}