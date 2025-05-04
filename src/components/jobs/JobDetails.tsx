import React, { useState, useEffect } from "react";
import { Job } from "@/shared/schema";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PaperclipIcon, FileTextIcon, DownloadIcon, XIcon, UserIcon, BellIcon, BarChartIcon, ClockIcon, AlertTriangleIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart as RechartsBarChart } from 'recharts';

// Helper function to determine badge variant based on status
function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
    switch (status.toLowerCase()) {
        case 'completed':
        case 'complete':
            return 'secondary';
        case 'in progress':
        case 'active':
            return 'default';
        case 'delayed':
        case 'blocked':
            return 'destructive';
        case 'ignored':
            return 'outline';
        default:
            return 'outline';
    }
}

// Helper function to determine operation status
function determineOperationStatus(record: any): string {
    const planned = Number(record['Work'] || record['planned_work'] || 0);
    const actual = Number(record['Actual work'] || record['actual_work'] || 0);

    if (actual >= planned) return 'Complete';
    if (actual > 0) return 'In Progress';
    return 'Not Started';
}

interface Operation {
    work_order_number: string;
    part_name: string;
    operation_number: string;
    task_description: string;
    work_center: string;
    planned_hours: number;
    actual_hours: number;
    remaining_work: number;
    status: string;
    start_date?: string;
    scheduled_date?: string;
    completed_date?: string;
    attachments?: Array<{
        name: string;
        url: string;
        type: string;
        id: string;
    }>;
}

interface JobDetailsProps {
    job: Job | null;
}

// Daily updates interface
interface DailyUpdate {
    id: string;
    date: string;
    notes: string;
    user: string;
    progress: number;
    challenges: string;
    action_items: string;
}

// Employee performance data
interface EmployeePerformance {
    employee_id: string;
    employee_name: string;
    hours_logged: number;
    efficiency: number;
    operations_completed: number;
    work_centers: string[];
    parts_worked: string[];
}

// Missing clock-in notification
interface MissingClockIn {
    employee_id: string;
    employee_name: string;
    operation_id: string;
    operation_description: string;
    scheduled_time: string;
    work_center: string;
}

