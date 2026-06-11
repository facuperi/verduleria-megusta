export const EmptyState = ({ title, description, icon = '📭', action }) => {
  return (
    <div className="text-center py-12">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-secondary mb-1">{title}</h3>
      {description && <p className="text-sm text-muted mb-4">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 text-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};