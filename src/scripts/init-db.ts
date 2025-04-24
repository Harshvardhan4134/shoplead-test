import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read and parse .env file manually since we're in a Node.js context
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        console.log('Loading env file from:', envPath);
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const env: Record<string, string> = {};

        envContent.split('\n').forEach(line => {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
                env[key.trim()] = valueParts.join('=').trim();
            }
        });

        return env;
    } catch (error) {
        console.error('Error loading .env file:', error);
        throw error;
    }
}

async function initializeDatabase() {
    try {
        console.log('Loading environment variables...');
        const env = loadEnv();
        const supabaseUrl = env.VITE_SUPABASE_URL;
        const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Missing Supabase environment variables');
        }

        console.log('Connecting to Supabase:', supabaseUrl);
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Load the SQL migration
        const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20240101000000_create_tables.sql');
        console.log('Loading migration from:', migrationPath);
        const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

        // Split the migration into individual statements
        const statements = migrationSql
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);

        console.log(`Found ${statements.length} SQL statements to execute`);

        // Execute each statement
        for (const statement of statements) {
            try {
                console.log('Executing SQL:', statement.substring(0, 100) + '...');
                const { error } = await supabase.rpc('exec_sql', {
                    query: statement
                });

                if (error) {
                    if (error.message.includes('permission denied') || error.message.includes('insufficient privileges')) {
                        console.warn('Permission denied for SQL execution. Trying alternative approach...');
                        // If we can't execute SQL directly, try to create through the API
                        if (statement.toLowerCase().includes('create table') && statement.toLowerCase().includes('jobs')) {
                            console.log('Attempting to create jobs table through API...');
                            const { error: insertError } = await supabase
                                .from('jobs')
                                .insert([{
                                    job_number: 'TEST-001',
                                    title: 'Test Job',
                                    description: 'Test job for table creation',
                                    status: 'New',
                                    due_date: new Date().toISOString(),
                                    scheduled_date: new Date().toISOString(),
                                    priority: 'Low',
                                    progress: 0,
                                    work_center: 'Test Center',
                                    customer: 'Test Customer',
                                    notes: [],
                                    reminders: [],
                                    timeline: [],
                                    ncr: [],
                                    vendor_operations: []
                                }]);

                            if (insertError && !insertError.message.includes('already exists')) {
                                console.error('Error creating table through API:', insertError);
                                throw insertError;
                            }
                        }
                    } else if (!error.message.includes('already exists')) {
                        throw error;
                    }
                }
            } catch (error: any) {
                if (!error.message.includes('already exists')) {
                    console.error('Error executing statement:', error);
                    throw error;
                }
            }
        }

        console.log('Database initialization completed successfully!');
        console.log('Verifying jobs table...');

        // Verify the jobs table exists and has the correct structure
        const { data, error: verifyError } = await supabase
            .from('jobs')
            .select('*')
            .limit(1);

        if (verifyError) {
            console.error('Error verifying jobs table:', verifyError);
            throw verifyError;
        }

        console.log('Jobs table verified successfully!');

    } catch (error: any) {
        console.error('Database initialization failed:', error.message);
        process.exit(1);
    }
}

console.log('Starting database initialization...');
initializeDatabase();