export function JobDetails({ job }: JobDetailsProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [selectedPartForUpload, setSelectedPartForUpload] = useState<string | null>(null);
    const [isAttachmentDialogOpen, setIsAttachmentDialogOpen] = useState(false);
    const [attachments, setAttachments] = useState<Record<string, Array<{ name: string, url: string, type: string, id: string }>>>({});
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // New state variables for added features
    const [dailyUpdates, setDailyUpdates] = useState<DailyUpdate[]>([]);
    const [employeePerformance, setEmployeePerformance] = useState<EmployeePerformance[]>([]);
    const [missingClockIns, setMissingClockIns] = useState<MissingClockIn[]>([]);
    const [newDailyUpdate, setNewDailyUpdate] = useState<Partial<DailyUpdate>>({
        date: new Date().toISOString().split('T')[0],
        notes: '',
        progress: 0,
        challenges: '',
        action_items: ''
    });
    const [isAddingDailyUpdate, setIsAddingDailyUpdate] = useState(false);

    if (!job) {
        return (
            <div className="flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading job details...</p>
                </div>
            </div>
        );
    }

    // Initialize data structures
    const partGroups: { [key: string]: Operation[] } = {};
    const vendorWaiting: Operation[] = [];
    const workCenterStats: { [key: string]: { parts: Set<string>, planned: number, actual: number, remaining: number } } = {};

    // Create default values for fields that might be missing in the job
    const jobData = {
        ...job,
        sap_data: job.sap_data || [],
        vendor_operations: job.vendor_operations || []
    };

    console.log('JobDetails received job:', job);

    // Process operations data
    if (jobData.sap_data && Array.isArray(jobData.sap_data)) {
        console.log('Operations data length:', jobData.sap_data.length);
        jobData.sap_data.forEach((record: any) => {
            // Extract operation info with proper formatting
            const operation: Operation = {
                work_order_number: record['Order'] || record['Sales Document'] || '', // Try Order first, fallback to Sales Document
                part_name: record['Description'] || '',
                operation_number: record['Oper./Act.'] || '',
                task_description: record['Opr. short text'] || '',
                work_center: record['Oper.WorkCenter'] || '',
                planned_hours: Number(record['Work']) || 0,
                actual_hours: Number(record['Actual work']) || 0,
                remaining_work: Math.max(0, (Number(record['Work']) || 0) - (Number(record['Actual work']) || 0)),
                status: determineOperationStatus(record)
            };

            // Group by part name for the parts breakdown
            const partName = operation.part_name;
            if (partName) {
                if (!partGroups[partName]) {
                    partGroups[partName] = [];
                }
                partGroups[partName].push(operation);
            }

            // Group operations by work center and part name
            const workCenter = operation.work_center;
            if (workCenter) {
                if (!workCenterStats[workCenter]) {
                    workCenterStats[workCenter] = {
                        parts: new Set(),
                        planned: 0,
                        actual: 0,
                        remaining: 0
                    };
                }

                const stats = workCenterStats[workCenter];
                if (operation.part_name) {
                    stats.parts.add(operation.part_name);
                }

                stats.planned += operation.planned_hours;
                stats.actual += operation.actual_hours;
                stats.remaining += operation.remaining_work;
            }

            // Check for vendor operations
            const isVendorOperation = operation.work_center === 'SR' ||
                operation.task_description.toLowerCase().includes('vendor') ||
                operation.task_description.toLowerCase().includes('receive');

            if (isVendorOperation) {
                console.log('Adding to vendor waiting:', operation);
                vendorWaiting.push(operation);
            }
        });
    }

    // Classify parts
    const completedParts: [string, Operation[]][] = [];
    const inProgressParts: [string, Operation[]][] = [];
    const pendingParts: [string, Operation[]][] = [];

    console.log('Classifying parts from part groups:', Object.keys(partGroups));
    Object.entries(partGroups).forEach(([part, operations]) => {
        if (!part || part === 'undefined' || part === '') {
            console.log('Skipping empty part name with operations:', operations);
            return;
        }

        console.log(`Processing part: ${part} with ${operations.length} operations`);
        const sorted = [...operations].sort((a, b) => {
            const aNum = Number(a.operation_number) || 0;
            const bNum = Number(b.operation_number) || 0;
            return aNum - bNum;
        });

        const completedCount = operations.filter(op => op.status === 'Complete').length;
        const totalCount = operations.length;

        console.log(`Part ${part}: ${completedCount}/${totalCount} operations completed`);

        if (completedCount === totalCount && totalCount > 0) {
            console.log(`Adding ${part} to completed parts`);
            completedParts.push([part, sorted]);
        } else if (completedCount > 0) {
            console.log(`Adding ${part} to in-progress parts`);
            inProgressParts.push([part, sorted]);
        } else {
            console.log(`Adding ${part} to pending parts`);
            pendingParts.push([part, sorted]);
        }
    });

    // Calculate total stats
    const totalStats = {
        planned: Object.values(workCenterStats).reduce((sum, stats) => sum + stats.planned, 0),
        actual: Object.values(workCenterStats).reduce((sum, stats) => sum + stats.actual, 0),
        remaining: Object.values(workCenterStats).reduce((sum, stats) => sum + stats.remaining, 0)
    };

    const completionPercentage = totalStats.planned > 0
        ? Math.min(Math.round((totalStats.actual / totalStats.planned) * 100), 100)
        : 0;

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, partName: string) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        setUploadProgress(0);

        try {
            const file = files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${job?.job_number}_${partName.replace(/\s+/g, '_')}_${Date.now()}.${fileExt}`;
            const filePath = `job-attachments/${fileName}`;

            // Create the storage bucket if it doesn't exist (will be ignored if it exists)
            const { error: bucketError } = await supabase.storage.createBucket('job-documents', {
                public: true,
                fileSizeLimit: 10485760, // 10MB
            });

            if (bucketError && !bucketError.message.includes('already exists')) {
                console.warn('Error creating bucket:', bucketError);
                // Continue anyway, bucket might exist already
            }

            // Upload file to storage
            const { data, error } = await supabase.storage
                .from('job-documents')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: file.type
                });

            if (error) throw error;

            // Get public URL for the file
            const { data: urlData } = supabase.storage
                .from('job-documents')
                .getPublicUrl(filePath);

            // Try to save attachment metadata to database, but don't fail if table doesn't exist
            let attachmentId = `temp-${Date.now()}`;
            try {
                const { data: attachmentData, error: attachmentError } = await supabase
                    .from('job_attachments')
                    .insert([
                        {
                            job_number: job?.job_number,
                            part_name: partName,
                            file_name: file.name,
                            file_type: file.type,
                            file_size: file.size,
                            file_path: filePath,
                            file_url: urlData.publicUrl
                        }
                    ])
                    .select();

                if (attachmentError) {
                    console.warn('Error inserting into job_attachments table:', attachmentError);
                    // Continue with temporary ID if table doesn't exist
                } else if (attachmentData && attachmentData.length > 0) {
                    attachmentId = attachmentData[0].id;
                }
            } catch (dbError) {
                console.warn('Error with database operation:', dbError);
                // Continue with temporary ID if table doesn't exist
            }

            // Update local state with new attachment
            setAttachments(prev => {
                const newAttachments = { ...prev };
                if (!newAttachments[partName]) {
                    newAttachments[partName] = [];
                }

                newAttachments[partName].push({
                    name: file.name,
                    url: urlData.publicUrl,
                    type: file.type,
                    id: attachmentId
                });

                return newAttachments;
            });

            toast({
                title: "File uploaded successfully",
                description: `${file.name} has been attached to ${partName}`,
            });

        } catch (error) {
            console.error('Error uploading file:', error);
            toast({
                title: "Upload failed",
                description: error instanceof Error ? error.message : "Failed to upload file",
                variant: "destructive",
            });
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
            setIsAttachmentDialogOpen(false);
            // Reset the file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleDeleteAttachment = async (partName: string, attachmentId: string) => {
        try {
            let filePath: string | null = null;

            // First try to get the attachment details from the database if the ID is not temporary
            if (!attachmentId.startsWith('temp-')) {
                try {
                    const { data: attachmentData, error: fetchError } = await supabase
                        .from('job_attachments')
                        .select('*')
                        .eq('id', attachmentId)
                        .single();

                    if (fetchError) {
                        console.warn('Error fetching attachment:', fetchError);
                    } else if (attachmentData) {
                        filePath = attachmentData.file_path;
                    }
                } catch (dbError) {
                    console.warn('Database error when fetching attachment:', dbError);
                    // Continue with just local state update if necessary
                }
            }

            // If we have a file path from the database, delete the file from storage
            if (filePath) {
                try {
                    const { error: storageError } = await supabase.storage
                        .from('job-documents')
                        .remove([filePath]);

                    if (storageError) {
                        console.warn('Error removing file from storage:', storageError);
                    }
                } catch (storageError) {
                    console.warn('Error with storage operation:', storageError);
                }

                // Try to delete the metadata from the database
                try {
                    const { error: deleteError } = await supabase
                        .from('job_attachments')
                        .delete()
                        .eq('id', attachmentId);

                    if (deleteError) {
                        console.warn('Error deleting from job_attachments table:', deleteError);
                    }
                } catch (dbError) {
                    console.warn('Database error when deleting attachment:', dbError);
                }
            } else {
                // If we don't have a file path (temporary ID), just delete the entry from local state
                console.log('No file path found in database, only updating local state');
            }

            // Always update local state
            setAttachments(prev => {
                const newAttachments = { ...prev };
                if (newAttachments[partName]) {
                    newAttachments[partName] = newAttachments[partName].filter(
                        attachment => attachment.id !== attachmentId
                    );
                }
                return newAttachments;
            });

            toast({
                title: "Attachment deleted",
                description: "The file has been removed successfully",
            });

        } catch (error) {
            console.error('Error deleting attachment:', error);
            toast({
                title: "Deletion failed",
                description: error instanceof Error ? error.message : "Failed to delete attachment",
                variant: "destructive",
            });
        }
    };

    // Load attachments for all parts when the component mounts
    React.useEffect(() => {
        const fetchAttachments = async () => {
            if (!job?.job_number) return;

            try {
                const { data, error } = await supabase
                    .from('job_attachments')
                    .select('*')
                    .eq('job_number', job.job_number);

                if (error) {
                    if (error.code === '42P01') { // Table doesn't exist
                        console.warn('job_attachments table does not exist yet:', error.message);
                        return; // Just use empty attachments
                    }
                    throw error;
                }

                // Group attachments by part name
                const attachmentsByPart: Record<string, Array<{ name: string, url: string, type: string, id: string }>> = {};

                data.forEach(attachment => {
                    if (!attachmentsByPart[attachment.part_name]) {
                        attachmentsByPart[attachment.part_name] = [];
                    }

                    attachmentsByPart[attachment.part_name].push({
                        name: attachment.file_name,
                        url: attachment.file_url,
                        type: attachment.file_type,
                        id: attachment.id
                    });
                });

                setAttachments(attachmentsByPart);

            } catch (error) {
                console.error('Error fetching attachments:', error);
                // Don't show toast for this error as it's not critical
            }
        };

        fetchAttachments();
    }, [job?.job_number]);

    // Fetch daily updates, employee performance data, and missing clock-ins
    useEffect(() => {
        const fetchJobData = async () => {
            if (!job?.job_number) return;

            // Mock data for now - would be replaced with actual API calls
            // Daily updates
            const mockDailyUpdates: DailyUpdate[] = [
                {
                    id: '1',
                    date: '2023-06-15',
                    notes: 'Successfully completed the initial machining of the main rotor component.',
                    user: 'John Smith',
                    progress: 25,
                    challenges: 'Material hardness inconsistency requiring additional tooling adjustments.',
                    action_items: 'Order specialized carbide inserts for the next phase.'
                },
                {
                    id: '2',
                    date: '2023-06-16',
                    notes: 'Completed quality inspection of phase 1. Moving to heat treatment.',
                    user: 'Sarah Johnson',
                    progress: 40,
                    challenges: 'Slight deviation in one dimension, but within tolerance.',
                    action_items: 'Monitor thermal expansion during heat treatment closely.'
                },
                {
                    id: '3',
                    date: '2023-06-17',
                    notes: 'Heat treatment completed. Waiting for cooling period before final machining.',
                    user: 'Mike Wilson',
                    progress: 65,
                    challenges: 'None reported today.',
                    action_items: 'Prepare finishing tools for next operation.'
                }
            ];

            // Employee performance data
            const mockEmployeePerformance: EmployeePerformance[] = [
                {
                    employee_id: 'EMP001',
                    employee_name: 'John Smith',
                    hours_logged: 24.5,
                    efficiency: 95,
                    operations_completed: 3,
                    work_centers: ['Milling', 'Quality Control'],
                    parts_worked: ['Main Rotor', 'Shaft']
                },
                {
                    employee_id: 'EMP002',
                    employee_name: 'Sarah Johnson',
                    hours_logged: 18.2,
                    efficiency: 88,
                    operations_completed: 2,
                    work_centers: ['Assembly', 'Quality Control'],
                    parts_worked: ['Housing', 'Main Rotor']
                },
                {
                    employee_id: 'EMP003',
                    employee_name: 'Mike Wilson',
                    hours_logged: 32.0,
                    efficiency: 105,
                    operations_completed: 4,
                    work_centers: ['Heat Treatment', 'Grinding'],
                    parts_worked: ['Main Rotor', 'Coupling', 'Bearing']
                }
            ];

            // Missing clock-ins
            const mockMissingClockIns: MissingClockIn[] = [
                {
                    employee_id: 'EMP001',
                    employee_name: 'John Smith',
                    operation_id: 'OP0045',
                    operation_description: 'Final inspection',
                    scheduled_time: '2023-06-17T14:00:00',
                    work_center: 'Quality Control'
                },
                {
                    employee_id: 'EMP004',
                    employee_name: 'Lisa Chen',
                    operation_id: 'OP0046',
                    operation_description: 'Surface finishing',
                    scheduled_time: '2023-06-17T10:30:00',
                    work_center: 'Grinding'
                }
            ];

            setDailyUpdates(mockDailyUpdates);
            setEmployeePerformance(mockEmployeePerformance);
            setMissingClockIns(mockMissingClockIns);
        };

        fetchJobData();
    }, [job?.job_number]);

    // Handle adding a new daily update
    const handleAddDailyUpdate = () => {
        if (!newDailyUpdate.notes || newDailyUpdate.notes.trim() === '') {
            toast({
                title: "Notes required",
                description: "Please provide notes for the daily update",
                variant: "destructive",
            });
            return;
        }

        // In a real implementation, this would send data to the server
        const update: DailyUpdate = {
            id: `temp-${Date.now()}`,
            date: newDailyUpdate.date || new Date().toISOString().split('T')[0],
            notes: newDailyUpdate.notes || '',
            user: 'Current User', // This would come from auth context in a real app
            progress: newDailyUpdate.progress || 0,
            challenges: newDailyUpdate.challenges || 'None reported',
            action_items: newDailyUpdate.action_items || 'None'
        };

        setDailyUpdates(prev => [update, ...prev]);
        setNewDailyUpdate({
            date: new Date().toISOString().split('T')[0],
            notes: '',
            progress: 0,
            challenges: '',
            action_items: ''
        });
        setIsAddingDailyUpdate(false);

        toast({
            title: "Update added",
            description: "Your daily update has been recorded",
        });
    };

    // Handle notification for missing clock-ins
    const handleNotifyEmployee = (employeeId: string) => {
        // In a real app, this would send a notification to the employee
        toast({
            title: "Notification sent",
            description: `Reminder sent to employee #${employeeId}`,
        });

        // Remove from the list
        setMissingClockIns(prev => prev.filter(item => item.employee_id !== employeeId));
    };

    // Render attachment file icon based on type
    const renderFileIcon = (fileType: string) => {
        if (fileType.includes('pdf')) {
            return <FileTextIcon className="h-4 w-4 text-red-500" />;
        } else if (fileType.includes('word') || fileType.includes('document')) {
            return <FileTextIcon className="h-4 w-4 text-blue-500" />;
        } else {
            return <PaperclipIcon className="h-4 w-4 text-gray-500" />;
        }
    };

    // Render attachments for a specific part
    const renderAttachments = (partName: string) => {
        const partAttachments = attachments[partName] || [];

        if (partAttachments.length === 0) {
            return null;
        }

        return (
            <div className="mt-2 space-y-1">
                <p className="text-xs font-medium text-gray-500">Attachments:</p>
                <div className="space-y-1">
                    {partAttachments.map((attachment, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 rounded p-1 text-xs">
                            <div className="flex items-center space-x-1">
                                {renderFileIcon(attachment.type)}
                                <span className="truncate max-w-[150px]">{attachment.name}</span>
                            </div>
                            <div className="flex space-x-1">
                                <a
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:text-blue-700"
                                >
                                    <DownloadIcon className="h-4 w-4" />
                                </a>
                                <button
                                    onClick={() => handleDeleteAttachment(partName, attachment.id)}
                                    className="text-red-500 hover:text-red-700"
                                >
                                    <XIcon className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Modified parts section to include file attachments
    const renderPartCard = (partName: string, operations: Operation[], isCompleted = false) => {
        return (
            <Card className={`mb-4 overflow-hidden ${isCompleted ? 'border-green-200' : 'border-blue-200'}`}>
                <CardHeader className={`${isCompleted ? 'bg-green-50' : 'bg-blue-50'} py-2 px-4`}>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-base font-medium flex items-center">
                            <span className="text-gray-600 mr-2">↘</span>
                            <span>{partName}</span>
                            <span className="text-gray-500 ml-2 text-sm">
                                – {operations.filter(op => op.status === 'Complete').length}/{operations.length} complete
                            </span>
                        </CardTitle>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1"
                            onClick={() => {
                                setSelectedPartForUpload(partName);
                                setIsAttachmentDialogOpen(true);
                            }}
                        >
                            <PaperclipIcon className="h-4 w-4" />
                            <span>Attach</span>
                        </Button>
                    </div>
                    {renderAttachments(partName)}
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-800 text-white">
                                <TableHead className="py-2">Op #</TableHead>
                                <TableHead className="py-2">WO</TableHead>
                                <TableHead className="py-2">Task</TableHead>
                                <TableHead className="py-2">WC</TableHead>
                                <TableHead className="py-2">Planned</TableHead>
                                <TableHead className="py-2">Actual</TableHead>
                                <TableHead className="py-2">Remaining</TableHead>
                                <TableHead className="py-2">Status</TableHead>
                                <TableHead className="py-2">Start</TableHead>
                                <TableHead className="py-2">Scheduled</TableHead>
                                <TableHead className="py-2">Completed</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {operations.map((op, opIndex) => (
                                <TableRow key={opIndex} className={isCompleted || op.status === 'Complete' ? 'bg-green-50' : ''}>
                                    <TableCell className="py-2">{op.operation_number}</TableCell>
                                    <TableCell className="py-2">{op.work_order_number}</TableCell>
                                    <TableCell className="py-2">{op.task_description}</TableCell>
                                    <TableCell className="py-2">{op.work_center}</TableCell>
                                    <TableCell className="py-2">{op.planned_hours.toFixed(1)}</TableCell>
                                    <TableCell className="py-2">{op.actual_hours.toFixed(1)}</TableCell>
                                    <TableCell className="py-2">{op.remaining_work.toFixed(1)}</TableCell>
                                    <TableCell className="py-2">
                                        <Badge variant={getStatusVariant(op.status)}>{op.status}</Badge>
                                    </TableCell>
                                    <TableCell className="py-2">{op.start_date || '--'}</TableCell>
                                    <TableCell className="py-2">{op.scheduled_date || '--'}</TableCell>
                                    <TableCell className="py-2">{op.completed_date || '--'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        );
    };

    // In Progress / Pending Parts - Updated with attachments
    const renderInProgressParts = () => {
        const [expandedParts, setExpandedParts] = useState<Record<string, boolean>>({});

        const togglePart = (partName: string) => {
            setExpandedParts(prev => ({
                ...prev,
                [partName]: !prev[partName]
            }));
        };

        return (
            <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                    <span role="img" aria-label="gear" className="text-2xl">⚙️</span>
                    <span className="text-xl font-semibold">In Progress / Pending Parts</span>
                </div>
                {
                    inProgressParts.length > 0 ? (
                        inProgressParts.map(([partName, operations], index) => {
                            const isExpanded = expandedParts[partName] || false;

                            return (
                                <Card key={index} className="mb-4 overflow-hidden border-blue-200">
                                    <CardHeader
                                        className="bg-blue-50 py-2 px-4 cursor-pointer"
                                        onClick={() => togglePart(partName)}
                                    >
                                        <div className="flex justify-between items-center">
                                            <CardTitle className="text-base font-medium flex items-center">
                                                <span className={`text-gray-600 mr-2 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                                                    ↘
                                                </span>
                                                <span>{partName}</span>
                                                <span className="text-gray-500 ml-2 text-sm">
                                                    – {operations.filter(op => op.status === 'Complete').length}/{operations.length} complete
                                                </span>
                                            </CardTitle>
                                            <div className="flex items-center">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 gap-1 mr-2"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedPartForUpload(partName);
                                                        setIsAttachmentDialogOpen(true);
                                                    }}
                                                >
                                                    <PaperclipIcon className="h-4 w-4" />
                                                    <span>Attach</span>
                                                </Button>
                                                <span className="text-sm text-gray-500">
                                                    {isExpanded ? 'Click to collapse' : 'Click to view'}
                                                </span>
                                            </div>
                                        </div>
                                        {renderAttachments(partName)}
                                    </CardHeader>
                                    {isExpanded && (
                                        <CardContent className="p-0">
                                            <div className="overflow-x-auto">
                                                <div className="min-w-[1100px]">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="bg-gray-800 text-white">
                                                                <TableHead className="py-2">Op #</TableHead>
                                                                <TableHead className="py-2">WO</TableHead>
                                                                <TableHead className="py-2">Task</TableHead>
                                                                <TableHead className="py-2">WC</TableHead>
                                                                <TableHead className="py-2">Planned</TableHead>
                                                                <TableHead className="py-2">Actual</TableHead>
                                                                <TableHead className="py-2">Remaining</TableHead>
                                                                <TableHead className="py-2">Status</TableHead>
                                                                <TableHead className="py-2">Start</TableHead>
                                                                <TableHead className="py-2">Scheduled</TableHead>
                                                                <TableHead className="py-2">Completed</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {operations.map((op, opIndex) => (
                                                                <TableRow key={opIndex} className="bg-gray-800">
                                                                    <TableCell className="py-2">{op.operation_number}</TableCell>
                                                                    <TableCell className="py-2">{op.work_order_number}</TableCell>
                                                                    <TableCell className="py-2">{op.task_description}</TableCell>
                                                                    <TableCell className="py-2">{op.work_center}</TableCell>
                                                                    <TableCell className="py-2">{op.planned_hours.toFixed(1)}</TableCell>
                                                                    <TableCell className="py-2">{op.actual_hours.toFixed(1)}</TableCell>
                                                                    <TableCell className="py-2">{op.remaining_work.toFixed(1)}</TableCell>
                                                                    <TableCell className="py-2">
                                                                        <Badge variant={getStatusVariant(op.status)}>{op.status}</Badge>
                                                                    </TableCell>
                                                                    <TableCell className="py-2">{op.start_date || '--'}</TableCell>
                                                                    <TableCell className="py-2">{op.scheduled_date || '--'}</TableCell>
                                                                    <TableCell className="py-2">{op.completed_date || '--'}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        </CardContent>
                                    )}
                                </Card>
                            );
                        })
                    ) : (
                        <div className="text-gray-500 bg-gray-50 p-4 rounded text-center">
                            No in-progress parts
                        </div>
                    )
                }
            </div>
        );
    };

    // Completed Parts - Updated with attachments
    const renderCompletedParts = () => (
        <div className="mt-8">
            <div className="flex items-center gap-2 mb-4">
                <span role="img" aria-label="checkmark" className="text-2xl">✅</span>
                <span className="text-xl font-semibold">Completed Parts</span>
            </div>
            {
                completedParts.length > 0 ? (
                    completedParts.map(([partName, operations], index) => (
                        renderPartCard(partName, operations, true)
                    ))
                ) : (
                    <div className="text-gray-500 bg-gray-50 p-4 rounded text-center">
                        No completed parts
                    </div>
                )
            }
        </div>
    );

    // Render Daily Updates section
    const renderDailyUpdates = () => (
        <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <span role="img" aria-label="calendar" className="text-2xl">📆</span>
                    <span className="text-xl font-semibold">Daily Updates</span>
                </div>
                <Button
                    variant="outline"
                    onClick={() => setIsAddingDailyUpdate(true)}
                >
                    Add Update
                </Button>
            </div>

            {dailyUpdates.length > 0 ? (
                <div className="space-y-4">
                    {dailyUpdates.map((update) => (
                        <Card key={update.id} className="overflow-hidden">
                            <CardHeader className="bg-blue-50 py-2 px-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <CardTitle className="text-base font-medium">{new Date(update.date).toLocaleDateString()}</CardTitle>
                                        <p className="text-sm text-gray-500">By {update.user}</p>
                                    </div>
                                    <Badge variant="outline">{update.progress}% Complete</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4">
                                <div className="space-y-3">
                                    <div>
                                        <h4 className="text-sm font-semibold">Progress Notes:</h4>
                                        <p className="text-sm">{update.notes}</p>
                                    </div>

                                    {update.challenges && (
                                        <div>
                                            <h4 className="text-sm font-semibold">Challenges:</h4>
                                            <p className="text-sm">{update.challenges}</p>
                                        </div>
                                    )}

                                    {update.action_items && (
                                        <div>
                                            <h4 className="text-sm font-semibold">Action Items:</h4>
                                            <p className="text-sm">{update.action_items}</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="text-gray-500 bg-gray-50 p-4 rounded text-center">
                    No updates available
                </div>
            )}

            {/* Add Daily Update Dialog */}
            <Dialog open={isAddingDailyUpdate} onOpenChange={setIsAddingDailyUpdate}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Daily Update</DialogTitle>
                        <DialogDescription>
                            Record today's progress on job #{job?.job_number}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div>
                            <label className="text-sm font-medium">Date</label>
                            <input
                                type="date"
                                className="w-full border rounded p-2 mt-1"
                                value={newDailyUpdate.date}
                                onChange={(e) => setNewDailyUpdate(prev => ({ ...prev, date: e.target.value }))}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Progress (%)</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                className="w-full border rounded p-2 mt-1"
                                value={newDailyUpdate.progress}
                                onChange={(e) => setNewDailyUpdate(prev => ({ ...prev, progress: Number(e.target.value) }))}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Notes*</label>
                            <textarea
                                className="w-full border rounded p-2 mt-1"
                                rows={3}
                                value={newDailyUpdate.notes}
                                onChange={(e) => setNewDailyUpdate(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="Describe the work completed today"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Challenges</label>
                            <textarea
                                className="w-full border rounded p-2 mt-1"
                                rows={2}
                                value={newDailyUpdate.challenges}
                                onChange={(e) => setNewDailyUpdate(prev => ({ ...prev, challenges: e.target.value }))}
                                placeholder="Any issues or challenges faced"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Action Items</label>
                            <textarea
                                className="w-full border rounded p-2 mt-1"
                                rows={2}
                                value={newDailyUpdate.action_items}
                                onChange={(e) => setNewDailyUpdate(prev => ({ ...prev, action_items: e.target.value }))}
                                placeholder="Next steps or items needing attention"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsAddingDailyUpdate(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddDailyUpdate}
                        >
                            Save Update
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );

    // Render Employee Performance section
    const renderEmployeePerformance = () => {
        // Prepare data for the chart
        const chartData = employeePerformance.map(emp => ({
            name: emp.employee_name,
            efficiency: emp.efficiency,
            hours: emp.hours_logged,
            operations: emp.operations_completed
        }));

        return (
            <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                    <UserIcon className="h-6 w-6 text-blue-500" />
                    <span className="text-xl font-semibold">Employee Performance Analysis</span>
                </div>

                <Tabs defaultValue="table">
                    <TabsList className="mb-4">
                        <TabsTrigger value="table">Table View</TabsTrigger>
                        <TabsTrigger value="chart">Chart View</TabsTrigger>
                    </TabsList>

                    <TabsContent value="table">
                        <div className="overflow-x-auto rounded">
                            <div className="min-w-[900px]">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-[#1e2832] text-white">
                                            <th className="p-3 text-left">Employee</th>
                                            <th className="p-3 text-left">Hours Logged</th>
                                            <th className="p-3 text-left">Efficiency (%)</th>
                                            <th className="p-3 text-left">Operations Completed</th>
                                            <th className="p-3 text-left">Work Centers</th>
                                            <th className="p-3 text-left">Parts Worked</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {employeePerformance.map((emp) => (
                                            <tr key={emp.employee_id} className="border-b hover:bg-gray-50">
                                                <td className="p-3 font-semibold">{emp.employee_name}</td>
                                                <td className="p-3">{emp.hours_logged.toFixed(1)}</td>
                                                <td className="p-3">
                                                    <Badge variant={emp.efficiency >= 100 ? 'secondary' : emp.efficiency >= 85 ? 'default' : 'destructive'}>
                                                        {emp.efficiency}%
                                                    </Badge>
                                                </td>
                                                <td className="p-3">{emp.operations_completed}</td>
                                                <td className="p-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {emp.work_centers.map((wc, i) => (
                                                            <span key={i} className="bg-gray-200 text-gray-800 px-2 py-1 rounded text-xs">
                                                                {wc}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {emp.parts_worked.map((part, i) => (
                                                            <span key={i} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                                                {part}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="chart">
                        <div className="bg-white p-4 rounded-lg border">
                            <h3 className="text-lg font-medium mb-4">Employee Efficiency & Hours</h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RechartsBarChart
                                        data={chartData}
                                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                                        <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                                        <Tooltip />
                                        <Legend />
                                        <Bar yAxisId="left" dataKey="hours" fill="#8884d8" name="Hours Logged" />
                                        <Bar yAxisId="right" dataKey="efficiency" fill="#82ca9d" name="Efficiency %" />
                                    </RechartsBarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        );
    };

    // Render Missing Clock-ins Notifications
    const renderMissingClockIns = () => (
        <div className="mt-8">
            <div className="flex items-center gap-2 mb-4">
                <BellIcon className="h-6 w-6 text-red-500" />
                <span className="text-xl font-semibold">Missing Clock-ins</span>
                {missingClockIns.length > 0 && (
                    <Badge variant="destructive" className="ml-2">{missingClockIns.length}</Badge>
                )}
            </div>

            {missingClockIns.length > 0 ? (
                <div className="space-y-3">
                    {missingClockIns.map((item) => (
                        <Card key={`${item.employee_id}-${item.operation_id}`} className="border-red-200 bg-red-50">
                            <CardContent className="p-4">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangleIcon className="h-4 w-4 text-red-500" />
                                            <h4 className="font-medium">{item.employee_name}</h4>
                                        </div>
                                        <p className="text-sm">
                                            Missed clock-in for operation: <span className="font-medium">{item.operation_description}</span>
                                        </p>
                                        <p className="text-sm">
                                            Scheduled: <span className="font-medium">
                                                {new Date(item.scheduled_time).toLocaleString()}
                                            </span>
                                        </p>
                                        <p className="text-sm">
                                            Work Center: <span className="font-medium">{item.work_center}</span>
                                        </p>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-red-500 text-red-500 hover:bg-red-100"
                                        onClick={() => handleNotifyEmployee(item.employee_id)}
                                    >
                                        <BellIcon className="h-4 w-4 mr-1" />
                                        Notify
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="text-gray-500 bg-gray-50 p-4 rounded text-center">
                    No missing clock-ins detected
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-6 px-4 pt-0 pb-6">
            {/* Job Intelligence Section */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <span role="img" aria-label="brain" className="text-2xl">🧠</span>
                    <h2 className="text-2xl font-semibold text-primary">Job Intelligence – #{job.job_number}</h2>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-6">
                    <div className="text-base"><strong>Customer:</strong> {job.customer}</div>
                    <div className="text-base"><strong>Reference:</strong> {jobData.reference_name || "P66 Afton Rotor"}</div>
                    <div className="text-base">
                        <strong>Status:</strong>{" "}
                        <Badge className="ml-1 font-medium" variant={getStatusVariant(job.status)}>
                            {job.status}
                        </Badge>
                    </div>
                    <div className="text-base"><strong>Due Date:</strong> {new Date(job.due_date).toLocaleDateString()}</div>
                    <div className="text-base"><strong>Completion:</strong> {`${completionPercentage}%`}</div>
                    <div className="text-base"><strong>Total Remaining Hrs:</strong> {totalStats.remaining.toFixed(1)}</div>
                </div>
            </div>

            {/* Missing Clock-ins Alert - Show at the top if there are issues */}
            {missingClockIns.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start gap-3">
                    <div className="bg-red-100 p-2 rounded-full">
                        <AlertTriangleIcon className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                        <h3 className="font-medium text-red-800">Missing Clock-ins Detected</h3>
                        <p className="text-sm text-red-700 mt-1">
                            {missingClockIns.length} employee{missingClockIns.length > 1 ? 's' : ''} have not clocked in for scheduled operations.
                        </p>
                        <Button
                            variant="link"
                            className="text-red-700 p-0 h-auto mt-1"
                            onClick={() => document.getElementById('missing-clockins-section')?.scrollIntoView({ behavior: 'smooth' })}
                        >
                            View details
                        </Button>
                    </div>
                </div>
            )}

            <hr className="border-gray-200" />

            {/* Orders Section - Based on the first screenshot */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <span role="img" aria-label="clipboard" className="text-2xl">📋</span>
                    <span className="text-xl font-semibold">Orders</span>
                </div>
                <div className="overflow-x-auto rounded border border-yellow-100">
                    <div className="bg-yellow-50 min-w-[900px]">
                        <table className="w-full">
                            <thead>
                                <tr>
                                    <th className="p-3 text-left font-semibold">Order</th>
                                    <th className="p-3 text-left font-semibold">Oper./Act.</th>
                                    <th className="p-3 text-left font-semibold">Oper.WorkCenter</th>
                                    <th className="p-3 text-left font-semibold">Description</th>
                                    <th className="p-3 text-left font-semibold">Opr. short text</th>
                                    <th className="p-3 text-left font-semibold">Work</th>
                                    <th className="p-3 text-left font-semibold">Actual work</th>
                                    <th className="p-3 text-left font-semibold">Remaining</th>
                                </tr>
                            </thead>
                            <tbody>
                                {
                                    jobData.sap_data && jobData.sap_data.length > 0 ? (
                                        jobData.sap_data.map((record, index) => (
                                            <tr key={index} className="border-b">
                                                <td className="p-2">{record['Order'] || job.job_number || ''}</td>
                                                <td className="p-2">{record['Oper./Act.'] || ''}</td>
                                                <td className="p-2">{record['Oper.WorkCenter'] || ''}</td>
                                                <td className="p-2">{record['Description'] || ''}</td>
                                                <td className="p-2">{record['Opr. short text'] || ''}</td>
                                                <td className="p-2">{Number(record['Work']).toFixed(2) || '0.00'}</td>
                                                <td className="p-2">{Number(record['Actual work']).toFixed(2) || '0.00'}</td>
                                                <td className="p-2 text-green-600">
                                                    {(Math.max(0, (Number(record['Work'] || 0) - Number(record['Actual work'] || 0)))).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={8} className="p-4 text-center text-gray-500">
                                                No order data available
                                            </td>
                                        </tr>
                                    )
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Daily Updates Section - New */}
            {renderDailyUpdates()}

            {/* Employee Performance Analysis - New */}
            {renderEmployeePerformance()}

            {/* Missing Clock-ins Section - New */}
            <div id="missing-clockins-section">
                {renderMissingClockIns()}
            </div>

            {/* Waiting on Vendor Section - Based on the second screenshot */}
            <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                    <span role="img" aria-label="truck" className="text-2xl">🚚</span>
                    <span className="text-xl font-semibold">Waiting on Vendor</span>
                </div>
                <div className="overflow-x-auto rounded">
                    <div className="bg-gray-50 min-w-[900px]">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200">
                                    <th className="p-3 text-left font-semibold">Work Order</th>
                                    <th className="p-3 text-left font-semibold">Part</th>
                                    <th className="p-3 text-left font-semibold">Operation</th>
                                    <th className="p-3 text-left font-semibold">Task</th>
                                    <th className="p-3 text-left font-semibold">Work Center</th>
                                    <th className="p-3 text-left font-semibold">Planned Hours</th>
                                    <th className="p-3 text-left font-semibold">Actual Hours</th>
                                    <th className="p-3 text-left font-semibold">Remaining Hours</th>
                                </tr>
                            </thead>
                            <tbody>
                                {
                                    vendorWaiting.length > 0 ? (
                                        vendorWaiting.map((op, index) => (
                                            <tr key={index} className="border-b border-gray-200">
                                                <td className="p-2">{op.work_order_number || '--'}</td>
                                                <td className="p-2">{op.part_name || '--'}</td>
                                                <td className="p-2">{op.operation_number || '--'}</td>
                                                <td className="p-2">{op.task_description || '--'}</td>
                                                <td className="p-2">{op.work_center || '--'}</td>
                                                <td className="p-2">{op.planned_hours.toFixed(1)}</td>
                                                <td className="p-2">{op.actual_hours.toFixed(1)}</td>
                                                <td className="p-2">{op.remaining_work.toFixed(1)}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={8} className="p-4 text-center text-gray-500">
                                                No vendor operations pending
                                            </td>
                                        </tr>
                                    )
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Work Center Involvement - Based on the first screenshot */}
            <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                    <span role="img" aria-label="factory" className="text-2xl">🏭</span>
                    <span className="text-xl font-semibold">Work Center Involvement</span>
                </div>
                <div className="overflow-x-auto rounded">
                    <div className="min-w-[900px]">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-[#1e2832] text-white">
                                    <th className="p-3 text-left">Work Center</th>
                                    <th className="p-3 text-left">Parts Involved</th>
                                    <th className="p-3 text-left">Planned (hrs)</th>
                                    <th className="p-3 text-left">Actual (hrs)</th>
                                    <th className="p-3 text-left">Remaining (hrs)</th>
                                    <th className="p-3 text-left">Progress</th>
                                </tr>
                            </thead>
                            <tbody>
                                {
                                    Object.entries(workCenterStats)
                                        .filter(([wc]) => wc !== '')
                                        .map(([workCenter, stats]) => {
                                            const percentComplete = stats.planned > 0
                                                ? Math.min((stats.actual / stats.planned) * 100, 100)
                                                : 0;

                                            return (
                                                <tr key={workCenter} className="border-b hover:bg-gray-50">
                                                    <td className="p-3 font-semibold">{workCenter}</td>
                                                    <td className="p-3">
                                                        <span className="bg-gray-200 text-gray-800 px-2 py-1 rounded text-xs">
                                                            {stats.parts.size} part{stats.parts.size !== 1 ? 's' : ''}
                                                        </span>
                                                    </td>
                                                    <td className="p-3">{stats.planned.toFixed(1)}</td>
                                                    <td className="p-3">{stats.actual.toFixed(1)}</td>
                                                    <td className="p-3">{stats.remaining.toFixed(1)}</td>
                                                    <td className="p-3">
                                                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                                                            <div
                                                                className="bg-blue-600 h-2.5 rounded-full"
                                                                style={{ width: `${percentComplete}%` }}
                                                            ></div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* In Progress / Pending Parts */}
            {renderInProgressParts()}

            {/* Completed Parts */}
            {renderCompletedParts()}

            {/* File Attachment Dialog */}
            <Dialog open={isAttachmentDialogOpen} onOpenChange={setIsAttachmentDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Attach Document</DialogTitle>
                        <DialogDescription>
                            Upload a PDF or Word document for {selectedPartForUpload}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="flex items-center justify-center w-full">
                            <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <PaperclipIcon className="w-8 h-8 mb-3 text-gray-400" />
                                    <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                    <p className="text-xs text-gray-500">PDF or Word document (MAX. 10MB)</p>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    id="dropzone-file"
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                    onChange={(e) => selectedPartForUpload && handleFileUpload(e, selectedPartForUpload)}
                                />
                            </label>
                        </div>

                        {isUploading && (
                            <div className="w-full">
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div
                                        className="bg-blue-600 h-2.5 rounded-full"
                                        style={{ width: `${uploadProgress}%` }}
                                    ></div>
                                </div>
                                <p className="text-xs text-center mt-1">Uploading... {uploadProgress}%</p>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsAttachmentDialogOpen(false)}
                            disabled={isUploading}
                        >
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}