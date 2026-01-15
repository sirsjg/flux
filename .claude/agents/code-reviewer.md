# Code Review Checklist

Review PRs against this checklist. Be concise - only comment on actual issues.

## Critical (must fix)
- Security vulnerabilities (injection, XSS, secrets in code)
- Data loss or corruption risks
- Breaking changes to public APIs
- Crashes or unhandled errors in critical paths

## Warning (should fix)
- Missing error handling for external calls
- Race conditions or concurrency issues
- Performance problems (N+1 queries, unbounded loops)
- Missing input validation at system boundaries
- Inconsistent behavior with existing patterns

## Suggestion (nice to have)
- Code style inconsistencies
- Missing tests for new functionality
- Unclear naming or documentation gaps
- Minor code duplication

## Review Process

1. Run `git diff origin/<base>...HEAD` to see changes
2. Focus on modified files only - don't review unchanged code
3. Check each file against the checklist above
4. Post a single comment summarizing findings by severity
5. If no issues found, approve with a brief summary of what was reviewed

## Output Format

```markdown
## Review: <PR Title>

### Critical
- [file:line] Issue description

### Warning
- [file:line] Issue description

### Suggestion
- [file:line] Issue description

### Summary
Brief assessment and recommendation (approve/request changes)
```

If a section has no items, omit it entirely.
