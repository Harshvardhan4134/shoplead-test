-- SQL to create job_attachments table in Supabase

-- Create a table for job attachments
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

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_job_attachments_job_number ON job_attachments (job_number);
CREATE INDEX IF NOT EXISTS idx_job_attachments_part_name ON job_attachments (part_name);

-- Create storage bucket for job documents if it doesn't exist
-- This needs to be executed in the Supabase dashboard or API if not already created
-- INSERT INTO storage.buckets (id, name, public) VALUES ('job-documents', 'job-documents', true)
-- ON CONFLICT (id) DO NOTHING;

-- Add a policy to allow read access to the job-documents bucket
-- This needs to be executed in the Supabase dashboard or API
-- CREATE POLICY "Allow public read access" ON storage.objects FOR SELECT USING (bucket_id = 'job-documents');

-- Add a policy to allow authenticated users to upload to the job-documents bucket
-- This needs to be executed in the Supabase dashboard or API
-- CREATE POLICY "Allow authenticated uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'job-documents' AND auth.role() = 'authenticated');

-- Add a policy to allow authenticated users to update their own uploads
-- This needs to be executed in the Supabase dashboard or API
-- CREATE POLICY "Allow authenticated updates" ON storage.objects FOR UPDATE USING (bucket_id = 'job-documents' AND auth.role() = 'authenticated');

-- Add a policy to allow authenticated users to delete their own uploads
-- This needs to be executed in the Supabase dashboard or API
-- CREATE POLICY "Allow authenticated deletes" ON storage.objects FOR DELETE USING (bucket_id = 'job-documents' AND auth.role() = 'authenticated');

-- Create a function to automatically update updated_at column
CREATE OR REPLACE FUNCTION update_modified_column() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW; 
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to call the function
CREATE TRIGGER update_job_attachments_updated_at
BEFORE UPDATE ON job_attachments
FOR EACH ROW
EXECUTE FUNCTION update_modified_column(); 