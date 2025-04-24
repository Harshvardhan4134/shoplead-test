import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function importSAPData() {
    try {
        console.log('Reading SAP data...');
        const workbook = XLSX.readFile('SAPDATA.xlsx');
        const sheetName = workbook.SheetNames[0];
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        // Map the operations data
        const operations = rawData.map(row => ({
            order_number: row['Order'] || row['Sales Document'] || '',
            operation_number: row['Oper./Act.'] || '',
            work_center: row['Oper.WorkCenter'] || '',
            description: row['Description'] || '',
            short_text: row['Opr. short text'] || '',
            planned_work: Number(row['Work']) || 0,
            actual_work: Number(row['Actual work']) || 0,
            work_order: row['Order'] || '', // Map the Order column to work_order
            status: 'Not Started',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }));

        console.log(`Found ${operations.length} operations`);
        console.log('Sample operation:', operations[0]);

        // Clear existing data
        console.log('Clearing existing data...');

        const { error: truncateError } = await supabase
            .from('sap_operations')
            .delete();

        if (truncateError) {
            console.error('Error clearing existing data:', truncateError);
            return;
        }

        // Insert the new operations data
        console.log('Inserting new operations...');
        const { error: insertError } = await supabase
            .from('sap_operations')
            .insert(operations);

        if (insertError) {
            console.error('Error inserting operations:', insertError);
            return;
        }

        console.log('SAP data imported successfully!');

    } catch (error) {
        console.error('Error importing SAP data:', error);
        process.exit(1);
    }
}

importSAPData();