const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Replace with your Supabase URL and anon key
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    try {
        console.log('Starting migration...');

        // First, check if there's data in sap_operations
        const { data: sapOps, error: sapError } = await supabase
            .from('sap_operations')
            .select('count');

        if (sapError) {
            console.error('Error checking sap_operations:', sapError);
            return;
        }

        console.log('sap_operations count:', sapOps);

        if (!sapOps || sapOps.length === 0 || sapOps[0].count === 0) {
            console.error('No data in sap_operations table. Migration cannot proceed.');
            return;
        }

        // Get all data from sap_operations
        const { data: allSapOps, error: allSapError } = await supabase
            .from('sap_operations')
            .select('*');

        if (allSapError) {
            console.error('Error fetching sap_operations data:', allSapError);
            return;
        }

        console.log(`Found ${allSapOps.length} records in sap_operations`);

        // Transform the data to match job_operations structure
        const jobOperations = allSapOps.map(op => ({
            "Sales Document": op.order_number,
            "Oper./Act.": op.operation_number,
            "Oper.WorkCenter": op.work_center,
            "Description": op.description,
            "Opr. short text": op.short_text,
            "Work": op.planned_work,
            "Actual work": op.actual_work
        }));

        // Insert data into job_operations
        const { data: insertResult, error: insertError } = await supabase
            .from('job_operations')
            .insert(jobOperations);

        if (insertError) {
            console.error('Error inserting data into job_operations:', insertError);
            return;
        }

        console.log('Migration completed successfully!');

        // Check job_operations after migration
        const { data: jobOps, error: jobError } = await supabase
            .from('job_operations')
            .select('count');

        if (jobError) {
            console.error('Error checking job_operations after migration:', jobError);
        } else {
            console.log('job_operations count after migration:', jobOps);
        }
    } catch (error) {
        console.error('Unexpected error during migration:', error);
    }
}

runMigration();