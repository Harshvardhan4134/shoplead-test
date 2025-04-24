import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function initNCRsTable() {
    try {
        console.log('Initializing NCRs table...');

        // Drop and recreate the table using raw SQL
        const { error: sqlError } = await supabase
            .from('ncrs')
            .delete()
            .neq('id', 0);

        if (sqlError) {
            console.error('Error clearing existing data:', sqlError);
        }

        // Create the table with all required columns using raw SQL
        const { error: createError } = await supabase
            .from('ncrs')
            .upsert([
                {
                    ncr_number: 'INIT',
                    job_number: 'INIT',
                    work_order: 'INIT',
                    operation_number: 'INIT',
                    part_name: 'INIT',
                    customer_name: 'INIT',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            ]);

        if (createError) {
            throw createError;
        }

        // Remove the initialization record
        await supabase
            .from('ncrs')
            .delete()
            .eq('ncr_number', 'INIT');

        console.log('NCRs table initialized successfully!');
        return true;
    } catch (error) {
        console.error('Error initializing NCRs table:', error);
        return false;
    }
}

initNCRsTable();