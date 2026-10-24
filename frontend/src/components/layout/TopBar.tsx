import { useState, useRef, useEffect } from "react";
import {
  Menu,
  Search,
  MessageSquare,
  Bell,
  Sun,
  Moon,
  X,
  Check,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export interface TopBarProps {
  onToggleSidebar: () => void;
}

export function TopBar({ onToggleSidebar }: TopBarProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("theme");
    if (stored) return stored === "dark";
    return (
      document.documentElement.classList.contains("dark") ||
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  });

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
      return next;
    });
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global Ctrl+K shortcut listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowSearchModal((prev) => !prev);
      }
      if (e.key === "Escape") {
        setShowSearchModal(false);
        setShowFeedbackModal(false);
        setShowNotifications(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Auto-focus search input when search modal opens
  useEffect(() => {
    if (showSearchModal) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [showSearchModal]);

  function handleSendFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    setFeedbackSent(true);
    setTimeout(() => {
      setFeedbackSent(false);
      setFeedbackText("");
      setShowFeedbackModal(false);
    }, 1500);
  }

  return (
    <>
      <header className="h-14 bg-white border-b border-[#E7E7E4] px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
        {/* Left: Mobile Toggle & Search */}
        <div className="flex items-center gap-3 flex-1 max-w-md">
          {/* Sidebar Toggle for Mobile & Tablet */}
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-lg text-[#6B6B6B] hover:text-[#18181B] hover:bg-[#EFEEEB] focus:outline-none focus:ring-2 focus:ring-[#111111]"
            aria-label="Open sidebar navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Quick Search Trigger */}
          <div
            onClick={() => setShowSearchModal(true)}
            className="hidden sm:flex items-center justify-between w-full max-w-sm px-3 py-1.5 rounded-lg border border-[#E7E7E4] bg-[#FAFAF8] hover:bg-white hover:border-[#D4D4D0] cursor-pointer text-xs text-[#6B6B6B] transition-all shadow-2xs select-none"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setShowSearchModal(true);
            }}
          >
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-[#6B6B6B]" />
              <span>Search workspace or commands...</span>
            </div>
            <kbd className="px-1.5 py-0.5 rounded bg-white text-[#18181B] font-mono text-[10px] border border-[#E7E7E4] shadow-2xs">
              Ctrl K
            </kbd>
          </div>
        </div>

        {/* Right: Actions (Feedback, Notification, Theme, User) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile Search Button */}
          <button
            onClick={() => setShowSearchModal(true)}
            className="sm:hidden p-2 rounded-lg text-[#6B6B6B] hover:text-[#18181B] hover:bg-[#EFEEEB]"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Feedback Action */}
          <button
            onClick={() => setShowFeedbackModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#6B6B6B] hover:text-[#18181B] hover:bg-[#EFEEEB] border border-transparent hover:border-[#E7E7E4] transition-all"
            title="Send Feedback"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Feedback</span>
          </button>

          {/* Notifications Dropdown Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-lg text-[#6B6B6B] hover:text-[#18181B] hover:bg-[#EFEEEB] transition-colors relative"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#285943]" />
            </button>

            {/* Notifications Popover */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white border border-[#E7E7E4] shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-[#E7E7E4]">
                  <span className="text-xs font-semibold text-[#18181B]">
                    Notifications
                  </span>
                  <span className="text-[10px] text-[#2563EB] font-medium">
                    All caught up
                  </span>
                </div>
                <div className="py-6 text-center text-xs text-[#6B6B6B]">
                  No unread notifications at this time.
                </div>
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-[#6B6B6B] hover:text-[#18181B] hover:bg-[#EFEEEB] transition-colors cursor-pointer"
            title={isDarkMode ? "Switch to light theme" : "Switch to dark theme"}
            aria-label="Toggle theme appearance"
          >
            {isDarkMode ? (
              <Sun className="h-4 w-4 text-amber-500" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>

          {/* User Avatar Circle */}
          {user && (
            <div className="h-7 w-7 rounded-full bg-[#111111] text-white flex items-center justify-center font-bold text-xs uppercase shadow-2xs">
              {user.name ? user.name.charAt(0) : user.email.charAt(0)}
            </div>
          )}
        </div>
      </header>

      {/* Ctrl+K Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-xl border border-[#E7E7E4] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-3 border-b border-[#E7E7E4] flex items-center gap-3">
              <Search className="h-4 w-4 text-[#6B6B6B] shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search businesses, appointments, services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-sm text-[#18181B] placeholder-[#6B6B6B] outline-none bg-transparent"
              />
              <button
                onClick={() => setShowSearchModal(false)}
                className="p-1 rounded text-[#6B6B6B] hover:text-[#18181B] hover:bg-[#EFEEEB]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 text-xs text-[#6B6B6B] space-y-2">
              <div className="font-semibold text-[#18181B] uppercase tracking-wider text-[10px]">
                Quick Navigation
              </div>
              <div className="space-y-1">
                <a
                  href="/businesses"
                  onClick={() => setShowSearchModal(false)}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#EFEEEB] text-[#18181B]"
                >
                  <span>Browse All Businesses</span>
                  <span className="text-[11px] text-[#6B6B6B]">/businesses</span>
                </a>
                {user?.role === "business_owner" && (
                  <a
                    href="/owner"
                    onClick={() => setShowSearchModal(false)}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#EFEEEB] text-[#18181B]"
                  >
                    <span>Owner Dashboard</span>
                    <span className="text-[11px] text-[#6B6B6B]">/owner</span>
                  </a>
                )}
                {user?.role === "platform_admin" && (
                  <a
                    href="/admin"
                    onClick={() => setShowSearchModal(false)}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#EFEEEB] text-[#18181B]"
                  >
                    <span>Admin Overview</span>
                    <span className="text-[11px] text-[#6B6B6B]">/admin</span>
                  </a>
                )}
              </div>
            </div>

            <div className="px-4 py-2 bg-[#FAFAF8] border-t border-[#E7E7E4] flex items-center justify-between text-[11px] text-[#6B6B6B]">
              <span>Navigation commands</span>
              <span>Press Esc to exit</span>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Dialog */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl border border-[#E7E7E4] shadow-2xl p-6 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E7E4]">
              <h3 className="font-semibold text-sm text-[#18181B]">
                Send Platform Feedback
              </h3>
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="p-1 rounded text-[#6B6B6B] hover:text-[#18181B]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {feedbackSent ? (
              <div className="py-8 text-center space-y-2">
                <div className="h-10 w-10 mx-auto rounded-full bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center">
                  <Check className="h-5 w-5" />
                </div>
                <div className="text-sm font-semibold text-[#18181B]">
                  Thank you!
                </div>
                <div className="text-xs text-[#6B6B6B]">
                  Your feedback has been noted for system improvement.
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendFeedback} className="mt-4 space-y-4">
                <p className="text-xs text-[#6B6B6B]">
                  Help us improve Goom Booking System. Tell us about your experience or report an issue.
                </p>
                <textarea
                  rows={4}
                  required
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="What would make Goom better for you?"
                  className="w-full text-xs p-3 rounded-lg border border-[#E7E7E4] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFeedbackModal(false)}
                    className="px-3 py-1.5 text-xs text-[#6B6B6B] hover:bg-[#EFEEEB] rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 text-xs bg-[#285943] text-white rounded-lg hover:bg-[#1E4332] font-medium transition-colors"
                  >
                    Submit
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
