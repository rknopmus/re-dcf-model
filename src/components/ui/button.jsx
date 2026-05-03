export function Button({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 ${className}`}
    >
      {children}
    </button>
  );
}
