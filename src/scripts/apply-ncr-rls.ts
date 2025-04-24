import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function applyNCRPolicies() {
    try {
        console.log('Applying NCR RLS policies...');

        // Apply policies using rpc
        const { error } = await supabase.rpc('apply_ncr_policies');

        if (error) {
            throw error;
        }

        console.log('NCR RLS policies applied successfully!');
    } catch (error) {
        console.error('Error applying NCR RLS policies:', error);
    }
}

applyNCRPolicies();