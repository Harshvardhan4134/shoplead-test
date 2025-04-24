-- Enable RLS on job_operations table
ALTER TABLE public.job_operations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON public.job_operations
    FOR SELECT
    USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.job_operations
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON public.job_operations
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users" ON public.job_operations
    FOR DELETE
    USING (true);