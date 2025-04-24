import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Initialize Supabase client
const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

const initializeWorkcenters = async () => {
    try {
        console.log('Creating work_centers table if it does not exist...');

        // First try to select from the table to see if it exists
        const { data: existingData, error: checkError } = await supabase
            .from('work_centers')
            .select('*')
            .limit(1);

        // Insert or update work centers
        const workCenters = [
            {
                name: 'Machine Shop',
                type: 'Manufacturing',
                status: 'Running',
                utilization: 65,
                active_jobs: 4,
                total_capacity: 100,
                operator_count: 3,
                last_maintenance: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                next_maintenance: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000).toISOString(),
            },
            {
                name: 'Assembly',
                type: 'Manufacturing',
                status: 'Running',
                utilization: 45,
                active_jobs: 2,
                total_capacity: 80,
                operator_count: 4,
                last_maintenance: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                next_maintenance: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000).toISOString(),
            },
            {
                name: 'Quality Control',
                type: 'Inspection',
                status: 'Running',
                utilization: 70,
                active_jobs: 6,
                total_capacity: 60,
                operator_count: 2,
                last_maintenance: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                next_maintenance: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
            },
            {
                name: 'Paint Shop',
                type: 'Finishing',
                status: 'Maintenance',
                utilization: 0,
                active_jobs: 0,
                total_capacity: 40,
                operator_count: 2,
                last_maintenance: new Date().toISOString(),
                next_maintenance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            },
            {
                name: 'Welding',
                type: 'Manufacturing',
                status: 'Running',
                utilization: 80,
                active_jobs: 5,
                total_capacity: 90,
                operator_count: 3,
                last_maintenance: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                next_maintenance: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
            },
            {
                name: 'Testing',
                type: 'Quality Assurance',
                status: 'Idle',
                utilization: 10,
                active_jobs: 1,
                total_capacity: 50,
                operator_count: 2,
                last_maintenance: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                next_maintenance: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString(),
            }
        ];

        console.log('Upserting work centers data...');
        const { error: upsertError } = await supabase
            .from('work_centers')
            .upsert(workCenters, { onConflict: 'name' });

        if (upsertError) {
            throw upsertError;
        }

        console.log('Work centers initialized successfully!');

        // Verify the data
        const { data: finalData, error: verifyError } = await supabase
            .from('work_centers')
            .select('*');

        if (verifyError) {
            throw verifyError;
        }

        console.log('Current work centers:', finalData);

    } catch (error) {
        console.error('Error initializing work centers:', error);
        process.exit(1);
    }
};

// Execute the function
initializeWorkcenters();