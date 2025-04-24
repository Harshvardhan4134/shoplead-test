import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

// Initialize Supabase client
const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

function generateSampleShipmentLogs() {
    const carriers = ['FedEx', 'UPS', 'DHL', 'USPS', 'Freight Line A', 'Freight Line B'];
    const statuses = ['Scheduled', 'In Transit', 'Delivered', 'Delayed'];
    const shipmentTypes = ['Inbound', 'Outbound'];
    const logs = [];

    // Generate 50 sample shipment logs
    for (let i = 1; i <= 50; i++) {
        const shipmentDate = new Date();
        shipmentDate.setDate(shipmentDate.getDate() - Math.floor(Math.random() * 30)); // Random date within last 30 days

        const expectedDeliveryDate = new Date(shipmentDate);
        expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + Math.floor(Math.random() * 7) + 1); // 1-7 days after shipment

        const actualDeliveryDate = Math.random() > 0.3 ? new Date(expectedDeliveryDate) : null; // 70% chance of delivery
        if (actualDeliveryDate) {
            actualDeliveryDate.setDate(actualDeliveryDate.getDate() + Math.floor(Math.random() * 3) - 1); // -1 to +1 days from expected
        }

        const carrier = carriers[Math.floor(Math.random() * carriers.length)];
        const status = actualDeliveryDate ? 'Delivered' :
            shipmentDate > new Date() ? 'Scheduled' :
                statuses[Math.floor(Math.random() * (statuses.length - 1))];
        const shipmentType = shipmentTypes[Math.floor(Math.random() * shipmentTypes.length)];

        logs.push({
            tracking_number: `TRACK${String(i).padStart(5, '0')}`,
            carrier,
            shipment_date: shipmentDate.toISOString(),
            expected_delivery: expectedDeliveryDate.toISOString(),
            actual_delivery: actualDeliveryDate?.toISOString() || null,
            status,
            shipment_type: shipmentType,
            origin: shipmentType === 'Inbound' ? 'Vendor Warehouse' : 'Main Facility',
            destination: shipmentType === 'Inbound' ? 'Main Facility' : 'Customer Location',
            notes: status === 'Delayed' ? 'Shipment experiencing delays' : '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
    }

    return logs;
}

async function initializeShipmentLogs() {
    try {
        console.log('Initializing shipment logs...');

        // Generate sample data
        const shipmentLogs = generateSampleShipmentLogs();
        console.log('Generated', shipmentLogs.length, 'shipment logs');
        console.log('Sample shipment log:', shipmentLogs[0]);

        // Clear existing data
        console.log('Clearing existing shipment logs...');
        const { error: deleteError } = await supabase
            .from('shipmentlogs')
            .delete();

        if (deleteError) {
            console.error('Error clearing existing shipment logs:', deleteError);
            return;
        }

        // Batch insert shipment logs
        const BATCH_SIZE = 50;
        for (let i = 0; i < shipmentLogs.length; i += BATCH_SIZE) {
            const batch = shipmentLogs.slice(i, i + BATCH_SIZE);
            console.log(`Inserting shipment logs batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(shipmentLogs.length / BATCH_SIZE)}...`);

            const { error } = await supabase
                .from('shipmentlogs')
                .insert(batch);

            if (error) {
                console.error('Error inserting shipment logs batch:', error);
                console.error('Sample problematic record:', batch[0]);
            }
        }

        // Verify the data
        const { data: logsData } = await supabase.from('shipmentlogs').select('*');
        console.log('\nCurrent data:');
        console.log('Shipment Logs:', logsData?.length || 0);
        console.log('Sample shipment log:', logsData?.[0]);

    } catch (error) {
        console.error('Error initializing shipment logs:', error);
        process.exit(1);
    }
}

initializeShipmentLogs();