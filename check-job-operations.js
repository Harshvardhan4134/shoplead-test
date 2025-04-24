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

// Get the job number from command line arguments
const jobNumber = process.argv[2] || '100575126';

async function checkJobOperations() {
    try {
        console.log(`Checking operations for job number: ${jobNumber}`);

        // Check sap_operations table
        const { data: sapOps, error: sapError } = await supabase
            .from('sap_operations')
            .select('*')
            .eq('order_number', jobNumber);

        if (sapError) {
            console.error('Error checking sap_operations:', sapError);
        } else {
            console.log(`Found ${sapOps?.length || 0} operations in sap_operations for job ${jobNumber}`);
            if (sapOps && sapOps.length > 0) {
                console.log('First operation:', sapOps[0]);
            }
        }

        // Check job_operations table
        const { data: jobOps, error: jobError } = await supabase
            .from('job_operations')
            .select('*')
            .eq('Order', jobNumber);

        if (jobError) {
            console.error('Error checking job_operations:', jobError);
        } else {
            console.log(`Found ${jobOps?.length || 0} operations in job_operations for job ${jobNumber}`);
            if (jobOps && jobOps.length > 0) {
                console.log('First operation:', jobOps[0]);
            }
        }
    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

checkJobOperations();