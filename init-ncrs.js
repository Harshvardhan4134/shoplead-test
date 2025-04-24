#!/usr/bin/env ts-node
import { db } from './src/lib/db';

async function init() {
    try {
        await db.createNCRsTable();
        console.log('NCRs table created successfully');
    } catch (error) {
        console.error('Error creating NCRs table:', error);
        process.exit(1);
    }
}

init();