-- Create purchase_orders table if it doesn't exist
CREATE TABLE IF NOT EXISTS purchase_orders (
    id BIGSERIAL PRIMARY KEY,
    purchasing_document TEXT,
    req_tracking_number TEXT,
    item TEXT,
    purchasing_group TEXT,
    document_date TIMESTAMP WITH TIME ZONE,
    vendor TEXT,
    short_text TEXT,
    order_quantity NUMERIC,
    net_price NUMERIC,
    remaining_quantity NUMERIC,
    remaining_value NUMERIC,
    material TEXT,
    status TEXT DEFAULT 'Open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint for purchase orders
ALTER TABLE purchase_orders 
ADD CONSTRAINT unique_po_item 
UNIQUE (purchasing_document, item);

-- Create shipmentlogs table if it doesn't exist
CREATE TABLE IF NOT EXISTS shipmentlogs (
    id BIGSERIAL PRIMARY KEY,
    tracking_number TEXT UNIQUE,
    carrier TEXT,
    shipment_date TIMESTAMP WITH TIME ZONE,
    expected_delivery TIMESTAMP WITH TIME ZONE,
    actual_delivery TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'In Transit',
    shipment_type TEXT,
    origin TEXT,
    destination TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);