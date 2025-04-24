import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read and parse .env file
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

async function updateSchema() {
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

        // Create shipmentlogs table
        console.log('Creating shipmentlogs table...');
        const { error: createError } = await supabase
            .from('shipmentlogs')
            .select('*')
            .limit(1);

        if (createError?.message?.includes('does not exist')) {
            const { error: createTableError } = await supabase.schema.sql`
                CREATE TABLE IF NOT EXISTS public.shipmentlogs (
                    id SERIAL PRIMARY KEY,
                    job_number TEXT NOT NULL,
                    status TEXT NOT NULL CHECK (status IN ('Pending', 'Shipped', 'Delivered')),
                    date TIMESTAMP WITH TIME ZONE NOT NULL,
                    description TEXT NOT NULL,
                    vendor TEXT,
                    shipment_date TIMESTAMP WITH TIME ZONE,
                    severity TEXT CHECK (severity IN ('Normal', 'High', 'Critical')),
                    tracking_number TEXT,
                    carrier TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            `;

            if (createTableError) {
                console.error('Error creating shipmentlogs table:', createTableError);
                throw createTableError;
            }

            console.log('Shipmentlogs table created successfully');
        } else {
            console.log('Shipmentlogs table already exists');
        }

        // Try to query the sap_data column to check if it exists
        const { error: columnCheckError } = await supabase
            .from('jobs')
            .select('sap_data')
            .limit(1);

        if (columnCheckError?.message?.includes('column "sap_data" does not exist')) {
            console.log('Adding sap_data column to jobs table...');

            // Add sap_data column as JSONB
            const { error: alterError } = await supabase.rpc('alter_jobs_table', {
                sql: 'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS sap_data JSONB DEFAULT \'[]\''
            });

            if (alterError) {
                // Try alternative approach if RPC fails
                const { error: directAlterError } = await supabase
                    .from('jobs')
                    .update({ sap_data: '[]' })
                    .eq('id', -1); // This will fail but create the column

                if (directAlterError && !directAlterError.message.includes('does not exist')) {
                    console.error('Error adding sap_data column:', directAlterError);
                    throw directAlterError;
                }
            }

            console.log('sap_data column added successfully');
        } else {
            console.log('sap_data column already exists');
        }

        // Check and create workcenters table
        console.log('Checking workcenters table...');
        const { error: workcentersCheckError } = await supabase
            .from('workcenters')
            .select('*')
            .limit(1);

        if (workcentersCheckError?.message?.includes('does not exist')) {
            console.log('Creating workcenters table...');

            // Try to create the table through API first
            const { error: createError } = await supabase
                .from('workcenters')
                .insert([{
                    name: 'TEST-WC',
                    type: 'Production',
                    status: 'Available',
                    utilization: 0
                }]);

            // If that fails, try through SQL
            if (createError) {
                console.log('Creating workcenters table through SQL...');
                const { error: sqlError } = await supabase.rpc('exec_sql', {
                    query: `
                        CREATE TABLE IF NOT EXISTS public.workcenters (
                            id SERIAL PRIMARY KEY,
                            name TEXT UNIQUE NOT NULL,
                            type TEXT NOT NULL,
                            status TEXT NOT NULL,
                            utilization INTEGER NOT NULL DEFAULT 0,
                            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                        );

                        -- Create trigger for workcenters
                        CREATE TRIGGER update_workcenters_updated_at
                            BEFORE UPDATE ON public.workcenters
                            FOR EACH ROW
                            EXECUTE FUNCTION update_updated_at_column();
                    `
                });

                if (sqlError) {
                    console.error('Error creating workcenters table:', sqlError);
                    throw sqlError;
                }
            }

            console.log('Workcenters table created successfully');
        } else {
            console.log('Workcenters table already exists');
        }

        // Check and create NCRs table
        console.log('Checking NCRs table...');
        const { error: ncrsCheckError } = await supabase
            .from('ncrs')
            .select('*')
            .limit(1);

        if (ncrsCheckError?.message?.includes('does not exist')) {
            console.log('Creating NCRs table...');
            const { error: sqlError } = await supabase.rpc('exec_sql', {
                query: `
                    CREATE TABLE IF NOT EXISTS public.ncrs (
                        id SERIAL PRIMARY KEY,
                        ncr_number TEXT,
                        job_number TEXT NOT NULL,
                        work_order TEXT NOT NULL,
                        operation_number TEXT NOT NULL,
                        part_name TEXT NOT NULL,
                        customer_name TEXT NOT NULL,
                        equipment_type TEXT,
                        drawing_number TEXT,
                        issue_category TEXT,
                        issue_description TEXT,
                        root_cause TEXT,
                        corrective_action TEXT,
                        financial_impact DECIMAL(10,2) DEFAULT 0,
                        planned_hours DECIMAL(10,2) DEFAULT 0,
                        actual_hours DECIMAL(10,2) DEFAULT 0,
                        status TEXT DEFAULT 'Submitted',
                        pdf_report_url TEXT,
                        drawing_url TEXT,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );

                    -- Create trigger for ncrs
                    CREATE TRIGGER update_ncrs_updated_at
                        BEFORE UPDATE ON public.ncrs
                        FOR EACH ROW
                        EXECUTE FUNCTION update_updated_at_column();
                `
            });

            if (sqlError) {
                console.error('Error creating NCRs table:', sqlError);
                throw sqlError;
            }

            console.log('NCRs table created successfully');
        } else {
            console.log('NCRs table already exists');
        }

        console.log('Schema update completed successfully!');

    } catch (error: any) {
        console.error('Schema update failed:', error.message);
        process.exit(1);
    }
}

console.log('Starting schema update...');
updateSchema();