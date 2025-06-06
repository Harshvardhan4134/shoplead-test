-- Fix sap_operations table schema to match Excel format
DROP TABLE IF EXISTS public.sap_operations;

CREATE TABLE public.sap_operations (
    id bigint primary key generated always as identity,
    \
Order\ text not null,
    operation_number text not null,
    \Oper.WorkCenter\ text,
    \Description\ text,
    \Opr.
short
text\ text,
    \Work\ numeric(10,2) default 0,
    actual_work numeric(10,2) default 0,
    status text default 'Pending',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint sap_operations_order_operation_key unique (\Order\, operation_number)
);
