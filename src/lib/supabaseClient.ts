import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ?? '';

// Validate environment variables
if (!supabaseUrl) {
    console.error('Missing VITE_SUPABASE_URL');
}
if (!supabaseAnonKey) {
    console.error('Missing VITE_SUPABASE_ANON_KEY');
}

// Initialize the Supabase client with correct values
export const supabase = createClient(
    supabaseUrl || 'https://rsgsjjskscipprjiaagk.supabase.co',
    supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzZ3NqanNrc2NpcHByamlhYWdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ1MTg2MzgsImV4cCI6MjA2MDA5NDYzOH0.VSbpjFULaWFlKpLS4b9-3tj6R-8O9RSOTVuBTwJTEXU'
);

// Create a client with the service role key for admin operations
export const serviceRoleClient = createClient(
    supabaseUrl || 'https://rsgsjjskscipprjiaagk.supabase.co',
    supabaseServiceRoleKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzZ3NqanNrc2NpcHByamlhYWdrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDUxODYzOCwiZXhwIjoyMDYwMDk0NjM4fQ.gEKeuQYkMebbfpL8EAwq3j74Jr2MBetXLukIqFVV0Zs'
);