import { ComponentChildren } from 'preact';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ComponentChildren;
  toolbar?: ComponentChildren;
}

export function PageHeader({ title, description, actions, toolbar }: PageHeaderProps) {
  return (
    <div className="page-header">
      {/* Title Row */}
      <div className="page-title">
        <h1>{title}</h1>
        <div className="page-title-divider"></div>
      </div>

      {/* Description (optional) */}
      {description && (
        <p className="text-text-medium" style={{ fontSize: '14px', lineHeight: '1.6', marginTop: '8px', marginBottom: '16px' }}>
          {description}
        </p>
      )}

      {/* Toolbar Row */}
      {(toolbar || actions) && (
        <div className="page-header-row">
          {toolbar && <div className="toolbar">{toolbar}</div>}
          {actions && <div style={{ marginLeft: 'auto' }}>{actions}</div>}
        </div>
      )}
    </div>
  );
}
