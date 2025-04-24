import React from "react";
import { Job } from "@/shared/schema";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
}

interface JobDetailsProps {
    job: Job | null;
}

export function JobDetails({ job }: JobDetailsProps) {
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

    // Only use real data, no sample data
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

            <hr className="border-gray-200" />

            {/* Orders Section - Based on the first screenshot */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <span role="img" aria-label="clipboard" className="text-2xl">📋</span>
                    <span className="text-xl font-semibold">Orders</span>
                </div>
                <div className="overflow-x-auto bg-yellow-50 rounded border border-yellow-100">
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

            {/* Waiting on Vendor Section - Based on the second screenshot */}
            <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                    <span role="img" aria-label="truck" className="text-2xl">🚚</span>
                    <span className="text-xl font-semibold">Waiting on Vendor</span>
                </div>
                <div className="overflow-x-auto bg-gray-50 rounded">
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

            {/* Work Center Involvement - Based on the first screenshot */}
            <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                    <span role="img" aria-label="factory" className="text-2xl">🏭</span>
                    <span className="text-xl font-semibold">Work Center Involvement</span>
                </div>
                <div className="overflow-x-auto">
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

            {/* In Progress / Pending Parts - Based on the third screenshot */}
            <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                    <span role="img" aria-label="gear" className="text-2xl">⚙️</span>
                    <span className="text-xl font-semibold">In Progress / Pending Parts</span>
                </div>
                {
                    inProgressParts.length > 0 ? (
                        inProgressParts.map(([partName, operations], index) => (
                            <Card key={index} className="mb-4 overflow-hidden border-blue-200">
                                <CardHeader className="bg-blue-50 py-2 px-4">
                                    <CardTitle className="text-base font-medium flex items-center">
                                        <span className="text-gray-600 mr-2">↘</span>
                                        <span>{partName}</span>
                                        <span className="text-gray-500 ml-2 text-sm">
                                            – {operations.filter(op => op.status === 'Complete').length}/{operations.length} complete
                                        </span>
                                    </CardTitle>
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
                                                <TableRow key={opIndex} className={op.status === 'Complete' ? 'bg-green-50' : ''}>
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
                        ))
                    ) : (
                        <div className="text-gray-500 bg-gray-50 p-4 rounded text-center">
                            No in-progress parts
                        </div>
                    )
                }
            </div>

            {/* Completed Parts - Based on the third screenshot */}
            <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                    <span role="img" aria-label="checkmark" className="text-2xl">✅</span>
                    <span className="text-xl font-semibold">Completed Parts</span>
                </div>
                {
                    completedParts.length > 0 ? (
                        completedParts.map(([partName, operations], index) => (
                            <Card key={index} className="mb-4 overflow-hidden border-green-200">
                                <CardHeader className="bg-green-50 py-2 px-4">
                                    <CardTitle className="text-base font-medium flex items-center">
                                        <span className="text-gray-600 mr-2">↘</span>
                                        <span>{partName}</span>
                                        <span className="text-gray-500 ml-2 text-sm">
                                            – {operations.length}/{operations.length} complete
                                        </span>
                                    </CardTitle>
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
                                                <TableRow key={opIndex} className="bg-green-50">
                                                    <TableCell className="py-2">{op.operation_number}</TableCell>
                                                    <TableCell className="py-2">{op.work_order_number}</TableCell>
                                                    <TableCell className="py-2">{op.task_description}</TableCell>
                                                    <TableCell className="py-2">{op.work_center}</TableCell>
                                                    <TableCell className="py-2">{op.planned_hours.toFixed(1)}</TableCell>
                                                    <TableCell className="py-2">{op.actual_hours.toFixed(1)}</TableCell>
                                                    <TableCell className="py-2">{op.remaining_work.toFixed(1)}</TableCell>
                                                    <TableCell className="py-2">
                                                        <Badge variant="secondary">Complete</Badge>
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
                        ))
                    ) : (
                        <div className="text-gray-500 bg-gray-50 p-4 rounded text-center">
                            No completed parts
                        </div>
                    )
                }
            </div>
        </div>
    );
}