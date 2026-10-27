export function EmptyState({ icon = "○", title, hint, actionLabel, onAction }: { icon?: string; title: string; hint?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="empty-hint">
      <div className="empty-art" aria-hidden="true"><i /><i /><i /><span>{icon}</span></div>
      <strong>{title}</strong>
      {hint ? <p>{hint}</p> : null}
      {actionLabel && onAction ? <button type="button" className="primary-button" onClick={onAction}>{actionLabel}</button> : null}
    </div>
  );
}
