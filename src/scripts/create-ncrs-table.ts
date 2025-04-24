import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

async function createNCRsTable() {
    if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
        console.error('Missing Supabase environment variables');
        process.exit(1);
    }

    const supabase = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.VITE_SUPABASE_ANON_KEY,
        {
            db: {
                schema: 'public'
            }
        }
    );

    console.log('Creating NCRs table...');

    try {
        // First check if table exists
        const { error: checkError } = await supabase
            .from('ncrs')
            .select('id')
            .limit(1);

        if (!checkError) {
            // Table exists, empty it
            const { error: deleteError } = await supabase
                .from('ncrs')
                .delete()
                .neq('id', 0); // Delete all rows

            if (deleteError) {
                console.error('Error clearing NCRs table:', deleteError);
                throw deleteError;
            }
        }

        // Insert sample data
        const { error: insertError } = await supabase
            .from('ncrs')
            .insert([
                {
                    job_number: '100539161',
                    work_order: '5006099',
                    operation_number: '10',
                    part_name: 'Pump Shaft',
                    customer_name: 'COLORADO SPRINGS UTILITIES',
                    equipment_type: 'Lathe',
                    issue_category: 'Material Defect',
                    financial_impact: 150.00,
                    status: 'Submitted',
                    corrective_action: 'Replace material with correct specification'
                }
            ]);

        if (insertError) {
            console.error('Error inserting sample NCR:', insertError);
            throw insertError;
        }

        console.log('NCRs table initialized successfully!');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

console.log('Starting NCRs table initialization...');
createNCRsTable();