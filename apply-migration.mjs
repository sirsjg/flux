import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const url = process.env.SUPABASE_URL || 'https://ucdppllyjoirmgewuude.supabase.co';
const key = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjZHBwbGx5am9pcm1nZXd1dWRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4OTgyNzIsImV4cCI6MjA4NDQ3NDI3Mn0.olVYw1a6lW0Qc9Nq-sGByzHe0ZhfHwhXodpGfmq00gE';

const supabase = createClient(url, key);

const sql = readFileSync('packages/shared/migrations/supabase/003_project_metadata.sql', 'utf-8');

console.log('Applying migration 003_project_metadata.sql...');

// Note: Supabase JS client doesn't support raw SQL with DDL statements
// We need to use the REST API or run this via Supabase SQL Editor
console.log('\nMigration SQL:');
console.log('---');
console.log(sql);
console.log('---');
console.log('\nTo apply this migration:');
console.log('1. Go to: https://supabase.com/dashboard/project/ucdppllyjoirmgewuude/sql/new');
console.log('2. Paste the SQL above');
console.log('3. Click "Run"');
