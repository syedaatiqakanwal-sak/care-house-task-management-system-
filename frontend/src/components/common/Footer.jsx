export function Footer({ variant = "default" }) {
  const overlay = variant === "overlay";
  return (
    <footer className={`w-full border-t py-4 mt-auto ${overlay ? "border-white/20 bg-black/30" : "border-gray-200 dark:border-gray-800"}`}>
      <div className={`max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm ${overlay ? "text-white/80" : "text-gray-500"}`}>
        <span className="font-semibold tracking-wide">
          <span className="text-teal-700">Lets</span> Care All
        </span>
        <span className="flex items-center gap-1">
          Developed with <span className="text-red-500">♥</span> by
          <span className={`font-medium ${overlay ? "text-white" : "text-gray-700 dark:text-gray-200"}`}>
            Syeda Atiqa Kanwal
          </span>
        </span>
        <span>© {new Date().getFullYear()} All rights reserved</span>
      </div>
    </footer>
  );
}
