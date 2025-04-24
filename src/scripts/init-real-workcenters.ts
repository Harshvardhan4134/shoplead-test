import { db } from '@/lib/db';

async function initializeRealWorkCenters() {
    try {
        console.log('Updating work centers from SAP operations...');

        // Clear existing work centers
        const { error: truncateError } = await supabase
            .from('work_centers')
            .delete();

        if (truncateError) throw truncateError;

        // Generate new work centers from real data
        const success = await db.updateWorkCentersFromOperations();

        if (success) {
            console.log('Work centers updated successfully with real data!');
        } else {
            console.error('Failed to update work centers');
        }

    } catch (error) {
        console.error('Error initializing real work centers:', error);
        process.exit(1);
    }
}

initializeRealWorkCenters();