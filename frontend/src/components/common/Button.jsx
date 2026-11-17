export function Button({ children, fullWidth, className = "", ...props }) {
  return (
    <button
      className={`rounded-xl bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
