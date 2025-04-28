import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl);
if (!supabaseUrl || !supabaseKey) {
  console.error('Environment variables VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createJobAttachmentsTable() {
  console.log('Setting up job_attachments table and storage bucket...');

  try {
    // Create storage bucket first (this is simpler)
    console.log('Creating storage bucket...');
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

    // For direct SQL queries, we need to use a different approach through the Supabase Web UI
    console.log(`
====================================================
IMPORTANT: MANUAL STEPS REQUIRED
====================================================

1. Go to your Supabase project dashboard
2. Navigate to the "SQL Editor" section
3. Create a new query and paste the following SQL:

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

-- Storage policies
-- Allow public read access
CREATE POLICY "Allow public read access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'job-documents');

-- Allow authenticated uploads
CREATE POLICY "Allow authenticated uploads" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'job-documents');

-- Allow deletes
CREATE POLICY "Allow authenticated deletes" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'job-documents');

4. Execute the SQL query
5. Refresh your application

Alternatively, you can use the Supabase REST API with the service role key to execute these SQL commands.
====================================================
`);

    console.log('Storage bucket setup completed!');
    console.log('Please follow the instructions above to complete the table setup.');
  } catch (error) {
    console.error('Error during setup:', error);
  }
}

createJobAttachmentsTable(); 