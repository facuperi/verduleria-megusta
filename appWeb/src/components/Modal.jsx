export const Modal = ({ open, onClose, title, children, noClose, className }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-overlay flex items-center justify-center z-50">
      <div className={`bg-card rounded-lg shadow-lg w-full mx-4 ${className || 'max-w-md p-6'}`}>
        {title && (
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-body">{title}</h3>
            {!noClose && (
              <button onClick={onClose} className="text-muted hover:text-body text-xl leading-none">&times;</button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
};
