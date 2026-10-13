export function EmptyState({ icon = "○", title, hint, actionLabel, onAction }: { icon?: string; title: string; hint?: string; actionLabel?: string; onAction?: () => void }) {
  return <div className="empty-hint"><span>{icon}</span><strong>{title}</strong>{hint ? <p>{hint}</p> : null}{actionLabel && onAction ? <button type="button" className="primary-button" onClick={onAction}>{actionLabel}</button> : null}</div>;
}
