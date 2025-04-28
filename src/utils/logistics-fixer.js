/**
 * Logistics Data Fixer Script
 * 
 * This script can be run from the browser console to fix missing data in the logistics page.
 * 
 * Usage:
 * 1. Open your logistics page
 * 2. Open the browser console (F12 or right-click -> Inspect -> Console)
 * 3. Copy and paste this entire script and press Enter
 * 4. Run the fixLogisticsData() function in the console
 * 5. Refresh the page after the script completes
 */

async function fixLogisticsData() {
  console.log("Starting logistics data fix...");
  
  // Get database clients
  const supabaseUrl = document.querySelector('meta[name="supabase-url"]')?.content;
  const supabaseKey = document.querySelector('meta[name="supabase-anon-key"]')?.content;
  const supabaseServiceKey = document.querySelector('meta[name="supabase-service-role-key"]')?.content;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error("Could not find Supabase configuration. Please run this on a page with Supabase initialized.");
    return false;
  }
  
  // Create Supabase client
  const { createClient } = supabase;
  const client = createClient(supabaseUrl, supabaseKey);
  const serviceClient = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : client;
  
  // 1. Get all jobs
  const { data: jobs, error: jobsError } = await serviceClient
    .from('jobs')
    .select('id, job_number');
    
  if (jobsError) {
    console.error('Error getting jobs:', jobsError);
    return false;
  }
  
  console.log(`Found ${jobs?.length || 0} jobs`);
  
  // 2. Get all purchase orders
  const { data: purchaseOrders, error: poError } = await serviceClient
    .from('purchase_orders')
    .select('*');
    
  if (poError) {
    console.error('Error getting purchase orders:', poError);
    return false;
  }
  
  console.log(`Found ${purchaseOrders?.length || 0} purchase orders`);
  
  // 3. Link POs to jobs
  const jobMap = {};
  jobs.forEach(job => {
    jobMap[job.job_number] = job.id;
  });
  
  let linkedCount = 0;
  for (const po of purchaseOrders) {
    // Skip if PO already has a job_id
    if (po.job_id) continue;
    
    // Try to find a matching job
    const poText = [po.po_number, po.notes, po.description, po.vendor].filter(Boolean).join(' ').toLowerCase();
    
    for (const job of jobs) {
      if (poText.includes(job.job_number.toLowerCase())) {
        // Update PO with job_id
        const { error: updateError } = await serviceClient
          .from('purchase_orders')
          .update({ job_id: job.id })
          .eq('id', po.id);
          
        if (!updateError) {
          linkedCount++;
          break;
        }
      }
    }
  }
  
  console.log(`Linked ${linkedCount} purchase orders to jobs`);
  
  // 4. Generate vendor operations
  const { data: vendorOps, error: vendorOpsError } = await serviceClient
    .from('vendor_operations')
    .select('count');
    
  if (vendorOpsError || !vendorOps || vendorOps.count === 0) {
    // Create vendor operations from purchase orders
    const vendorOperations = purchaseOrders
      .filter(po => po.job_id)
      .map((po, index) => ({
        id: index + 1,
        job_id: po.job_id,
        operation: po.description || `PO ${po.po_number}`,
        vendor: po.vendor,
        date_range: `${po.issue_date?.substring(0, 10) || 'Unknown'} to ${po.expected_date?.substring(0, 10) || 'Unknown'}`,
        status: po.status,
        notes: po.notes
      }));
      
    if (vendorOperations.length > 0) {
      const { error: insertError } = await serviceClient
        .from('vendor_operations')
        .insert(vendorOperations);
        
      console.log(`Created ${vendorOperations.length} vendor operations`);
      
      if (insertError) {
        console.error('Error creating vendor operations:', insertError);
      }
    }
  } else {
    console.log('Vendor operations already exist');
  }
  
  // 5. Get shipment logs
  const { data: shipmentLogs, error: shipmentLogsError } = await serviceClient
    .from('shipmentlogs')
    .select('*');
    
  if (!shipmentLogsError) {
    console.log(`Found ${shipmentLogs?.length || 0} shipment logs`);
  }
  
  // 6. Generate job timelines
  const jobTimelines = {};
  jobs.forEach(job => {
    jobTimelines[job.id] = [];
  });
  
  // Add PO events to timelines
  for (const po of purchaseOrders) {
    if (po.job_id && jobTimelines[po.job_id]) {
      jobTimelines[po.job_id].push({
        date: po.issue_date || new Date().toISOString(),
        title: 'Purchase Order Created',
        description: `PO ${po.po_number} for ${po.vendor} created`,
        status: 'completed'
      });
    }
  }
  
  // Update jobs with timelines
  let timelineUpdates = 0;
  for (const [jobId, timeline] of Object.entries(jobTimelines)) {
    if (timeline.length > 0) {
      const { error: updateError } = await serviceClient
        .from('jobs')
        .update({ timeline })
        .eq('id', jobId);
        
      if (!updateError) {
        timelineUpdates++;
      }
    }
  }
  
  console.log(`Updated ${timelineUpdates} jobs with timelines`);
  console.log("Logistics data fix complete! Please refresh the page.");
  
  return true;
}

// Print usage instructions
console.log('Logistics data fixer loaded. Run fixLogisticsData() to fix missing data.');
console.log('After completion, refresh the page to see changes.'); 