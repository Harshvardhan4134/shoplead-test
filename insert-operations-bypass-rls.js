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

async function insertOperationsWithoutRLS() {
    try {
        console.log('Inserting sample job operations...');

        const jobNumber = '100575126';
        const sampleOperations = [
            {
                order_number: jobNumber,
                operation_number: "0010",
                work_center: "DNI",
                description: "Dismantle pump and inspect",
                short_text: "Dismantling & Inspection",
                planned_work: 8.0,
                actual_work: 4.0
            },
            {
                order_number: jobNumber,
                operation_number: "0020",
                work_center: "SR",
                description: "Send pump shaft to vendor",
                short_text: "Vendor - Shaft Repair",
                planned_work: 24.0,
                actual_work: 0.0
            },
            {
                order_number: jobNumber,
                operation_number: "0030",
                work_center: "NDE PMI",
                description: "Non-destructive testing",
                short_text: "NDE Testing",
                planned_work: 4.0,
                actual_work: 0.0
            },
            {
                order_number: jobNumber,
                operation_number: "0040",
                work_center: "SR",
                description: "Send impeller to vendor",
                short_text: "Vendor - Impeller Balance",
                planned_work: 16.0,
                actual_work: 0.0
            },
            {
                order_number: jobNumber,
                operation_number: "0050",
                work_center: "ASM",
                description: "Reassemble pump with repaired parts",
                short_text: "Reassembly",
                planned_work: 12.0,
                actual_work: 0.0
            }
        ];

        // First, try to disable RLS on the sap_operations table
        console.log('Attempting to disable RLS on sap_operations table...');
        const { error: disableRLSError } = await supabase.rpc('disable_rls_for_sap_operations');

        if (disableRLSError) {
            console.error('Error disabling RLS:', disableRLSError);
            console.log('Proceeding with insert anyway...');
        } else {
            console.log('RLS disabled successfully');
        }

        // Insert the operations
        console.log('Inserting operations into sap_operations table...');
        const { data, error } = await supabase
            .from('sap_operations')
            .insert(sampleOperations);

        if (error) {
            console.error('Error inserting SAP operations:', error);
        } else {
            console.log('Successfully inserted SAP operations!');
        }

        // Re-enable RLS if we were able to disable it
        if (!disableRLSError) {
            console.log('Re-enabling RLS on sap_operations table...');
            const { error: enableRLSError } = await supabase.rpc('enable_rls_for_sap_operations');

            if (enableRLSError) {
                console.error('Error re-enabling RLS:', enableRLSError);
            } else {
                console.log('RLS re-enabled successfully');
            }
        }

        return !error;
    } catch (error) {
        console.error('Unexpected error:', error);
        return false;
    }
}

insertOperationsWithoutRLS();