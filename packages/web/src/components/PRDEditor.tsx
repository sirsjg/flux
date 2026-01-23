import { useState, useEffect } from 'preact/hooks'
import { ConfirmModal } from './ConfirmModal'
import { Modal } from './Modal'
import type { PRD, Requirement, BusinessRule, Dependency } from '@flux/shared'

interface PRDEditorProps {
  prd: PRD | null
  loading: boolean
  saving: boolean
  projectName: string
  onSave: (prd: PRD) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
}

type Section = 'summary' | 'requirements' | 'rules' | 'questions' | 'phases' | 'risks'

const emptyPRD = (): PRD => ({
  problem: '',
  goals: [],
  requirements: [],
  approach: '',
  phases: [],
  risks: [],
  outOfScope: [],
  successCriteria: [],
  businessRules: [],
  openQuestions: [],
  dependencies: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

function prdToMarkdown(projectName: string, prd: PRD): string {
  const lines: string[] = []
  lines.push(`# PRD: ${projectName}`)
  lines.push('')

  if (prd.sourceUrl) {
    lines.push(`**Source:** [${prd.sourceUrl}](${prd.sourceUrl})`)
    lines.push('')
  }

  if (prd.summary) {
    lines.push('## Executive Summary')
    lines.push(prd.summary)
    lines.push('')
  }

  lines.push('## Problem Statement')
  lines.push(prd.problem)
  lines.push('')

  if (prd.goals.length) {
    lines.push('## Goals')
    prd.goals.forEach(g => lines.push(`- ${g}`))
    lines.push('')
  }

  if (prd.successCriteria?.length) {
    lines.push('## Success Criteria')
    prd.successCriteria.forEach(s => lines.push(`- ${s}`))
    lines.push('')
  }

  if (prd.businessRules?.length) {
    lines.push('## Business Rules')
    lines.push('')
    prd.businessRules.forEach(br => {
      const scope = br.scope ? ` _(${br.scope})_` : ''
      lines.push(`### ${br.id}${scope}`)
      lines.push(br.description)
      if (br.notes) lines.push(`> ${br.notes}`)
      lines.push('')
    })
  }

  if (prd.requirements.length) {
    lines.push('## Requirements')
    lines.push('')

    const mustReqs = prd.requirements.filter(r => r.priority === 'must')
    const shouldReqs = prd.requirements.filter(r => r.priority === 'should')
    const couldReqs = prd.requirements.filter(r => r.priority === 'could')

    if (mustReqs.length) {
      lines.push('### Must Have')
      mustReqs.forEach(r => {
        lines.push(`- **${r.id}** [${r.type}]: ${r.description}`)
        if (r.acceptance) lines.push(`  - _Acceptance_: ${r.acceptance}`)
      })
      lines.push('')
    }

    if (shouldReqs.length) {
      lines.push('### Should Have')
      shouldReqs.forEach(r => {
        lines.push(`- **${r.id}** [${r.type}]: ${r.description}`)
        if (r.acceptance) lines.push(`  - _Acceptance_: ${r.acceptance}`)
      })
      lines.push('')
    }

    if (couldReqs.length) {
      lines.push('### Could Have')
      couldReqs.forEach(r => {
        lines.push(`- **${r.id}** [${r.type}]: ${r.description}`)
        if (r.acceptance) lines.push(`  - _Acceptance_: ${r.acceptance}`)
      })
      lines.push('')
    }
  }

  if (prd.approach) {
    lines.push('## Technical Approach')
    lines.push(prd.approach)
    lines.push('')
  }

  if (prd.phases.length) {
    lines.push('## Phases')
    prd.phases.forEach(p => {
      lines.push(`### ${p.id}: ${p.name}`)
      if (p.requirements.length) lines.push(`Requirements: ${p.requirements.join(', ')}`)
      lines.push('')
    })
  }

  if (prd.dependencies?.length) {
    lines.push('## Dependencies')
    lines.push('')
    lines.push('| ID | Description | Owner | Status |')
    lines.push('|----|-------------|-------|--------|')
    prd.dependencies.forEach(d => {
      lines.push(`| ${d.id} | ${d.description} | ${d.owner || '-'} | ${d.status || 'unknown'} |`)
    })
    lines.push('')
  }

  if (prd.risks.length) {
    lines.push('## Risks')
    prd.risks.forEach(r => lines.push(`- ${r}`))
    lines.push('')
  }

  if (prd.openQuestions?.length) {
    lines.push('## Open Questions')
    lines.push('')
    prd.openQuestions.forEach(q => {
      const status = q.resolved ? '\u2713' : '?'
      const owner = q.owner ? ` _(${q.owner})_` : ''
      lines.push(`### ${status} ${q.id}${owner}`)
      lines.push(q.question)
      if (q.context) lines.push(`> Context: ${q.context}`)
      if (q.resolved) lines.push(`**Resolved:** ${q.resolved}`)
      lines.push('')
    })
  }

  if (prd.outOfScope.length) {
    lines.push('## Out of Scope')
    prd.outOfScope.forEach(o => lines.push(`- ${o}`))
    lines.push('')
  }

  if (prd.notes) {
    lines.push('## Session Notes')
    lines.push(prd.notes)
    lines.push('')
  }

  return lines.join('\n')
}

export function PRDEditor({ prd, loading, saving, projectName, onSave, onDelete, onClose }: PRDEditorProps) {
  const [expanded, setExpanded] = useState<Set<Section>>(new Set(['summary']))
  const [draft, setDraft] = useState<PRD>(emptyPRD())
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [showMarkdown, setShowMarkdown] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (prd) {
      setDraft({ ...prd })
    } else {
      setDraft(emptyPRD())
    }
  }, [prd])

  const toggle = (section: Section) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(section) ? next.delete(section) : next.add(section)
      return next
    })
  }

  const handleSave = async () => {
    await onSave({ ...draft, updatedAt: new Date().toISOString() })
  }

  const updateField = <K extends keyof PRD>(key: K, value: PRD[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  // List helpers
  const updateListItem = <T,>(list: T[], index: number, item: T) =>
    list.map((v, i) => (i === index ? item : v))

  const removeListItem = <T,>(list: T[], index: number) =>
    list.filter((_, i) => i !== index)

  const addGoal = () => updateField('goals', [...draft.goals, ''])
  const addSuccessCriteria = () => updateField('successCriteria', [...(draft.successCriteria || []), ''])
  const addRisk = () => updateField('risks', [...draft.risks, ''])
  const addOutOfScope = () => updateField('outOfScope', [...draft.outOfScope, ''])

  // Requirement helpers
  const addRequirement = () => {
    const id = `REQ-${String(draft.requirements.length + 1).padStart(3, '0')}`
    updateField('requirements', [...draft.requirements, { id, type: 'functional', description: '', priority: 'should' }])
  }

  // Business rule helpers
  const addBusinessRule = () => {
    const id = `BR-${String((draft.businessRules?.length || 0) + 1).padStart(2, '0')}`
    updateField('businessRules', [...(draft.businessRules || []), { id, description: '' }])
  }

  // Open question helpers
  const addQuestion = () => {
    const id = `Q-${String((draft.openQuestions?.length || 0) + 1).padStart(2, '0')}`
    updateField('openQuestions', [...(draft.openQuestions || []), { id, question: '' }])
  }

  const resolveQuestion = (index: number) => {
    const q = draft.openQuestions?.[index]
    if (!q) return
    updateField('openQuestions', updateListItem(draft.openQuestions!, index, {
      ...q,
      resolved: q.resolved ? '' : 'Resolved',
      resolvedAt: q.resolved ? undefined : new Date().toISOString(),
    }))
  }

  // Phase helpers
  const addPhase = () => {
    const id = `phase-${draft.phases.length + 1}`
    updateField('phases', [...draft.phases, { id, name: '', requirements: [] }])
  }

  // Dependency helpers
  const addDependency = () => {
    const id = `DEP-${String((draft.dependencies?.length || 0) + 1).padStart(2, '0')}`
    updateField('dependencies', [...(draft.dependencies || []), { id, description: '', status: 'unknown' }])
  }

  if (loading) {
    return (
      <div class="flex justify-center py-8">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  const isNew = !prd
  const unresolvedCount = draft.openQuestions?.filter(q => !q.resolved).length || 0

  return (
    <div class="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
      {/* Summary & Goals */}
      <div class="collapse collapse-arrow bg-base-200">
        <input type="checkbox" checked={expanded.has('summary')} onChange={() => toggle('summary')} />
        <div class="collapse-title font-medium">
          Problem & Goals
          {draft.problem && <span class="badge badge-sm badge-ghost ml-2">filled</span>}
        </div>
        <div class="collapse-content space-y-3">
          <div class="form-control">
            <label class="label py-1"><span class="label-text text-xs">Summary</span></label>
            <textarea
              class="textarea textarea-bordered textarea-sm w-full"
              placeholder="Executive summary..."
              rows={2}
              value={draft.summary || ''}
              onInput={e => updateField('summary', (e.target as HTMLTextAreaElement).value)}
            />
          </div>
          <div class="form-control">
            <label class="label py-1"><span class="label-text text-xs">Problem Statement *</span></label>
            <textarea
              class="textarea textarea-bordered textarea-sm w-full"
              placeholder="What problem are we solving?"
              rows={2}
              value={draft.problem}
              onInput={e => updateField('problem', (e.target as HTMLTextAreaElement).value)}
            />
          </div>
          <div class="form-control">
            <label class="label py-1"><span class="label-text text-xs">Approach</span></label>
            <textarea
              class="textarea textarea-bordered textarea-sm w-full"
              placeholder="Technical approach..."
              rows={2}
              value={draft.approach}
              onInput={e => updateField('approach', (e.target as HTMLTextAreaElement).value)}
            />
          </div>
          <div class="form-control">
            <label class="label py-1">
              <span class="label-text text-xs">Goals</span>
              <button type="button" class="btn btn-ghost btn-xs" onClick={addGoal}>+ Add</button>
            </label>
            {draft.goals.map((g, i) => (
              <div key={i} class="flex gap-1 mb-1">
                <input
                  type="text"
                  class="input input-bordered input-sm flex-1"
                  value={g}
                  onInput={e => updateField('goals', updateListItem(draft.goals, i, (e.target as HTMLInputElement).value))}
                />
                <button type="button" class="btn btn-ghost btn-sm btn-square" onClick={() => updateField('goals', removeListItem(draft.goals, i))}>×</button>
              </div>
            ))}
          </div>
          <div class="form-control">
            <label class="label py-1">
              <span class="label-text text-xs">Success Criteria</span>
              <button type="button" class="btn btn-ghost btn-xs" onClick={addSuccessCriteria}>+ Add</button>
            </label>
            {(draft.successCriteria || []).map((c, i) => (
              <div key={i} class="flex gap-1 mb-1">
                <input
                  type="text"
                  class="input input-bordered input-sm flex-1"
                  placeholder="Measurable metric..."
                  value={c}
                  onInput={e => updateField('successCriteria', updateListItem(draft.successCriteria || [], i, (e.target as HTMLInputElement).value))}
                />
                <button type="button" class="btn btn-ghost btn-sm btn-square" onClick={() => updateField('successCriteria', removeListItem(draft.successCriteria || [], i))}>×</button>
              </div>
            ))}
          </div>
          <div class="form-control">
            <label class="label py-1"><span class="label-text text-xs">Source URL</span></label>
            <input
              type="url"
              class="input input-bordered input-sm w-full"
              placeholder="Miro/Figma/design doc link..."
              value={draft.sourceUrl || ''}
              onInput={e => updateField('sourceUrl', (e.target as HTMLInputElement).value)}
            />
          </div>
        </div>
      </div>

      {/* Requirements */}
      <div class="collapse collapse-arrow bg-base-200">
        <input type="checkbox" checked={expanded.has('requirements')} onChange={() => toggle('requirements')} />
        <div class="collapse-title font-medium">
          Requirements
          <span class="badge badge-sm badge-ghost ml-2">{draft.requirements.length}</span>
        </div>
        <div class="collapse-content">
          <div class="flex justify-end mb-2">
            <button type="button" class="btn btn-ghost btn-xs" onClick={addRequirement}>+ Add Requirement</button>
          </div>
          <div class="space-y-2">
            {draft.requirements.map((req, i) => (
              <div key={req.id} class="card card-compact bg-base-100 border border-base-300">
                <div class="card-body py-2 px-3">
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-xs text-base-content/60">{req.id}</span>
                    <select
                      class="select select-bordered select-xs"
                      value={req.priority}
                      onChange={e => updateField('requirements', updateListItem(draft.requirements, i, { ...req, priority: (e.target as HTMLSelectElement).value as Requirement['priority'] }))}
                    >
                      <option value="must">must</option>
                      <option value="should">should</option>
                      <option value="could">could</option>
                    </select>
                    <select
                      class="select select-bordered select-xs"
                      value={req.type}
                      onChange={e => updateField('requirements', updateListItem(draft.requirements, i, { ...req, type: (e.target as HTMLSelectElement).value as Requirement['type'] }))}
                    >
                      <option value="functional">functional</option>
                      <option value="non-functional">non-functional</option>
                      <option value="constraint">constraint</option>
                    </select>
                    <button type="button" class="btn btn-ghost btn-xs btn-square ml-auto" onClick={() => updateField('requirements', removeListItem(draft.requirements, i))}>×</button>
                  </div>
                  <input
                    type="text"
                    class="input input-bordered input-sm w-full"
                    placeholder="Requirement description..."
                    value={req.description}
                    onInput={e => updateField('requirements', updateListItem(draft.requirements, i, { ...req, description: (e.target as HTMLInputElement).value }))}
                  />
                  <input
                    type="text"
                    class="input input-bordered input-xs w-full"
                    placeholder="Acceptance criteria (optional)..."
                    value={req.acceptance || ''}
                    onInput={e => updateField('requirements', updateListItem(draft.requirements, i, { ...req, acceptance: (e.target as HTMLInputElement).value }))}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Business Rules */}
      <div class="collapse collapse-arrow bg-base-200">
        <input type="checkbox" checked={expanded.has('rules')} onChange={() => toggle('rules')} />
        <div class="collapse-title font-medium">
          Business Rules
          <span class="badge badge-sm badge-ghost ml-2">{draft.businessRules?.length || 0}</span>
        </div>
        <div class="collapse-content">
          <div class="flex justify-end mb-2">
            <button type="button" class="btn btn-ghost btn-xs" onClick={addBusinessRule}>+ Add Rule</button>
          </div>
          <div class="space-y-2">
            {(draft.businessRules || []).map((rule, i) => (
              <div key={rule.id} class="flex gap-2 items-start">
                <span class="font-mono text-xs text-base-content/60 pt-2">{rule.id}</span>
                <select
                  class="select select-bordered select-xs w-24"
                  value={rule.scope || ''}
                  onChange={e => updateField('businessRules', updateListItem(draft.businessRules || [], i, { ...rule, scope: (e.target as HTMLSelectElement).value as BusinessRule['scope'] || undefined }))}
                >
                  <option value="">scope</option>
                  <option value="mvp">mvp</option>
                  <option value="post-mvp">post-mvp</option>
                  <option value="tbc">tbc</option>
                </select>
                <input
                  type="text"
                  class="input input-bordered input-sm flex-1"
                  placeholder="Business rule..."
                  value={rule.description}
                  onInput={e => updateField('businessRules', updateListItem(draft.businessRules || [], i, { ...rule, description: (e.target as HTMLInputElement).value }))}
                />
                <button type="button" class="btn btn-ghost btn-sm btn-square" onClick={() => updateField('businessRules', removeListItem(draft.businessRules || [], i))}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Open Questions */}
      <div class="collapse collapse-arrow bg-base-200">
        <input type="checkbox" checked={expanded.has('questions')} onChange={() => toggle('questions')} />
        <div class="collapse-title font-medium">
          Open Questions
          {unresolvedCount > 0 && <span class="badge badge-sm badge-warning ml-2">{unresolvedCount} unresolved</span>}
          {unresolvedCount === 0 && (draft.openQuestions?.length || 0) > 0 && <span class="badge badge-sm badge-success ml-2">all resolved</span>}
        </div>
        <div class="collapse-content">
          <div class="flex justify-end mb-2">
            <button type="button" class="btn btn-ghost btn-xs" onClick={addQuestion}>+ Add Question</button>
          </div>
          <div class="space-y-2">
            {(draft.openQuestions || []).map((q, i) => (
              <div key={q.id} class={`card card-compact border ${q.resolved ? 'bg-base-100 border-base-300 opacity-60' : 'bg-warning/10 border-warning/30'}`}>
                <div class="card-body py-2 px-3">
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-xs text-base-content/60">{q.id}</span>
                    {q.resolved && <span class="badge badge-xs badge-success">resolved</span>}
                    <button
                      type="button"
                      class={`btn btn-xs ml-auto ${q.resolved ? 'btn-ghost' : 'btn-warning btn-outline'}`}
                      onClick={() => resolveQuestion(i)}
                    >
                      {q.resolved ? 'Reopen' : 'Resolve'}
                    </button>
                    <button type="button" class="btn btn-ghost btn-xs btn-square" onClick={() => updateField('openQuestions', removeListItem(draft.openQuestions || [], i))}>×</button>
                  </div>
                  <input
                    type="text"
                    class="input input-bordered input-sm w-full"
                    placeholder="Question..."
                    value={q.question}
                    onInput={e => updateField('openQuestions', updateListItem(draft.openQuestions || [], i, { ...q, question: (e.target as HTMLInputElement).value }))}
                  />
                  {q.resolved && (
                    <input
                      type="text"
                      class="input input-bordered input-xs w-full"
                      placeholder="Resolution..."
                      value={q.resolved}
                      onInput={e => updateField('openQuestions', updateListItem(draft.openQuestions || [], i, { ...q, resolved: (e.target as HTMLInputElement).value }))}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Phases */}
      <div class="collapse collapse-arrow bg-base-200">
        <input type="checkbox" checked={expanded.has('phases')} onChange={() => toggle('phases')} />
        <div class="collapse-title font-medium">
          Phases
          <span class="badge badge-sm badge-ghost ml-2">{draft.phases.length}</span>
        </div>
        <div class="collapse-content">
          <div class="flex justify-end mb-2">
            <button type="button" class="btn btn-ghost btn-xs" onClick={addPhase}>+ Add Phase</button>
          </div>
          <div class="space-y-2">
            {draft.phases.map((phase, i) => (
              <div key={phase.id} class="card card-compact bg-base-100 border border-base-300">
                <div class="card-body py-2 px-3">
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-xs text-base-content/60">{phase.id}</span>
                    <input
                      type="text"
                      class="input input-bordered input-sm flex-1"
                      placeholder="Phase name..."
                      value={phase.name}
                      onInput={e => updateField('phases', updateListItem(draft.phases, i, { ...phase, name: (e.target as HTMLInputElement).value }))}
                    />
                    <button type="button" class="btn btn-ghost btn-sm btn-square" onClick={() => updateField('phases', removeListItem(draft.phases, i))}>×</button>
                  </div>
                  <div class="text-xs text-base-content/60">
                    Link requirements: {draft.requirements.map(r => (
                      <label key={r.id} class="inline-flex items-center gap-1 mr-2">
                        <input
                          type="checkbox"
                          class="checkbox checkbox-xs"
                          checked={phase.requirements?.includes(r.id) || false}
                          onChange={e => {
                            const reqs = phase.requirements || []
                            const newReqs = (e.target as HTMLInputElement).checked
                              ? [...reqs, r.id]
                              : reqs.filter(id => id !== r.id)
                            updateField('phases', updateListItem(draft.phases, i, { ...phase, requirements: newReqs }))
                          }}
                        />
                        <span>{r.id}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Risks & Dependencies */}
      <div class="collapse collapse-arrow bg-base-200">
        <input type="checkbox" checked={expanded.has('risks')} onChange={() => toggle('risks')} />
        <div class="collapse-title font-medium">
          Risks & Dependencies
        </div>
        <div class="collapse-content space-y-3">
          <div class="form-control">
            <label class="label py-1">
              <span class="label-text text-xs">Risks</span>
              <button type="button" class="btn btn-ghost btn-xs" onClick={addRisk}>+ Add</button>
            </label>
            {draft.risks.map((r, i) => (
              <div key={i} class="flex gap-1 mb-1">
                <input
                  type="text"
                  class="input input-bordered input-sm flex-1"
                  value={r}
                  onInput={e => updateField('risks', updateListItem(draft.risks, i, (e.target as HTMLInputElement).value))}
                />
                <button type="button" class="btn btn-ghost btn-sm btn-square" onClick={() => updateField('risks', removeListItem(draft.risks, i))}>×</button>
              </div>
            ))}
          </div>
          <div class="form-control">
            <label class="label py-1">
              <span class="label-text text-xs">Out of Scope</span>
              <button type="button" class="btn btn-ghost btn-xs" onClick={addOutOfScope}>+ Add</button>
            </label>
            {draft.outOfScope.map((o, i) => (
              <div key={i} class="flex gap-1 mb-1">
                <input
                  type="text"
                  class="input input-bordered input-sm flex-1"
                  value={o}
                  onInput={e => updateField('outOfScope', updateListItem(draft.outOfScope, i, (e.target as HTMLInputElement).value))}
                />
                <button type="button" class="btn btn-ghost btn-sm btn-square" onClick={() => updateField('outOfScope', removeListItem(draft.outOfScope, i))}>×</button>
              </div>
            ))}
          </div>
          <div class="form-control">
            <label class="label py-1">
              <span class="label-text text-xs">Dependencies</span>
              <button type="button" class="btn btn-ghost btn-xs" onClick={addDependency}>+ Add</button>
            </label>
            {(draft.dependencies || []).map((dep, i) => (
              <div key={dep.id} class="flex gap-2 items-center mb-1">
                <span class="font-mono text-xs text-base-content/60">{dep.id}</span>
                <select
                  class="select select-bordered select-xs w-28"
                  value={dep.status || 'unknown'}
                  onChange={e => updateField('dependencies', updateListItem(draft.dependencies || [], i, { ...dep, status: (e.target as HTMLSelectElement).value as Dependency['status'] }))}
                >
                  <option value="unknown">unknown</option>
                  <option value="confirmed">confirmed</option>
                  <option value="blocked">blocked</option>
                </select>
                <input
                  type="text"
                  class="input input-bordered input-sm flex-1"
                  placeholder="Dependency description..."
                  value={dep.description}
                  onInput={e => updateField('dependencies', updateListItem(draft.dependencies || [], i, { ...dep, description: (e.target as HTMLInputElement).value }))}
                />
                <button type="button" class="btn btn-ghost btn-sm btn-square" onClick={() => updateField('dependencies', removeListItem(draft.dependencies || [], i))}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Session Notes */}
      <div class="form-control bg-base-200 rounded-lg p-3">
        <label class="label py-1">
          <span class="label-text text-xs font-medium">Session Notes</span>
          <span class="label-text-alt text-xs opacity-60">Agent decisions, blockers, learnings</span>
        </label>
        <textarea
          class="textarea textarea-bordered textarea-sm w-full font-mono text-xs"
          placeholder="Cross-session notes (typically added by agents via MCP)..."
          rows={4}
          value={draft.notes || ''}
          onInput={e => updateField('notes', (e.target as HTMLTextAreaElement).value)}
        />
      </div>

      {/* Actions */}
      <div class="modal-action pt-4 border-t border-base-300">
        {!isNew && (
          <button type="button" class="btn btn-error btn-outline btn-sm" onClick={() => setDeleteConfirm(true)} disabled={saving}>
            Delete PRD
          </button>
        )}
        {!isNew && (
          <button type="button" class="btn btn-ghost btn-sm" onClick={() => setShowMarkdown(true)}>
            View Markdown
          </button>
        )}
        <div class="flex-1" />
        <button type="button" class="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          onClick={handleSave}
          disabled={saving || !draft.problem.trim()}
        >
          {saving ? <span class="loading loading-spinner loading-sm"></span> : (isNew ? 'Create PRD' : 'Save PRD')}
        </button>
      </div>

      <ConfirmModal
        isOpen={deleteConfirm}
        title="Delete PRD?"
        description="This will remove the PRD from this project. Tasks linked to requirements will be unlinked."
        confirmLabel="Delete"
        confirmClassName="btn-error"
        onConfirm={async () => {
          await onDelete()
          setDeleteConfirm(false)
        }}
        onClose={() => setDeleteConfirm(false)}
        isLoading={saving}
      />

      <Modal
        isOpen={showMarkdown}
        onClose={() => { setShowMarkdown(false); setCopied(false) }}
        title="PRD Markdown"
        wide
      >
        <div class="relative">
          <div class="absolute top-2 right-2 flex gap-2">
            <button
              type="button"
              class="btn btn-sm btn-ghost"
              onClick={() => {
                navigator.clipboard.writeText(prdToMarkdown(projectName, draft))
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              type="button"
              class="btn btn-sm btn-primary"
              onClick={() => {
                const content = prdToMarkdown(projectName, draft)
                const blob = new Blob([content], { type: 'text/markdown' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `prd-${projectName.toLowerCase().replace(/\s+/g, '-')}.md`
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              Download
            </button>
          </div>
          <pre class="bg-base-200 p-4 rounded-lg overflow-auto max-h-[60vh] text-sm whitespace-pre-wrap">{prdToMarkdown(projectName, draft)}</pre>
        </div>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost btn-sm" onClick={() => { setShowMarkdown(false); setCopied(false) }}>Close</button>
        </div>
      </Modal>
    </div>
  )
}
