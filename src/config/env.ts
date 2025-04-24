// Read environment variables based on context
const getEnvVars = () => {
  // For Node.js scripts
  if (typeof process !== 'undefined' && process.env) {
    return {
      supabaseUrl: process.env.VITE_SUPABASE_URL || '',
      supabaseKey: process.env.VITE_SUPABASE_ANON_KEY || ''
    };
  }

  // For Vite/browser context
  if (typeof import.meta !== 'undefined') {
    return {
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
      supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    };
  }

  return {
    supabaseUrl: '',
    supabaseKey: ''
  };
};

export const config = getEnvVars();

if (!config.supabaseUrl || !config.supabaseKey) {
  console.error('Missing Supabase configuration. Please check your environment variables.');
  throw new Error('Missing Supabase configuration');
}