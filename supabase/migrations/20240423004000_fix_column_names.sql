-- Drop and recreate sap_operations table with proper column names
DROP TABLE IF EXISTS public.sap_operations;

CREATE TABLE public.sap_operations (
    id bigint primary key generated always as identity,
    order_number text not null,
    operation_number text not null,
    work_center text,
    description text,
    short_text text,
    planned_work numeric(10,2) default 0,
    actual_work numeric(10,2) default 0,
    status text default 'Pending',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint sap_operations_order_operation_key unique (order_number, operation_number)
);