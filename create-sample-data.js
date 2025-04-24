const { createClient } = require('@supabase/supabase-js');

// Replace with your Supabase URL and anon key
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createSampleData() {
    try {
        console.log('Creating sample data...');

        // Check if sap_operations table exists and has data
        const { data: sapOps, error: sapError } = await supabase
            .from('sap_operations')
            .select('count');

        if (sapError) {
            console.error('Error checking sap_operations:', sapError);
            return;
        }

        console.log('sap_operations count:', sapOps);

        // If sap_operations table is empty, create sample data
        if (!sapOps || sapOps.length === 0 || sapOps[0].count === 0) {
            console.log('Creating sample data in sap_operations...');

            // Sample job numbers from your logs
            const jobNumbers = ['100575804', '100575126'];

            // Create sample operations for each job
            for (const jobNumber of jobNumbers) {
                const sampleOperations = [
                    {
                        order_number: jobNumber,
                        operation_number: '0010',
                        work_center: 'MILL',
                        description: 'Milling Operation',
                        short_text: 'Mill part',
                        planned_work: 5.0,
                        actual_work: 2.5
                    },
                    {
                        order_number: jobNumber,
                        operation_number: '0020',
                        work_center: 'LATHE',
                        description: 'Turning Operation',
                        short_text: 'Turn part',
                        planned_work: 3.0,
                        actual_work: 1.0
                    },
                    {
                        order_number: jobNumber,
                        operation_number: '0030',
                        work_center: 'SR',
                        description: 'Vendor Operation',
                        short_text: 'Send to vendor for coating',
                        planned_work: 8.0,
                        actual_work: 0.0
                    }
                ];

                // Insert sample operations
                const { data, error } = await supabase
                    .from('sap_operations')
                    .insert(sampleOperations);

                if (error) {
                    console.error(`Error creating sample operations for job ${jobNumber}:`, error);
                } else {
                    console.log(`Created sample operations for job ${jobNumber}`);
                }
            }
        }

        // Check if job_operations table exists
        const { data: jobOps, error: jobOpsError } = await supabase
            .from('job_operations')
            .select('count');

        if (jobOpsError) {
            console.error('Error checking job_operations:', jobOpsError);
        } else {
            console.log('job_operations count:', jobOps);

            // If job_operations table is empty, migrate data from sap_operations
            if (!jobOps || jobOps.length === 0 || jobOps[0].count === 0) {
                console.log('Migrating data from sap_operations to job_operations...');

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
                } else {
                    console.log('Migration completed successfully!');
                }
            }
        }

        console.log('Sample data creation completed!');
    } catch (error) {
        console.error('Unexpected error during sample data creation:', error);
    }
}

createSampleData();