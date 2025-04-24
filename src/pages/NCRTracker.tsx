import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { db } from "@/lib/db";
import { queryClient } from "@/lib/queryClient";
import { RefreshCw, ClipboardList } from "lucide-react";
import NCRSummary from "@/components/ncr/NCRSummary";
import NCRList from "@/components/ncr/NCRList";
import { type NCR, type NCRFormData, NCR_STATUS, NCR_CATEGORIES } from "@/types/ncr";

// Interface for pending NCRs (auto-detected but not submitted)
interface PendingNCR {
  job_number: string;
  customer_name: string;
  work_order: string;
  operation_number: string;
  part_name: string;
  equipment_type: string;
  planned_hours: number;
  actual_hours: number;
}

export default function NCRTracker() {
  const [selectedNCR, setSelectedNCR] = useState<NCR | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [filterQuery, setFilterQuery] = useState("");
  const [ncrFormOpen, setNcrFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    sales_document: "",
    order_number: "",
    work_center: "",
    operation: "",
    description: "",
    short_text: "",
    planned_work: 0,
    actual_work: 0,
    comments: ""
  });

  // Additional state for the NCR form
  const [ncrSubmitFormOpen, setNcrSubmitFormOpen] = useState(false);
  const [selectedPendingNCR, setSelectedPendingNCR] = useState<PendingNCR | null>(null);
  const [ncrFormData, setNcrFormData] = useState<Partial<NCRFormData>>({
    ncr_number: "",
    issue_category: "",
    financial_impact: 0,
    issue_description: "",
    root_cause: "",
    corrective_action: "",
    equipment_type: "",
    drawing_number: ""
  });

  // Reset form state with proper typing
  const resetNcrFormData = () => {
    const defaultFormData: Partial<NCRFormData> = {
      ncr_number: "",
      issue_category: "",
      financial_impact: 0,
      issue_description: "",
      root_cause: "",
      corrective_action: "",
      equipment_type: "",
      drawing_number: ""
    };
    setNcrFormData(defaultFormData);
  };

  // Fetch NCR data
  const { data: ncrs = [], isLoading, error } = useQuery<NCR[]>({
    queryKey: ["ncrs"],
    queryFn: async () => {
      try {
        console.log('Starting to fetch NCRs...');
        const data = await db.getNCRs();
        console.log('Raw NCR data from database:', data);

        if (!data) {
          console.warn('No data returned from getNCRs');
          return [];
        }

        // Map the data to ensure all required fields exist
        const ncrOperations = data.map(job => ({
          id: job.id || 0,
          job_number: job.job_number || '',
          work_order: job.work_order || '',
          operation_number: job.operation_number || '',
          part_name: job.part_name || '',
          customer_name: job.customer_name || '',
          equipment_type: job.equipment_type || '',
          drawing_number: job.drawing_number || '',
          issue_category: job.issue_category || '',
          issue_description: job.issue_description || '',
          root_cause: job.root_cause || '',
          corrective_action: job.corrective_action || '',
          planned_hours: job.planned_hours || 0,
          actual_hours: job.actual_hours || 0,
          financial_impact: job.financial_impact || 0,
          status: job.status || '',
          pdf_report_url: job.pdf_report_url || '',
          drawing_url: job.drawing_url || '',
          created_at: job.created_at || '',
          updated_at: job.updated_at || ''
        }));

        console.log('Processed NCR operations:', ncrOperations);
        return ncrOperations;
      } catch (error) {
        console.error('Error in NCR query function:', error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  });

  // Update NCR mutation
  const updateNCRMutation = useMutation({
    mutationFn: async (updatedNCR: NCR) => {
      try {
        await db.upsertNCRs([updatedNCR]);
        return updatedNCR;
      } catch (error) {
        console.error('Error updating NCR:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ncrs'] });
      setNcrFormOpen(false);
      setSelectedNCR(null);
    }
  });

  // Create NCR mutation
  const createNCRMutation = useMutation({
    mutationFn: async (ncr: Omit<NCR, 'id'>) => {
      try {
        const newNCR = {
          ...ncr,
          id: Date.now(), // Generate a temporary ID
        };
        await db.upsertNCRs([newNCR]);
        return newNCR;
      } catch (error) {
        console.error('Error creating NCR:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ncrs'] });
      setNcrFormOpen(false);
      setFormData({
        sales_document: "",
        order_number: "",
        work_center: "",
        operation: "",
        description: "",
        short_text: "",
        planned_work: 0,
        actual_work: 0,
        comments: ""
      });
    }
  });

  // Generate mock pending NCRs for demonstration
  const pendingNCRData: PendingNCR[] = [
    {
      job_number: "100554416",
      customer_name: "SLC PIPELINE LLC (FEIN 27-0385778)",
      work_order: "4997696",
      operation_number: "90",
      part_name: "Throttle Sleeve",
      equipment_type: "N/A",
      planned_hours: 0,
      actual_hours: 6.28
    },
    {
      job_number: "100551234",
      customer_name: "COLORADO SPRINGS UTILITIES",
      work_order: "4982123",
      operation_number: "20",
      part_name: "Valve Body",
      equipment_type: "Lathe",
      planned_hours: 2.5,
      actual_hours: 4.75
    },
    {
      job_number: "100556789",
      customer_name: "WESTERN ENERGY CO",
      work_order: "4991547",
      operation_number: "30",
      part_name: "Shaft Coupling",
      equipment_type: "Mill",
      planned_hours: 3.0,
      actual_hours: 5.2
    },
    {
      job_number: "100559876",
      customer_name: "SUNLAND REFINERY",
      work_order: "4995782",
      operation_number: "40",
      part_name: "Impeller",
      equipment_type: "CNC",
      planned_hours: 8.0,
      actual_hours: 10.5
    },
    {
      job_number: "100552468",
      customer_name: "PHOENIX POWER SYSTEMS",
      work_order: "4988921",
      operation_number: "50",
      part_name: "Control Arm",
      equipment_type: "N/A",
      planned_hours: 4.5,
      actual_hours: 7.2
    },
    {
      job_number: "100557654",
      customer_name: "MOUNTAIN STATE ENERGY",
      work_order: "4993214",
      operation_number: "60",
      part_name: "Pipe Flange",
      equipment_type: "Boring Machine",
      planned_hours: 6.0,
      actual_hours: 8.4
    },
  ];

  // Number of submitted NCRs per quarter (for the bottom section)
  const submittedNCRsData = {
    q1: { count: 28, percent: 70 },
    q2: { count: 32, percent: 80 },
    q3: { count: 25, percent: 62.5 },
    q4: { count: 35, percent: 87.5 }
  };

  const handleSelectNCR = (ncr: NCR) => {
    console.log('Selected NCR:', ncr);
    setSelectedNCR(ncr);
  };

  const handleEditNCR = () => {
    if (!selectedNCR) return;

    setFormData({
      sales_document: selectedNCR.job_number,
      order_number: selectedNCR.work_order,
      work_center: selectedNCR.equipment_type || "",
      operation: selectedNCR.operation_number,
      description: selectedNCR.issue_description || "",
      short_text: selectedNCR.part_name,
      planned_work: selectedNCR.planned_hours || 0,
      actual_work: selectedNCR.actual_hours || 0,
      comments: selectedNCR.root_cause || ""
    });

    setNcrFormOpen(true);
  };

  const handleSubmitNCR = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const ncrData = {
      job_number: selectedNCR?.job_number || formData.sales_document,
      work_order: formData.order_number,
      operation_number: formData.operation,
      customer_name: selectedNCR?.customer_name || "UNDEFINED",
      part_name: selectedNCR?.part_name || "UNDEFINED",
      equipment_type: formData.work_center,
      issue_description: formData.description,
      root_cause: formData.comments,
      planned_hours: Number(formData.planned_work),
      actual_hours: Number(formData.actual_work),
      status: "Submitted",
      created_at: new Date().toISOString()
    };

    if (selectedNCR) {
      updateNCRMutation.mutate({
        ...ncrData,
        id: selectedNCR.id
      });
    } else {
      createNCRMutation.mutate(ncrData);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name.includes('work') ? Number(value) : value
    }));
  };

  // Open NCR submit form for a pending NCR
  const openNCRSubmitForm = (pendingNCR: PendingNCR) => {
    setSelectedPendingNCR(pendingNCR);
    setNcrFormData(prev => ({
      ...prev,
      ncr_number: `NCR-${Date.now().toString().slice(-4)}`,
      equipment_type: pendingNCR.equipment_type,
      issue_category: "",
      financial_impact: 0,
      issue_description: "",
      root_cause: "",
      corrective_action: "",
      drawing_number: ""
    }));
    setNcrSubmitFormOpen(true);
  };

  // Handle NCR form input changes
  const handleNcrFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setNcrFormData({
      ...ncrFormData,
      [name]: name === 'financial_impact' ? Number(value) : value
    });
  };

  // Handle NCR form submission
  const handleSubmitNcrForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newNCR: Omit<NCR, 'id'> = {
        job_number: selectedPendingNCR?.job_number || "",
        customer_name: selectedPendingNCR?.customer_name || "",
        work_order: selectedPendingNCR?.work_order || "",
        operation_number: selectedPendingNCR?.operation_number || "",
        part_name: selectedPendingNCR?.part_name || "",
        equipment_type: ncrFormData.equipment_type,
        drawing_number: ncrFormData.drawing_number,
        issue_category: ncrFormData.issue_category,
        issue_description: ncrFormData.issue_description,
        root_cause: ncrFormData.root_cause,
        corrective_action: ncrFormData.corrective_action,
        financial_impact: ncrFormData.financial_impact,
        status: NCR_STATUS.SUBMITTED,
        created_at: new Date().toISOString()
      };

      await db.upsertNCRs([newNCR]);
      setNcrSubmitFormOpen(false);
      resetNcrFormData();
      queryClient.invalidateQueries({ queryKey: ['ncrs'] });
    } catch (error) {
      console.error('Error submitting NCR:', error);
    }
  };

  const filteredNCRs = ncrs.filter(ncr => {
    if (!filterQuery) return true;

    const searchLower = filterQuery.toLowerCase();
    return (
      ncr.job_number.toLowerCase().includes(searchLower) ||
      ncr.work_order.toLowerCase().includes(searchLower) ||
      ncr.customer_name.toLowerCase().includes(searchLower) ||
      ncr.equipment_type?.toLowerCase().includes(searchLower) ||
      ncr.issue_description?.toLowerCase().includes(searchLower)
    );
  });

  // Calculate summary metrics for NCR Summary
  const calculateNCRMetrics = () => {
    const totalSubmitted = ncrs.length;
    const totalNCRCost = ncrs.reduce((sum, ncr) => sum + (ncr.financial_impact || 0), 0);

    // Find most affected part
    const partCounts = ncrs.reduce((acc, ncr) => {
      const part = ncr.part_name || '';
      acc[part] = (acc[part] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostAffectedPart = Object.entries(partCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'None';

    // Calculate YTD NCRs (only from current year)
    const currentYear = new Date().getFullYear();
    const ncrYTD = ncrs.filter(ncr =>
      new Date(ncr.created_at || '').getFullYear() === currentYear
    ).length;

    return {
      totalSubmitted,
      totalNCRCost,
      mostAffectedPart,
      ncrYTD
    };
  };

  const ncrMetrics = calculateNCRMetrics();

  if (isLoading) {
    return (
      <DashboardLayout showNav={false}>
        <div className="container mx-auto py-8">
          <LoadingSpinner message="Loading NCR data..." />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout showNav={false}>
        <div className="container mx-auto py-8">
          <div className="text-center">
            <h3 className="mt-4 text-lg font-medium">Error Loading NCRs</h3>
            <p className="mt-2 text-muted-foreground">
              There was an error loading the NCR data. Please try again later.
            </p>
            <Button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['ncrs'] })}
              className="mt-4"
            >
              Retry
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout showNav={false}>
      <div className="container mx-auto py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-1">NCR Tracker</h1>
            <p className="text-muted-foreground">
              Track and manage non-conformance reports
            </p>
          </div>

          <div className="mt-4 md:mt-0 space-x-2">
            <Button variant="secondary" size="sm">
              Import NCRs
            </Button>
            <Button variant="secondary" size="sm">
              Export Reports
            </Button>
          </div>
        </div>

        {/* NCR Summary Statistics */}
        <NCRSummary
          totalSubmitted={ncrMetrics.totalSubmitted}
          totalNCRCost={ncrMetrics.totalNCRCost}
          mostAffectedPart={ncrMetrics.mostAffectedPart}
          ncrYTD={ncrMetrics.ncrYTD}
        />

        {/* Pending NCR Reporting Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Pending NCR Reports</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingNCRData.map((pendingNCR, index) => (
              <Card key={index} className="bg-white">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">Job #{pendingNCR.job_number}</h3>
                      <p className="text-sm text-muted-foreground truncate">{pendingNCR.customer_name}</p>
                    </div>
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300">
                      Pending
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pb-3">
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Work Order</p>
                        <p className="font-medium">{pendingNCR.work_order}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Operation</p>
                        <p className="font-medium">{pendingNCR.operation_number}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Part Name</p>
                      <p className="font-medium">{pendingNCR.part_name}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Planned Hours</p>
                        <p className="font-medium">{pendingNCR.planned_hours}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Actual Hours</p>
                        <p className="font-medium">{pendingNCR.actual_hours}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>

                <CardFooter>
                  <Button
                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => openNCRSubmitForm(pendingNCR)}
                  >
                    Submit NCR Report
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>

        {/* Submitted NCR Records */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">📁 Submitted NCR Records</h2>
          </div>

          <NCRList
            ncrs={filteredNCRs}
            onViewNCR={(ncr) => {
              setSelectedNCR(ncr);
              setNcrFormOpen(true);
            }}
          />
        </div>
      </div>

      {/* Submit NCR Form Dialog */}
      <Dialog
        open={ncrSubmitFormOpen}
        onOpenChange={(open) => {
          setNcrSubmitFormOpen(open);
          if (!open) {
            resetNcrFormData();
          }
        }}
      >
        <DialogContent className="sm:max-w-[650px] p-0">
          <div className="bg-yellow-400 px-6 py-4">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <ClipboardList className="h-6 w-6 text-black" />
                <DialogTitle className="text-xl font-bold text-black">Submit NCR Report</DialogTitle>
              </div>
            </DialogHeader>
          </div>

          <form onSubmit={handleSubmitNcrForm} className="px-6 py-4">
            <div className="space-y-6">
              {/* Job Info Card */}
              {selectedPendingNCR && (
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Job:</p>
                      <p className="text-sm font-semibold">{selectedPendingNCR.job_number}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Work Order:</p>
                      <p className="text-sm font-semibold">{selectedPendingNCR.work_order}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Operation:</p>
                      <p className="text-sm font-semibold">{selectedPendingNCR.operation_number}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-sm font-medium text-gray-600">Customer:</p>
                    <p className="text-sm font-semibold">{selectedPendingNCR.customer_name}</p>
                  </div>
                </div>
              )}

              {/* NCR Form Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Equipment Type</label>
                  <Input
                    placeholder="e.g. Mud Pump, Rotary Table"
                    value={ncrFormData.equipment_type}
                    onChange={(e) => setNcrFormData(prev => ({ ...prev, equipment_type: e.target.value }))}
                    className="bg-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Drawing Number</label>
                  <Input
                    value={ncrFormData.drawing_number}
                    onChange={(e) => setNcrFormData(prev => ({ ...prev, drawing_number: e.target.value }))}
                    className="bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Issue Category</label>
                <Select
                  value={ncrFormData.issue_category}
                  onValueChange={(value) => setNcrFormData(prev => ({ ...prev, issue_category: value }))}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(NCR_CATEGORIES).map(([key, value]) => (
                      <SelectItem key={key} value={key.toLowerCase()}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Issue Description</label>
                <Textarea
                  value={ncrFormData.issue_description}
                  onChange={(e) => setNcrFormData(prev => ({ ...prev, issue_description: e.target.value }))}
                  rows={3}
                  className="bg-white resize-none"
                  placeholder="Describe the non-conformance issue..."
                />
              </div>

              <div>
                <label className="text-sm font-medium">Root Cause</label>
                <Textarea
                  value={ncrFormData.root_cause}
                  onChange={(e) => setNcrFormData(prev => ({ ...prev, root_cause: e.target.value }))}
                  rows={3}
                  className="bg-white resize-none"
                  placeholder="What caused this issue?"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Corrective Action</label>
                <Textarea
                  value={ncrFormData.corrective_action}
                  onChange={(e) => setNcrFormData(prev => ({ ...prev, corrective_action: e.target.value }))}
                  rows={3}
                  className="bg-white resize-none"
                  placeholder="What actions will be taken to resolve this?"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Financial Impact ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={ncrFormData.financial_impact}
                  onChange={(e) => setNcrFormData(prev => ({ ...prev, financial_impact: parseFloat(e.target.value) }))}
                  className="bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Upload NCR Report (PDF)</label>
                  <Input type="file" accept=".pdf" className="bg-white" />
                </div>
                <div>
                  <label className="text-sm font-medium">Upload Drawing (Optional)</label>
                  <Input type="file" accept=".pdf,.dwg,.dxf" className="bg-white" />
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6 gap-2">
              <Button type="button" variant="outline" onClick={() => setNcrSubmitFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white">
                Submit NCR
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}