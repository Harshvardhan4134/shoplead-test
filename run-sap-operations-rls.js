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
        console.log('Starting RLS policy migration for sap_operations...');

        // Read the SQL file
        const sqlContent = fs.readFileSync('./supabase/migrations/20240424000000_add_sap_operations_rls.sql', 'utf8');

        // Split the SQL content into individual statements
        const statements = sqlContent.split(';').filter(stmt => stmt.trim() !== '');

        // Execute each statement
        for (const statement of statements) {
            console.log(`Executing: ${statement.trim()}`);
            const { error } = await supabase.rpc('exec_sql', { sql: statement.trim() });

            if (error) {
                console.error('Error executing SQL statement:', error);
            } else {
                console.log('Statement executed successfully');
            }
        }

        console.log('RLS policy migration completed');
    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

runMigration();