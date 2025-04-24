import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Try to use the service role key if available, otherwise fall back to anon key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Please set VITE_SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY environment variables');
    process.exit(1);
}

console.log('Using Supabase URL:', supabaseUrl);
console.log('Using service role key:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

// Create client with auth admin privileges to bypass RLS
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function insertJobOperations() {
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

        console.log('Inserting operations into sap_operations table...');
        const { data, error } = await supabase
            .from('sap_operations')
            .insert(sampleOperations);

        if (error) {
            console.error('Error inserting SAP operations:', error);
        } else {
            console.log('Successfully inserted SAP operations!');
        }
    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

insertJobOperations();