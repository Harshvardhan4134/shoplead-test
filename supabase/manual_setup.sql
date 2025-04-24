-- Drop existing tables if they exist
drop table if exists public.sap_operations cascade;
drop table if exists public.workcenters cascade;
drop table if exists public.jobs cascade;

-- Create workcenters table
create table if not exists public.workcenters (
    id bigint primary key generated always as identity,
    name text unique not null,
    type text not null default 'Production',
    status text not null default 'Available',
    utilization numeric(5,2) default 0,
    created_at timestamptz default now()
);

-- Create jobs table
create table if not exists public.jobs (
    id bigint primary key generated always as identity,
    job_number text unique not null,
    title text,
    description text,
    status text default 'New',
    due_date timestamptz,
    scheduled_date timestamptz,
    priority text default 'Medium',
    progress numeric(5,2) default 0,
    work_center text references public.workcenters(name),
    customer text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Create SAP operations table
create table if not exists public.sap_operations (
    id bigint primary key generated always as identity,
    order_number text not null,
    operation_number text not null,
    work_center text references public.workcenters(name),
    description text,
    short_text text,
    planned_work numeric(10,2) default 0,
    actual_work numeric(10,2) default 0,
    status text default 'Pending',
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique(order_number, operation_number)
);

-- Add indexes for better performance
create index if not exists idx_workcenters_name on public.workcenters(name);
create index if not exists idx_jobs_work_center on public.jobs(work_center);
create index if not exists idx_jobs_status on public.jobs(status);
create index if not exists idx_sap_operations_work_center on public.sap_operations(work_center);
create index if not exists idx_sap_operations_order on public.sap_operations(order_number);

-- Insert sample work centers
insert into public.workcenters (name, type, status, utilization) values
    ('MILL', 'Production', 'Available', 60),
    ('PAINT', 'Production', 'Available', 40),
    ('SPOPN', 'Production', 'Available', 50),
    ('MACHINNG', 'Production', 'Available', 70),
    ('DRLPRESS', 'Production', 'Available', 45),
    ('KEY', 'Production', 'Available', 55),
    ('BUILD', 'Production', 'Available', 65),
    ('SANDBLAS', 'Production', 'Available', 50),
    ('DNI', 'Production', 'Available', 65),
    ('SR', 'Production', 'Available', 45),
    ('NDE PMI', 'Production', 'Available', 70),
    ('REP ENG', 'Production', 'Available', 55),
    ('NCR', 'Production', 'Available', 40),
    ('ASSEMBLY', 'Production', 'Available', 75),
    ('WELD', 'Production', 'Available', 80),
    ('HBM', 'Production', 'Available', 60),
    ('PLANER', 'Production', 'Available', 50),
    ('INSPECT', 'Production', 'Available', 85),
    ('CD', 'Production', 'Available', 70),
    ('HYDRO', 'Production', 'Available', 55),
    ('LATHE', 'Production', 'Available', 65),
    ('BALANCE', 'Production', 'Available', 75)
on conflict (name) do update set
    type = excluded.type,
    status = excluded.status,
    utilization = excluded.utilization;