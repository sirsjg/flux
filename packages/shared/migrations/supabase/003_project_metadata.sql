-- Add Shape-Up metadata fields to projects table
-- This migration adds the fields currently being mocked in the UI

-- Add metadata columns
ALTER TABLE projects ADD COLUMN ai_status VARCHAR(20) DEFAULT 'Idle';
ALTER TABLE projects ADD COLUMN risk_level VARCHAR(10) DEFAULT 'Green';
ALTER TABLE projects ADD COLUMN primary_phase VARCHAR(20) DEFAULT 'Shaping';
ALTER TABLE projects ADD COLUMN thrash_cuts INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN thrash_retries INTEGER DEFAULT 0;

-- Add constraints to match UI enums exactly
ALTER TABLE projects ADD CONSTRAINT check_ai_status
  CHECK (ai_status IN ('Idle', 'Running', 'Blocked', 'Failing'));

ALTER TABLE projects ADD CONSTRAINT check_risk_level
  CHECK (risk_level IN ('Green', 'Amber', 'Red'));

ALTER TABLE projects ADD CONSTRAINT check_primary_phase
  CHECK (primary_phase IN ('Shaping', 'Betting', 'Active', 'Shipped'));

-- Add indexes for common queries
CREATE INDEX idx_projects_ai_status ON projects(ai_status);
CREATE INDEX idx_projects_risk ON projects(risk_level);
CREATE INDEX idx_projects_phase ON projects(primary_phase);

-- Backfill existing projects with default values
UPDATE projects SET
  ai_status = 'Idle',
  risk_level = 'Green',
  primary_phase = 'Shaping',
  thrash_cuts = 0,
  thrash_retries = 0
WHERE ai_status IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN projects.ai_status IS 'AI agent status: Idle, Running, Blocked, or Failing';
COMMENT ON COLUMN projects.risk_level IS 'Project risk level: Green (healthy), Amber (warning), or Red (critical)';
COMMENT ON COLUMN projects.primary_phase IS 'Current Shape-Up phase: Shaping, Betting, Active, or Shipped';
COMMENT ON COLUMN projects.thrash_cuts IS 'Number of times epics/tasks were cut from project';
COMMENT ON COLUMN projects.thrash_retries IS 'Number of times work was restarted';
