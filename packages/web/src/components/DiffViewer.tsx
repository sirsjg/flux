import type { JSX } from 'preact'
import { useState } from 'preact/hooks'
import { ChevronDownIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Button } from './Button'
import './DiffViewer.css'

export type DiffLineType = 'added' | 'removed' | 'unchanged'

export interface DiffLine {
  type: DiffLineType
  lineNumber?: number
  content: string
}

export interface DiffFile {
  filename: string
  lines: DiffLine[]
}

export interface DiffFileProps {
  file: DiffFile
  onDelete?: () => void
  defaultCollapsed?: boolean
}

export function DiffFileBlock({ file, onDelete, defaultCollapsed = false }: DiffFileProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  const getLineClass = (type: DiffLineType): string => {
    const typeMap = {
      added: 'diff-line-added',
      removed: 'diff-line-removed',
      unchanged: 'diff-line-unchanged',
    }
    return `diff-line ${typeMap[type]}`
  }

  return (
    <div className={`diff-file ${collapsed ? 'collapsed' : ''}`}>
      <div className="diff-file-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="diff-toggle-button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand' : 'Collapse'}
          >
            <ChevronDownIcon />
          </button>
          <span className="diff-file-name">{file.filename}</span>
        </div>
        {onDelete !== undefined && (
          <div className="diff-file-actions">
            <button className="diff-delete-button" onClick={onDelete}>
              <TrashIcon style={{ width: '12px', height: '12px', display: 'inline-block', marginRight: '4px' }} />
              Delete
            </button>
          </div>
        )}
      </div>
      <div className="diff-content">
        {file.lines.map((line, index) => (
          <div key={index} className={getLineClass(line.type)}>
            <div className="diff-line-number">{line.lineNumber ?? ''}</div>
            <div className="diff-line-content">{line.content}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export interface DiffViewerProps {
  files: DiffFile[]
  onDeleteFile?: (index: number) => void
  onExpandAll?: () => void
  onCollapseAll?: () => void
}

export function DiffViewer({ files, onDeleteFile, onExpandAll, onCollapseAll }: DiffViewerProps): JSX.Element {
  const [collapsedStates, setCollapsedStates] = useState<boolean[]>(
    files.map(() => false)
  )

  const handleExpandAll = (): void => {
    setCollapsedStates(files.map(() => false))
    onExpandAll?.()
  }

  const handleCollapseAll = (): void => {
    setCollapsedStates(files.map(() => true))
    onCollapseAll?.()
  }

  return (
    <div className="diff-viewer">
      <div className="diff-viewer-header">
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-high)' }}>
          {files.length} file{files.length !== 1 ? 's' : ''} changed
        </div>
        <div className="diff-viewer-controls">
          <Button variant="ghost" size="small" onClick={handleExpandAll}>
            Expand All
          </Button>
          <Button variant="ghost" size="small" onClick={handleCollapseAll}>
            Collapse All
          </Button>
        </div>
      </div>

      {files.map((file, index) => (
        <DiffFileBlock
          key={index}
          file={file}
          onDelete={onDeleteFile !== undefined ? () => onDeleteFile(index) : undefined}
          defaultCollapsed={collapsedStates[index] ?? false}
        />
      ))}
    </div>
  )
}
