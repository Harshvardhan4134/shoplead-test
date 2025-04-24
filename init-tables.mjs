import { createClient } from '@supabase/supabase-js';
import xlsx from 'xlsx';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Add console logging for debugging
console.log('Supabase URL:', process.env.VITE_SUPABASE_URL);
console.log('Supabase key length:', process.env.VITE_SUPABASE_ANON_KEY?.length);

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function initializeTables() {
    try {
        const filePath = join(__dirname, 'SAPDATA.xlsx');
        console.log('Checking if file exists:', filePath);

        if (!fs.existsSync(filePath)) {
            throw new Error(`SAPDATA.xlsx not found at ${filePath}`);
        }

        console.log('Reading SAP data from:', filePath);

        // Read SAP data from Excel
        const workbook = xlsx.readFile(filePath);
        console.log('Available sheets:', workbook.SheetNames);

        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const sapData = xlsx.utils.sheet_to_json(worksheet);

        console.log('Found', sapData.length, 'records in Excel file');
        if (sapData.length > 0) {
            console.log('Sample record:', JSON.stringify(sapData[0], null, 2));
            console.log('Column names:', Object.keys(sapData[0]).join(', '));
        }

        // Create mock jobs based on unique order numbers
        const uniqueOrders = [...new Set(sapData.map(row => row['Order']))];
        console.log('Found', uniqueOrders.length, 'unique orders');

        // Test Supabase connection
        console.log('Testing Supabase connection...');
        const { data: testData, error: testError } = await supabase
            .from('workcenters')
            .select('count(*)')
            .single();

        if (testError) {
            throw new Error(`Supabase connection test failed: ${testError.message}`);
        }
        console.log('Supabase connection successful');

        const jobs = uniqueOrders.map(order => {
            const orderOps = sapData.filter(row => row['Order'] === order);
            const workCenter = orderOps[0]['Oper.WorkCenter'];
            return {
                job_number: order,
                title: orderOps[0]['Description'] || 'Job ' + order,
                description: orderOps[0]['Opr. short text'] || '',
                status: 'New',
                work_center: workCenter,
                customer: orderOps[0]['List name'] || 'Unknown Customer'
            };
        });

        // Insert jobs
        console.log('Inserting', jobs.length, 'jobs...');
        for (const job of jobs) {
            const { error } = await supabase
                .from('jobs')
                .upsert(job, { onConflict: 'job_number' });

            if (error) {
                console.error('Error inserting job:', error);
                console.error('Job data:', job);
            }
        }

        // Transform and insert SAP operations
        console.log('Processing SAP operations...');
        const sapOperations = sapData.map(row => ({
            order_number: row['Order'],
            operation_number: row['Oper./Act.'],
            work_center: row['Oper.WorkCenter'],
            description: row['Description'],
            short_text: row['Opr. short text'],
            planned_work: row['Work'] || 0,
            actual_work: row['Actual work'] || 0,
            status: getOperationStatus(row['Work'] || 0, row['Actual work'] || 0)
        }));

        // Insert operations in batches
        const BATCH_SIZE = 25;
        console.log('Inserting', sapOperations.length, 'operations in batches of', BATCH_SIZE);

        for (let i = 0; i < sapOperations.length; i += BATCH_SIZE) {
            const batch = sapOperations.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(sapOperations.length / BATCH_SIZE);

            console.log(`Processing batch ${batchNum}/${totalBatches}...`);

            const { error } = await supabase
                .from('sap_operations')
                .upsert(batch, {
                    onConflict: 'order_number,operation_number',
                    ignoreDuplicates: true
                });

            if (error) {
                console.error('Error inserting SAP operations batch:', error);
                console.error('Sample record from failed batch:', batch[0]);
            }
        }

        console.log('Database initialization completed!');

    } catch (error) {
        console.error('Error during initialization:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

function getOperationStatus(planned, actual) {
    if (planned === 0) return 'Pending';
    if (actual === 0) return 'Not Started';
    if (actual >= planned) return 'Complete';
    return 'In Progress';
}

initializeTables();