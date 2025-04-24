import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables');
    process.exit(1);
}

async function insertOperationsDirect() {
    try {
        console.log('Inserting sample job operations directly...');

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

        // Insert each operation individually
        for (const operation of sampleOperations) {
            console.log(`Inserting operation ${operation.operation_number}...`);

            const response = await fetch(`${supabaseUrl}/rest/v1/sap_operations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(operation)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Error inserting operation ${operation.operation_number}:`, errorText);
            } else {
                console.log(`Successfully inserted operation ${operation.operation_number}`);
            }
        }

        console.log('All operations insertion attempts completed');
    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

insertOperationsDirect();