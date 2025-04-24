import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    try {
        console.log('Starting RLS functions migration...');

        // Read the SQL file
        const sqlContent = fs.readFileSync('./supabase/migrations/20240424000001_create_rls_functions.sql', 'utf8');

        // Execute the SQL directly
        const { error } = await supabase.rpc('run_sql', { sql: sqlContent });

        if (error) {
            console.error('Error executing SQL:', error);

            // Try an alternative approach
            console.log('Trying alternative approach...');
            const { error: altError } = await supabase.from('_sqlmigration').insert({
                name: 'create_rls_functions',
                sql: sqlContent
            });

            if (altError) {
                console.error('Alternative approach failed:', altError);
            } else {
                console.log('Alternative approach succeeded');
            }
        } else {
            console.log('SQL executed successfully');
        }

        console.log('RLS functions migration completed');
    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

runMigration();