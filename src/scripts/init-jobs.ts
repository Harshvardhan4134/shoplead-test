import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Initialize Supabase client
const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

const workCenters = [
    'Machine Shop',
    'Assembly',
    'Quality Control',
    'Paint Shop',
    'Welding',
    'Testing'
];

const generateSampleJobs = () => {
    const jobs = [];
    const operations = [];
    const statuses = ['New', 'In Progress', 'Completed'] as const;
    const priorities = ['High', 'Medium', 'Low'] as const;

    // Generate 5 jobs for each work center
    workCenters.forEach((workCenter, wcIndex) => {
        for (let i = 1; i <= 5; i++) {
            const jobNumber = `JOB${wcIndex + 1}${i.toString().padStart(2, '0')}`;
            const status = statuses[Math.floor(Math.random() * statuses.length)];

            // Create job
            jobs.push({
                job_number: jobNumber,
                title: `${workCenter} Job ${i}`,
                description: `Sample job ${i} for ${workCenter}`,
                status,
                due_date: new Date(Date.now() + (Math.random() * 30 + 1) * 24 * 60 * 60 * 1000).toISOString(),
                scheduled_date: new Date(Date.now() + Math.random() * 15 * 24 * 60 * 60 * 1000).toISOString(),
                priority: priorities[Math.floor(Math.random() * priorities.length)],
                progress: status === 'Completed' ? 100 : status === 'In Progress' ? Math.floor(Math.random() * 80 + 10) : 0,
                work_center: workCenter,
                customer: `Customer ${Math.floor(Math.random() * 5) + 1}`
            });

            // Create 2-4 operations for this job
            const numOperations = Math.floor(Math.random() * 3) + 2;
            for (let j = 1; j <= numOperations; j++) {
                const plannedWork = Math.floor(Math.random() * 40) + 10; // 10-50 hours
                const actualWork = status === 'Completed' ? plannedWork :
                    status === 'In Progress' ? Math.floor(Math.random() * plannedWork) :
                        0;

                operations.push({
                    order_number: jobNumber,
                    operation_number: j.toString().padStart(2, '0'),
                    work_center: workCenter,
                    description: `Operation ${j} for ${jobNumber}`,
                    short_text: `Op ${j}`,
                    planned_work: plannedWork,
                    actual_work: actualWork,
                    status: actualWork >= plannedWork ? 'Completed' :
                        actualWork > 0 ? 'In Progress' : 'Not Started'
                });
            }
        }
    });

    return { jobs, operations };
};

const initializeJobsAndOperations = async () => {
    try {
        console.log('Generating sample data...');
        const { jobs, operations } = generateSampleJobs();

        console.log('Inserting jobs...');
        const { error: jobsError } = await supabase
            .from('jobs')
            .upsert(jobs);

        if (jobsError) throw jobsError;

        console.log('Inserting operations...');
        const { error: opsError } = await supabase
            .from('sap_operations')
            .upsert(operations);

        if (opsError) throw opsError;

        console.log('Sample data initialized successfully!');
        console.log(`Created ${jobs.length} jobs and ${operations.length} operations`);

    } catch (error) {
        console.error('Error initializing sample data:', error);
        process.exit(1);
    }
};

// Execute the function
initializeJobsAndOperations();