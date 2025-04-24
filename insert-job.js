import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function insertJob() {
    try {
        const job = {
            job_number: '100575126',
            title: 'Dismantling & Inspection',
            description: 'Non conformance operation',
            status: 'In Progress',
            due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
            scheduled_date: new Date().toISOString(),
            priority: 'High',
            progress: 25, // Based on 4 hours completed out of 16 planned
            work_center: 'DNI',
            customer: 'Sample Customer'
        };

        console.log('Inserting job into jobs table...');
        const { error } = await supabase
            .from('jobs')
            .upsert(job, { onConflict: 'job_number' });

        if (error) {
            console.error('Error inserting job:', error);
        } else {
            console.log('Job inserted successfully!');
        }
    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

insertJob();