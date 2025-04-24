import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSqlMigration() {
    try {
        console.log('Starting SQL migration...');

        // Rename the column
        const { error: renameError } = await supabase
            .from('job_operations')
            .update({ "Sales Document": "Order" })
            .select();

        if (renameError) {
            console.error('Error renaming column:', renameError);
            return;
        }

        // Drop the old index and create new one
        const { error: indexError } = await supabase.rpc('drop_and_create_index', {
            drop_sql: 'DROP INDEX IF EXISTS job_operations_order_idx;',
            create_sql: 'CREATE INDEX job_operations_sales_document_idx ON job_operations ("Sales Document");'
        });

        if (indexError) {
            console.error('Error updating index:', indexError);
            return;
        }

        console.log('SQL migration executed successfully!');

    } catch (error) {
        console.error('Unexpected error during migration:', error);
    }
}

runSqlMigration();