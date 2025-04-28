const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Environment variables VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createJobAttachmentsTable() {
  console.log('Setting up job_attachments table and storage bucket...');

  try {
    // Create the job_attachments table if it doesn't exist
    const { error: tableError } = await supabase.rpc('create_job_attachments_table', {});

    if (tableError) {
      // If RPC doesn't exist, try raw SQL
      const { error: sqlError } = await supabase.sql(`
        CREATE TABLE IF NOT EXISTS job_attachments (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          job_number TEXT NOT NULL,
          part_name TEXT NOT NULL,
          file_name TEXT NOT NULL,
          file_type TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          file_path TEXT NOT NULL,
          file_url TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_job_attachments_job_number ON job_attachments (job_number);
        CREATE INDEX IF NOT EXISTS idx_job_attachments_part_name ON job_attachments (part_name);
      `);

      if (sqlError) {
        console.error('Error creating table with SQL:', sqlError);
      } else {
        console.log('Created job_attachments table with SQL');
      }
    } else {
      console.log('Created job_attachments table with RPC');
    }

    // Create storage bucket
    const { data: bucketData, error: bucketError } = await supabase.storage.createBucket('job-documents', {
      public: true,
      fileSizeLimit: 10485760, // 10MB
    });

    if (bucketError) {
      if (bucketError.message.includes('already exists')) {
        console.log('Storage bucket job-documents already exists');
      } else {
        console.error('Error creating storage bucket:', bucketError);
      }
    } else {
      console.log('Created storage bucket job-documents');
    }

    console.log('Setup completed!');
  } catch (error) {
    console.error('Error during setup:', error);
  }
}

createJobAttachmentsTable(); 