export function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row justify-between items-center text-sm text-slate-500 gap-2">
        <p>© {new Date().getFullYear()} BookFlow Platform. All rights reserved.</p>
        <p className="text-xs text-slate-400">
          V1 Foundation — Production-Minded SaaS Architecture
        </p>
      </div>
    </footer>
  );
}
