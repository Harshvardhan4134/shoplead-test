-- Drop existing table if it exists
drop table if exists public.sap_operations;

-- Create SAP operations table with proper column types
create table if not exists public.sap_operations (
    id bigint primary key generated always as identity,
    sales_document text,
    list_name text,
    order_number text not null,
    operation_number text,
    work_center text,
    description text,
    short_text text,
    planned_work numeric(10,2) default 0,
    actual_work numeric(10,2) default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint sap_operations_order_operation_key unique (order_number, operation_number)
);