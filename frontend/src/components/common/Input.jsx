export function Input({ label, labelClassName = "", className = "", id, ...props }) {
  const inputId = id || props.name || undefined;
  const inputEl = (
    <input
      id={inputId}
      className={`w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-gray-700 dark:bg-gray-900 ${className}`}
      {...props}
    />
  );
  if (!label) return inputEl;
  return (
    <label htmlFor={inputId} className="block">
      <span className={`mb-1 block text-sm text-gray-700 dark:text-gray-300 ${labelClassName}`}>{label}</span>
      {inputEl}
    </label>
  );
}

export function Textarea({ className = "", ...props }) {
  return (
    <textarea
      className={`w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-gray-700 dark:bg-gray-900 ${className}`}
      {...props}
    />
  );
}

export function Select({ className = "", children, ...props }) {
  return (
    <select
      className={`w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-gray-700 dark:bg-gray-900 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
