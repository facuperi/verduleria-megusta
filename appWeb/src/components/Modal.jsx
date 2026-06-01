export const Modal = ({ open, onClose, title, children, noClose, className }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`bg-gray-800 rounded-lg shadow-lg w-full mx-4 ${className || 'max-w-md p-6'}`}>
        {title && (
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-100">{title}</h3>
            {!noClose && (
              <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-xl leading-none">&times;</button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
};
