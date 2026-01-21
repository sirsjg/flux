#!/usr/bin/env bun
/**
 * Automated ESLint fixer for common strict TypeScript patterns
 *
 * Fixes:
 * 1. strict-boolean-expressions: truthy/falsy → explicit checks
 * 2. prefer-nullish-coalescing: || → ??
 * 3. Adds explicit null/undefined checks
 */

import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';
import { join } from 'path';

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

interface Fix {
  file: string;
  line: number;
  original: string;
  fixed: string;
  rule: string;
}

const fixes: Fix[] = [];

function log(message: string): void {
  if (VERBOSE || DRY_RUN) {
    console.log(message);
  }
}

function applyFixes(content: string, filePath: string): string {
  let fixed = content;
  let changeCount = 0;

  // Fix 1: if (str) → if (str !== '')
  // Match: if (<identifier>)
  fixed = fixed.replace(
    /if\s+\(([a-zA-Z_$][a-zA-Z0-9_$]*)\)\s*\{/g,
    (match, varName) => {
      // Skip if it's already a comparison
      if (match.includes('===') || match.includes('!==') || match.includes('==') || match.includes('!=')) {
        return match;
      }
      changeCount++;
      return `if (${varName} !== '') {`;
    }
  );

  // Fix 2: Replace || with ?? for default values
  // Match: <expr> || <default>
  fixed = fixed.replace(
    /([a-zA-Z_$][a-zA-Z0-9_$\.]*)\s*\|\|\s*([^|;,)\n]+)/g,
    (match, expr, defaultValue) => {
      // Skip if already using ??
      if (match.includes('??')) {
        return match;
      }
      changeCount++;
      return `${expr} ?? ${defaultValue}`;
    }
  );

  // Fix 3: && checks → !== null
  // Match: <expr> && <expr>.<property>
  fixed = fixed.replace(
    /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*&&\s*\1\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
    (match, varName, property) => {
      changeCount++;
      return `${varName} !== null && ${varName}.${property}`;
    }
  );

  // Fix 4: Optional chaining suggestions
  // Match: obj && obj.prop → obj?.prop
  fixed = fixed.replace(
    /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*&&\s*\1\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
    (match, varName, property) => {
      changeCount++;
      return `${varName}?.${property}`;
    }
  );

  if (changeCount > 0) {
    log(`  ${filePath}: Applied ${changeCount} fixes`);
  }

  return fixed;
}

function processFile(filePath: string): void {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const fixed = applyFixes(content, filePath);

    if (content !== fixed) {
      if (!DRY_RUN) {
        writeFileSync(filePath, fixed, 'utf-8');
        log(`✓ Fixed ${filePath}`);
      } else {
        log(`[DRY RUN] Would fix ${filePath}`);
      }
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

function main(): void {
  console.log('🔧 ESLint Auto-Fixer');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'APPLY FIXES'}\n`);

  const srcDir = join(process.cwd(), 'src');
  const files = globSync('**/*.{ts,tsx}', {
    cwd: srcDir,
    absolute: true,
    ignore: ['**/*.test.ts', '**/*.test.tsx', '**/dist/**', '**/node_modules/**'],
  });

  console.log(`Found ${files.length} files to process\n`);

  files.forEach(processFile);

  console.log(`\n✨ Complete!`);
  console.log(`Processed ${files.length} files`);

  if (DRY_RUN) {
    console.log('\n⚠️  This was a dry run. Use without --dry-run to apply fixes.');
  }
}

main();
