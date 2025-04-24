import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { JobDetails } from "./JobDetails";
import { Job } from "@/shared/schema";
import { db } from '@/lib/db';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

interface JobModalProps {
    jobNumber: string | null;
    isOpen: boolean;
    onClose: () => void;
}

export function JobModal({ jobNumber, isOpen, onClose }: JobModalProps) {
    const {
        data: job,
        isLoading,
        error,
        refetch
    } = useQuery<Job | null>({
        queryKey: ['job', jobNumber],
        queryFn: async () => {
            if (!jobNumber) return null;
            try {
                // Get the job data
                const jobData = await db.getJobByNumber(jobNumber);

                // Get the operations data using OR condition for both columns
                const { data: operations, error } = await supabase
                    .from('job_operations')
                    .select('*')
                    .or(`Order.eq.${jobNumber},Sales Document.eq.${jobNumber}`);

                if (error) throw error;

                console.log('Fetched operations:', operations);

                // Merge the operations data with the job data
                return {
                    ...jobData,
                    sap_data: operations?.map(op => ({
                        ...op,
                        'Sales Document': op['Sales Document'] || op['Order'] || jobNumber,
                        'Order': op['Order'] || op['Sales Document'] || jobNumber,
                        'Oper./Act.': op['Oper./Act.'],
                        'Oper.WorkCenter': op['Oper.WorkCenter'],
                        'Description': op['Description'],
                        'Opr. short text': op['Opr. short text'],
                        'Work': op['Work'],
                        'Actual work': op['Actual work']
                    })) || []
                };
            } catch (error) {
                console.error('Error fetching job:', error);
                throw error;
            }
        },
        enabled: isOpen && !!jobNumber,
        staleTime: 30000
    });

    useEffect(() => {
        if (error) {
            console.error('Error in JobModal:', error);
        }
    }, [error]);

    useEffect(() => {
        if (jobNumber && isOpen) {
            console.log('Fetching job details for:', jobNumber);
        }
    }, [jobNumber, isOpen]);

    const errorMessage = error instanceof Error ? error.message : 'Failed to load job details';

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogTitle className="flex items-center gap-2">
                    <span>Job Details</span>
                    {jobNumber && (
                        <span className="text-sm text-gray-500">#{jobNumber}</span>
                    )}
                </DialogTitle>
                <DialogDescription>
                    {jobNumber ? `Viewing details for job number: ${jobNumber}` : 'No job selected'}
                </DialogDescription>

                {isLoading ? (
                    <div className="flex items-center justify-center p-8">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                            <p className="text-gray-600">Loading job details...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center p-8">
                        <div className="text-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-destructive mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-destructive text-lg font-medium mb-2">Error Loading Job Details</p>
                            <p className="text-gray-600 mb-4">{errorMessage}</p>
                            <button
                                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
                                onClick={() => refetch()}
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                ) : !job ? (
                    <div className="flex items-center justify-center p-8">
                        <div className="text-center">
                            <p className="text-gray-600">No job data found for: {jobNumber}</p>
                        </div>
                    </div>
                ) : (
                    console.log('Passing job to JobDetails:', job),
                    <JobDetails job={job} />
                )}
            </DialogContent>
        </Dialog>
    );
}