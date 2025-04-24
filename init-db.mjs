import { createClient } from '@supabase/supabase-js';
import { read, utils } from 'xlsx';
import * as dotenv from 'dotenv';
dotenv.config();

// Initialize Supabase client
const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function initializeDatabase() {
    try {
        console.log('Initializing database...');

        // Initialize SAP data
        console.log('Reading SAP data from Excel file...');
        const workbook = read('./SAPDATA.xlsx', { type: 'file' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = utils.sheet_to_json(worksheet);

        console.log('Found', rawData.length, 'SAP operations');
        console.log('Sample raw data:', rawData[0]);

        // Transform the data to match our new schema
        const sapData = rawData.map(row => ({
            sales_document: row["Sales Document"]?.toString(),
            order_number: row["Order"]?.toString(),
            operation_number: row["Oper./Act."]?.toString(),
            work_center: row["Oper.WorkCenter"]?.toString(),
            description: row["Description"]?.toString(),
            short_text: row["Opr. short text"]?.toString(),
            planned_work: parseFloat(row["Work"]) || 0,
            actual_work: parseFloat(row["Actual work"]) || 0
        }));

        // Get unique work centers from SAP data
        const uniqueWorkCenters = [...new Set(sapData.map(op => op.work_center))].filter(Boolean);

        // Calculate utilization for each work center
        const workCenterStats = uniqueWorkCenters.reduce((acc, wc) => {
            const ops = sapData.filter(op => op.work_center === wc);
            const totalWork = ops.reduce((sum, op) => sum + op.planned_work, 0);
            const actualWork = ops.reduce((sum, op) => sum + op.actual_work, 0);
            const utilization = totalWork > 0 ? (actualWork / totalWork) * 100 : 0;
            acc[wc] = utilization;
            return acc;
        }, {});

        // Prepare work centers with calculated utilization
        const workcenters = uniqueWorkCenters.map(name => ({
            name,
            type: 'Production',
            status: 'Available',
            utilization: Math.round(workCenterStats[name] || 0)
        }));

        console.log('Upserting work centers...');
        const { error: workCenterError } = await supabase
            .from('workcenters')
            .upsert(workcenters, { onConflict: 'name' });

        if (workCenterError) {
            console.error('Error upserting work centers:', workCenterError);
        }

        // Batch upsert SAP data in chunks to avoid request size limits
        const BATCH_SIZE = 50;
        for (let i = 0; i < sapData.length; i += BATCH_SIZE) {
            const batch = sapData.slice(i, i + BATCH_SIZE);
            console.log(`Upserting SAP operations batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(sapData.length / BATCH_SIZE)}...`);

            const { error: sapError } = await supabase
                .from('sap_operations')
                .upsert(batch, {
                    onConflict: 'order_number,operation_number',
                    ignoreDuplicates: true
                });

            if (sapError) {
                console.error('Error upserting SAP batch:', sapError);
                console.error('Sample problematic record:', batch[0]);
            }

            // Add a small delay between batches to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Verify the data
        const { data: workCenterData } = await supabase.from('workcenters').select('*');
        const { data: sapOperations } = await supabase.from('sap_operations').select('*');

        console.log('\nCurrent data:');
        console.log('Work Centers:', workCenterData?.length || 0);
        console.log('Sample work center:', workCenterData?.[0]);
        console.log('SAP Operations:', sapOperations?.length || 0);
        console.log('Sample SAP operation:', sapOperations?.[0]);

    } catch (error) {
        console.error('Error initializing database:', error);
        if (error.message) console.error('Error message:', error.message);
        if (error.details) console.error('Error details:', error.details);
        process.exit(1);
    }
}

initializeDatabase();