import { useState } from "react";
import { Sparkles, X, Calendar, Store, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export function FloatingAction() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="fixed bottom-6 right-6 z-40 print:hidden">
      {isOpen && (
        <div className="mb-3 w-72 rounded-xl bg-white border border-[#E7E7E4] p-4 shadow-xl text-left animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-[#E7E7E4]">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-[#111111] text-white flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-semibold text-[#18181B]">
                Goom Quick Actions
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[#6B6B6B] hover:text-[#18181B] p-1 rounded-md hover:bg-[#EFEEEB]"
              aria-label="Close action menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 space-y-1">
            <Link
              to="/businesses"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-[#18181B] rounded-lg hover:bg-[#EFEEEB] transition-colors"
            >
              <Store className="h-3.5 w-3.5 text-[#6B6B6B]" />
              <span>Browse Businesses</span>
            </Link>

            {user?.role === "customer" && (
              <Link
                to="/my-bookings"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-[#18181B] rounded-lg hover:bg-[#EFEEEB] transition-colors"
              >
                <Calendar className="h-3.5 w-3.5 text-[#6B6B6B]" />
                <span>My Appointments</span>
              </Link>
            )}

            {user?.role === "business_owner" && (
              <Link
                to="/owner/bookings"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-[#18181B] rounded-lg hover:bg-[#EFEEEB] transition-colors"
              >
                <Calendar className="h-3.5 w-3.5 text-[#6B6B6B]" />
                <span>Business Appointments</span>
              </Link>
            )}

            {user?.role === "platform_admin" && (
              <Link
                to="/admin"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-[#18181B] rounded-lg hover:bg-[#EFEEEB] transition-colors"
              >
                <Shield className="h-3.5 w-3.5 text-[#6B6B6B]" />
                <span>Platform Admin</span>
              </Link>
            )}

            <div className="pt-2 mt-2 border-t border-[#E7E7E4] px-2.5 py-1 text-[11px] text-[#6B6B6B] flex items-center justify-between">
              <span>Search shortcut</span>
              <kbd className="px-1.5 py-0.5 rounded bg-[#EFEEEB] text-[#18181B] font-mono text-[10px] border border-[#E7E7E4]">
                Ctrl K
              </kbd>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-[#111111] text-white px-3.5 py-2.5 rounded-full shadow-lg hover:bg-[#27272A] active:scale-95 transition-all text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#111111] focus:ring-offset-2"
        aria-label="Toggle Goom quick actions"
        aria-expanded={isOpen}
      >
        <Sparkles className="h-4 w-4 text-amber-300" />
        <span>Quick Action</span>
      </button>
    </div>
  );
}
