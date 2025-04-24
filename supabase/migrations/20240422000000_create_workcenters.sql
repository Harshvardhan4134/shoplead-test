CREATE TABLE IF NOT EXISTS workcenters (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  utilization INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert initial work centers
INSERT INTO workcenters (name, type, status, utilization) VALUES
  ('Machine Shop', 'Manufacturing', 'Active', 65),
  ('Assembly', 'Manufacturing', 'Active', 45),
  ('Quality Control', 'Inspection', 'Active', 70),
  ('Paint Shop', 'Finishing', 'Active', 55),
  ('Welding', 'Manufacturing', 'Active', 80),
  ('Testing', 'Quality Assurance', 'Active', 40)
ON CONFLICT (name) DO UPDATE SET
  type = EXCLUDED.type,
  status = EXCLUDED.status,
  utilization = EXCLUDED.utilization;