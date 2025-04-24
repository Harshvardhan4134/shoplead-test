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

async function checkTables() {
    try {
        // Check sap_operations table
        const { data: sapOps, error: sapError } = await supabase
            .from('sap_operations')
            .select('*')
            .limit(1);

        if (sapError) {
            console.error('Error checking sap_operations:', sapError);
        } else {
            console.log('sap_operations sample:', sapOps);
        }

        // Check job_operations table
        const { data: jobOps, error: jobError } = await supabase
            .from('job_operations')
            .select('*')
            .limit(1);

        if (jobError) {
            console.error('Error checking job_operations:', jobError);
        } else {
            console.log('job_operations sample:', jobOps);
        }

        // Check jobs table
        const { data: jobs, error: jobsError } = await supabase
            .from('jobs')
            .select('*')
            .limit(1);

        if (jobsError) {
            console.error('Error checking jobs:', jobsError);
        } else {
            console.log('jobs sample:', jobs);
        }
    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

checkTables();