-- Current MVP persistence table.
-- The application stores structured state in this JSONB row when DATABASE_URL is set.
-- The relational tables below document the target normalized production schema.
create table if not exists app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table departments (
  id text primary key,
  name text not null unique,
  email text not null
);

create table users (
  id text primary key,
  name text not null,
  email text not null unique,
  role text not null check (role in ('AP', 'DEPARTMENT')),
  department_id text references departments(id)
);

create table purchase_orders (
  id text primary key,
  po_number text not null,
  normalized_po_number text not null unique,
  vendor_name text not null,
  department_id text not null references departments(id),
  uploaded_at timestamptz not null default now()
);

create table invoice_files (
  id text primary key,
  invoice_id text not null,
  original_name text not null,
  stored_name text not null,
  storage_provider text not null default 'local',
  blob_url text,
  blob_pathname text,
  blob_access text,
  mime_type text not null,
  size_bytes integer not null,
  uploaded_at timestamptz not null default now()
);

create table invoices (
  id text primary key,
  vendor_name text not null default '',
  invoice_number text not null default '',
  invoice_date date,
  amount text not null default '',
  po_number text not null default '',
  date_received date,
  date_approved date,
  status text not null,
  department_id text references departments(id),
  department_decision text not null default '',
  file_id text not null references invoice_files(id),
  notification_sent_at timestamptz,
  ocr_summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table invoice_comments (
  id text primary key,
  invoice_id text not null references invoices(id),
  author text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table audit_events (
  id text primary key,
  invoice_id text references invoices(id),
  actor text not null,
  type text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index invoices_status_idx on invoices(status);
create index invoices_department_id_idx on invoices(department_id);
create index invoices_po_number_idx on invoices(po_number);
create index audit_events_invoice_id_idx on audit_events(invoice_id);
