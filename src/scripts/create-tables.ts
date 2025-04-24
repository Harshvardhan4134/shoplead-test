import { db } from '../lib/db';

async function createTables() {
    try {
        // Initialize jobs table
        await db.createJobsTable();
        console.log('Jobs table initialized');

        // Create NCRs table
        await db.createNCRsTable();
        console.log('NCRs table initialized');

        // Insert test work centers
        const testWorkCenters = [
            {
                name: "Machine Shop",
                type: "Manufacturing",
                status: "Active",
                utilization: 75
            },
            {
                name: "Assembly",
                type: "Production",
                status: "Active",
                utilization: 60
            },
            {
                name: "Quality Control",
                type: "Testing",
                status: "Active",
                utilization: 45
            }
        ];

        await db.upsertWorkCenters(testWorkCenters);
        console.log('Work centers initialized');

        console.log('Database initialization completed successfully!');
    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1);
    }
}

createTables();