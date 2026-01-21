import type { JSX } from 'preact';
import { ComponentChildren } from 'preact';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ComponentChildren;
  toolbar?: ComponentChildren;
}

export function PageHeader({ title, description, actions, toolbar }: PageHeaderProps): JSX.Element {
  return (
    <div className="page-header">
      {/* Title Row */}
      <div className="page-title">
        <h1>{title}</h1>
        <div className="page-title-divider"></div>
      </div>

      {/* Description (optional) */}
      {description !== undefined && description !== "" && (
        <p className="text-text-medium" style={{ fontSize: '14px', lineHeight: '1.6', marginTop: '8px', marginBottom: '16px' }}>
          {description}
        </p>
      )}

      {/* Toolbar Row */}
      {(toolbar !== undefined || actions !== undefined) && (
        <div className="page-header-row">
          {toolbar !== undefined && <div className="toolbar">{toolbar}</div>}
          {actions !== undefined && <div style={{ marginLeft: 'auto' }}>{actions}</div>}
        </div>
      )}
    </div>
  );
}
