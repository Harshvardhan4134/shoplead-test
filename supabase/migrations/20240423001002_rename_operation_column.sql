-- Drop and recreate the sap_operations table with renamed column
drop table if exists public.sap_operations;

create table public.sap_operations (
    id bigint primary key generated always as identity,
    "Order" text not null,
    operation_number text,
    "Oper.WorkCenter" text,
    "Description" text,
    "Opr. short text" text,
    "Work" numeric(10,2),
    actual_work numeric(10,2),
    status text check (status in ('Pending', 'Not Started', 'In Progress', 'Complete')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);