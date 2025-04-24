import { createClient } from '@supabase/supabase-js';
import { read, utils } from 'xlsx';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function initializePurchaseOrders() {
    try {
        console.log('Initializing purchase orders...');

        const workbook = read('./PURCHASEORDERS.xlsx', { type: 'file' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = utils.sheet_to_json(worksheet);

        console.log('Found', rawData.length, 'purchase orders');
        console.log('Sample raw data:', rawData[0]);

        const purchaseOrders = rawData.map(row => ({
            purchasing_document: row['Purchasing Document']?.toString(),
            req_tracking_number: row['Req. Tracking Number']?.toString(),
            item: row['Item']?.toString(),
            purchasing_group: row['Purchasing Group']?.toString(),
            document_date: new Date(Math.round((row['Document Date'] - 25569) * 86400 * 1000)).toISOString(),
            vendor: row['Vendor/supplying plant']?.toString().split('     ')[1] || row['Vendor/supplying plant'],
            short_text: row['Short Text']?.toString(),
            order_quantity: row['Order Quantity'] || 0,
            net_price: row['Net price'] || 0,
            remaining_quantity: row['Still to be delivered (qty)'] || 0,
            remaining_value: row['Still to be delivered (value)'] || 0,
            material: row['Material']?.toString(),
            status: row['Deletion Indicator'] ? 'Cancelled' :
                row['Still to be delivered (qty)'] > 0 ? 'Open' : 'Completed'
        }));

        // Clear existing data
        console.log('Clearing existing purchase orders...');
        const { error: deleteError } = await supabase
            .from('purchase_orders')
            .delete()
            .neq('id', 0); // Delete all records

        if (deleteError) {
            console.error('Error clearing existing purchase orders:', deleteError);
            return;
        }

        // Batch insert purchase orders
        const BATCH_SIZE = 50;
        for (let i = 0; i < purchaseOrders.length; i += BATCH_SIZE) {
            const batch = purchaseOrders.slice(i, i + BATCH_SIZE);
            console.log(`Inserting purchase orders batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(purchaseOrders.length / BATCH_SIZE)}...`);

            const { error } = await supabase
                .from('purchase_orders')
                .insert(batch);

            if (error) {
                console.error('Error inserting purchase orders batch:', error);
                console.error('Sample problematic record:', batch[0]);
            }

            // Add a small delay between batches
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Verify the data
        const { data: poData } = await supabase.from('purchase_orders').select('*');
        console.log('\nCurrent data:');
        console.log('Purchase Orders:', poData?.length || 0);
        console.log('Sample purchase order:', poData?.[0]);

    } catch (error) {
        console.error('Error initializing purchase orders:', error);
        process.exit(1);
    }
}

initializePurchaseOrders();