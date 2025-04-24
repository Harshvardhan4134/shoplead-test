import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import * as dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Please set VITE_SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function importRealData() {
    try {
        console.log('Reading SAPDATA.xlsx file...');

        // Read the Excel file using a buffer
        const filePath = join(__dirname, 'SAPDATA.xlsx');
        const buffer = fs.readFileSync(filePath);
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        console.log(`Found ${data.length} records in SAPDATA.xlsx`);

        // Transform the data
        const operations = data.map(record => ({
            "Sales Document": record['Sales Document']?.toString() || '',
            "Order": record['Order']?.toString() || record['Sales Document']?.toString() || '',
            "Oper./Act.": record['Oper./Act.']?.toString() || '',
            "Oper.WorkCenter": record['Oper.WorkCenter']?.toString() || '',
            "Description": record['Description']?.toString() || '',
            "Opr. short text": record['Opr. short text']?.toString() || '',
            "Work": Number(record['Work']) || 0,
            "Actual work": Number(record['Actual work']) || 0
        }));

        console.log('Sample operation:', operations[0]);

        // First clear any existing data
        console.log('Clearing existing data from job_operations...');
        const { error: deleteError } = await supabase
            .from('job_operations')
            .delete()
            .gte('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows with valid UUIDs

        if (deleteError) {
            console.error('Error clearing existing data:', deleteError);
            throw deleteError;
        }

        // Insert data in batches
        const BATCH_SIZE = 50;
        let successCount = 0;

        for (let i = 0; i < operations.length; i += BATCH_SIZE) {
            const batch = operations.slice(i, i + BATCH_SIZE);

            console.log(`Inserting batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(operations.length / BATCH_SIZE)}...`);

            try {
                const { error } = await supabase
                    .from('job_operations')
                    .insert(batch);

                if (error) {
                    console.error('Error details:', {
                        code: error.code,
                        msg: error.message,
                        details: error.details,
                        hint: error.hint
                    });
                    console.error('Sample record from failed batch:', batch[0]);
                    throw error;
                }

                successCount += batch.length;
                console.log(`Successfully inserted ${successCount} records so far`);
            } catch (batchError) {
                console.error('Batch insert failed:', batchError);
                throw batchError;
            }
        }

        console.log('Data import completed successfully!');

        // Verify the import
        const { data: jobOps, error: countError } = await supabase
            .from('job_operations')
            .select('count');

        if (countError) {
            console.error('Error getting count:', countError);
        } else {
            console.log('Total records in job_operations:', jobOps[0].count);
        }

    } catch (error) {
        console.error('Error importing data:', error);
        if (error.code === 'ENOENT') {
            console.error('SAPDATA.xlsx file not found. Make sure it exists in the correct location.');
        }
        process.exit(1);
    }
}

importRealData();