# Instructions for Inserting Operations Data

Since we're encountering Row-Level Security (RLS) issues when trying to insert data programmatically, here's how to insert the operations data directly through the Supabase dashboard:

1. Log in to your Supabase dashboard at https://app.supabase.com/
2. Select your project
3. Go to the "Table Editor" in the left sidebar
4. Select the "sap_operations" table
5. Click "Insert row" button
6. Insert the following operations one by one:

## Operation 1
```json
{
  "order_number": "100575126",
  "operation_number": "0010",
  "work_center": "DNI",
  "description": "Dismantle pump and inspect",
  "short_text": "Dismantling & Inspection",
  "planned_work": 8.0,
  "actual_work": 4.0
}
```

## Operation 2
```json
{
  "order_number": "100575126",
  "operation_number": "0020",
  "work_center": "SR",
  "description": "Send pump shaft to vendor",
  "short_text": "Vendor - Shaft Repair",
  "planned_work": 24.0,
  "actual_work": 0.0
}
```

## Operation 3
```json
{
  "order_number": "100575126",
  "operation_number": "0030",
  "work_center": "NDE PMI",
  "description": "Non-destructive testing",
  "short_text": "NDE Testing",
  "planned_work": 4.0,
  "actual_work": 0.0
}
```

## Operation 4
```json
{
  "order_number": "100575126",
  "operation_number": "0040",
  "work_center": "SR",
  "description": "Send impeller to vendor",
  "short_text": "Vendor - Impeller Balance",
  "planned_work": 16.0,
  "actual_work": 0.0
}
```

## Operation 5
```json
{
  "order_number": "100575126",
  "operation_number": "0050",
  "work_center": "ASM",
  "description": "Reassemble pump with repaired parts",
  "short_text": "Reassembly",
  "planned_work": 12.0,
  "actual_work": 0.0
}
```

After inserting these operations, the job details should load correctly in your application.