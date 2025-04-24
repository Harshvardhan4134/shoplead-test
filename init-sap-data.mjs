import { createClient } from '@supabase/supabase-js';
import xlsx from 'xlsx';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function importSAPData() {
    try {
        console.log('Reading SAP data...');
        const workbook = xlsx.readFile('SAPDATA.xlsx');
        const sheetName = workbook.SheetNames[0];
        const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        // Map the operations data - exclude work_order since column doesn't exist yet
        const operations = rawData.map(row => ({
            order_number: row['Order'] || row['Sales Document'] || '',
            operation_number: row['Oper./Act.'] || '',
            work_center: row['Oper.WorkCenter'] || '',
            description: row['Description'] || '',
            short_text: row['Opr. short text'] || '',
            planned_work: Number(row['Work']) || 0,
            actual_work: Number(row['Actual work']) || 0,
            status: 'Not Started',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }));

        console.log(`Found ${operations.length} operations`);
        console.log('Sample operation:', operations[0]);

        // Get unique work centers for validation
        const workCenters = [...new Set(operations.map(op => op.work_center))];
        console.log('Valid work centers:', workCenters.join(', '));

        // Filter out any invalid operations
        const validOperations = operations.filter(op =>
            op.order_number &&
            op.operation_number &&
            op.work_center
        );

        console.log(`Found ${validOperations.length} valid operations after filtering`);
        console.log('Sample operation:', validOperations[0]);

        // Clear existing data with a safe DELETE
        console.log('Clearing existing data...');
        const { error: deleteError } = await supabase
            .from('sap_operations')
            .delete()
            .gte('created_at', '2000-01-01');

        if (deleteError) {
            console.error('Error clearing existing data:', deleteError);
            return;
        }

        // Insert the new operations data in batches
        console.log('Inserting new operations...');
        const batchSize = 100;
        for (let i = 0; i < validOperations.length; i += batchSize) {
            const batch = validOperations.slice(i, i + batchSize);
            const { error: insertError } = await supabase
                .from('sap_operations')
                .insert(batch);

            if (insertError) {
                console.error('Error inserting batch:', insertError);
                return;
            }
            console.log(`Inserted batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(validOperations.length / batchSize)}`);
        }

        console.log('SAP data imported successfully!');

    } catch (error) {
        console.error('Error importing SAP data:', error);
        process.exit(1);
    }
}

importSAPData();