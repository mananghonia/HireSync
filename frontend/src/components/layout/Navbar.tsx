import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell, MessageCircle, LogOut, User, Briefcase,
  ChevronDown, LayoutDashboard, Sparkles, FileText,
  PlusCircle, ListChecks, BarChart2, Menu, X, CheckCheck,
} from "lucide-react";
import { logout } from "../../features/auth/authSlice";
import { useAuth } from "../../hooks/useAuth";
import api from "../../lib/axios";

const TYPE_ICONS: Record<string, string> = {
  application_status: "📋",
  new_application: "👤",
  application_withdrawn: "↩️",
  new_message: "💬",
  job_recommendation: "✨",
  general: "🔔",
};

function NotificationDropdown({ onClose, onCountChange }: { onClose: () => void; onCountChange: (n: number) => void }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications-popup"],
    queryFn: () => api.get("/notifications/?limit=8").then((r) => r.data.results ?? r.data),
    refetchOnWindowFocus: false,
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.post("/notifications/mark-all-read/"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-popup"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notif-unread-count"] });
      onCountChange(0);
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-popup"] });
      qc.invalidateQueries({ queryKey: ["notif-unread-count"] });
    },
  });

  const unread = data?.filter((n: any) => !n.is_read) ?? [];

  return (
    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-900">
          Notifications
          {unread.length > 0 && (
            <span className="ml-2 bg-primary-100 text-primary-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
              {unread.length} new
            </span>
          )}
        </span>
        {unread.length > 0 && (
          <button
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            className="flex items-center gap-1 text-xs text-primary-600 hover:underline disabled:opacity-50"
          >
            <CheckCheck className="w-3.5 h-3.5" /> Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-50">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="px-4 py-3 flex gap-3 animate-pulse">
              <div className="w-8 h-8 bg-gray-100 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-gray-100 rounded w-3/4" />
                <div className="h-2.5 bg-gray-100 rounded w-full" />
              </div>
            </div>
          ))
        ) : data?.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Bell className="w-8 h-8 mx-auto mb-2 text-gray-200" />
            <p className="text-xs">No notifications yet</p>
          </div>
        ) : (
          data?.map((n: any) => (
            <div
              key={n.id}
              onClick={() => {
                if (!n.is_read) markReadMutation.mutate(n.id);
              }}
              className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${!n.is_read ? "bg-blue-50 hover:bg-blue-100/60" : ""}`}
            >
              <div className="text-lg shrink-0 mt-0.5">{TYPE_ICONS[n.notification_type] || "🔔"}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 leading-snug">{n.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{n.message}</p>
                <p className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              {!n.is_read && <div className="w-2 h-2 bg-primary-500 rounded-full shrink-0 mt-2" />}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-4 py-2.5">
        <Link
          to="/notifications"
          onClick={onClose}
          className="text-xs text-primary-600 font-medium hover:underline block text-center"
        >
          View all notifications →
        </Link>
      </div>
    </div>
  );
}

export default function Navbar() {
  const { user, isAuthenticated, isSeeker, isRecruiter } = useAuth();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Notification unread count
  const { data: countData, refetch: refetchCount } = useQuery({
    queryKey: ["notif-unread-count"],
    queryFn: () => api.get("/notifications/unread-count/").then(r => r.data.unread_count as number),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
  const unreadCount = countData ?? 0;

  // Message unread count (sum across all conversations)
  const { data: conversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.get("/messaging/conversations/").then(r => r.data.results ?? r.data),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
  const unreadMessages = (conversations as any[])?.reduce((sum: number, c: any) => sum + (c.unread_count ?? 0), 0) ?? 0;

  // Close notification dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
    setProfileOpen(false);
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const navLinkClass = (path: string) =>
    `relative text-sm font-medium transition-colors duration-150 pb-0.5
    ${isActive(path)
      ? "text-primary-600 after:absolute after:bottom-[-18px] after:left-0 after:w-full after:h-0.5 after:bg-primary-600 after:rounded-t"
      : "text-gray-500 hover:text-gray-900"}`;

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0 group">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center shadow-sm group-hover:bg-primary-700 transition-colors">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900 tracking-tight">
              Hire<span className="text-primary-600">Sync</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-7 h-16">
            <Link to="/jobs" className={navLinkClass("/jobs")}>Browse Jobs</Link>

            {isAuthenticated && isSeeker && (
              <>
                <Link to="/dashboard" className={navLinkClass("/dashboard")}>Dashboard</Link>
                <Link to="/recommendations" className={navLinkClass("/recommendations")}>For You</Link>
                <Link to="/applications" className={navLinkClass("/applications")}>Applications</Link>
              </>
            )}

            {isAuthenticated && isRecruiter && (
              <>
                <Link to="/recruiter/dashboard" className={navLinkClass("/recruiter/dashboard")}>Dashboard</Link>
                <Link to="/recruiter/jobs" className={navLinkClass("/recruiter/jobs")}>My Jobs</Link>
                <Link to="/recruiter/analytics" className={navLinkClass("/recruiter/analytics")}>Analytics</Link>
              </>
            )}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-2">
            {isAuthenticated ? (
              <>
                {isRecruiter && (
                  <Link
                    to="/recruiter/jobs/post"
                    className="flex items-center gap-1.5 bg-primary-600 text-white px-3.5 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors mr-1"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Post Job
                  </Link>
                )}

                {/* Messages */}
                <Link
                  to="/messages"
                  className="relative w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                >
                  <MessageCircle className="w-5 h-5" />
                  {unreadMessages > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
                      +{unreadMessages > 99 ? "99" : unreadMessages}
                    </span>
                  )}
                </Link>

                {/* Notification bell — dropdown */}
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => setNotifOpen(v => !v)}
                    className={`relative w-9 h-9 flex items-center justify-center rounded-lg transition-colors
                      ${notifOpen ? "bg-primary-50 text-primary-600" : "text-gray-500 hover:text-primary-600 hover:bg-primary-50"}`}
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
                        +{unreadCount > 99 ? "99" : unreadCount}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <NotificationDropdown
                      onClose={() => setNotifOpen(false)}
                      onCountChange={() => refetchCount()}
                    />
                  )}
                </div>

                {/* Profile dropdown */}
                <div className="relative ml-1">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-xs font-bold">
                      {user?.first_name?.[0]}{user?.last_name?.[0]}
                    </div>
                    <span className="text-sm font-medium text-gray-700 max-w-[80px] truncate">
                      {user?.first_name}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${profileOpen ? "rotate-180" : ""}`} />
                  </button>

                  {profileOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                      <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-20">
                        <div className="px-4 py-2.5 border-b border-gray-100 mb-1">
                          <p className="text-sm font-semibold text-gray-900">{user?.first_name} {user?.last_name}</p>
                          <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                          <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-medium capitalize
                            ${isSeeker ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}>
                            {user?.role}
                          </span>
                        </div>

                        {isSeeker && (
                          <Link to="/profile" onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                            <User className="w-4 h-4 text-gray-400" /> My Profile
                          </Link>
                        )}
                        {isRecruiter && (
                          <Link to="/recruiter/dashboard" onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                            <LayoutDashboard className="w-4 h-4 text-gray-400" /> Dashboard
                          </Link>
                        )}
                        <Link to="/messages" onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          <MessageCircle className="w-4 h-4 text-gray-400" /> Messages
                        </Link>

                        <div className="border-t border-gray-100 mt-1 pt-1">
                          <button onClick={handleLogout}
                            className="flex items-center gap-2.5 px-4 py-2 text-sm text-red-500 hover:bg-red-50 w-full text-left transition-colors">
                            <LogOut className="w-4 h-4" /> Sign Out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-semibold bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                >
                  Sign Up Free
                </Link>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
          <MobileLink to="/jobs" label="Browse Jobs" icon={<Briefcase className="w-4 h-4" />} onClick={() => setMobileOpen(false)} active={isActive("/jobs")} />

          {isAuthenticated && isSeeker && (
            <>
              <MobileLink to="/dashboard" label="Dashboard" icon={<LayoutDashboard className="w-4 h-4" />} onClick={() => setMobileOpen(false)} active={isActive("/dashboard")} />
              <MobileLink to="/recommendations" label="For You" icon={<Sparkles className="w-4 h-4" />} onClick={() => setMobileOpen(false)} active={isActive("/recommendations")} />
              <MobileLink to="/applications" label="Applications" icon={<FileText className="w-4 h-4" />} onClick={() => setMobileOpen(false)} active={isActive("/applications")} />
            </>
          )}

          {isAuthenticated && isRecruiter && (
            <>
              <MobileLink to="/recruiter/dashboard" label="Dashboard" icon={<LayoutDashboard className="w-4 h-4" />} onClick={() => setMobileOpen(false)} active={isActive("/recruiter/dashboard")} />
              <MobileLink to="/recruiter/jobs/post" label="Post Job" icon={<PlusCircle className="w-4 h-4" />} onClick={() => setMobileOpen(false)} active={isActive("/recruiter/jobs/post")} />
              <MobileLink to="/recruiter/jobs" label="My Jobs" icon={<ListChecks className="w-4 h-4" />} onClick={() => setMobileOpen(false)} active={isActive("/recruiter/jobs")} />
              <MobileLink to="/recruiter/analytics" label="Analytics" icon={<BarChart2 className="w-4 h-4" />} onClick={() => setMobileOpen(false)} active={isActive("/recruiter/analytics")} />
            </>
          )}

          {isAuthenticated && (
            <>
              <MobileLink to="/messages" label="Messages" icon={<MessageCircle className="w-4 h-4" />} onClick={() => setMobileOpen(false)} active={isActive("/messages")} />
              <MobileLink to="/notifications" label="Notifications" icon={<Bell className="w-4 h-4" />} onClick={() => setMobileOpen(false)} active={isActive("/notifications")} badge={unreadCount} />
              <div className="pt-2 border-t border-gray-100 mt-2">
                <button onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 rounded-lg">
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </>
          )}

          {!isAuthenticated && (
            <div className="flex flex-col gap-2 pt-2">
              <Link to="/login" onClick={() => setMobileOpen(false)}
                className="text-center py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
                Login
              </Link>
              <Link to="/register" onClick={() => setMobileOpen(false)}
                className="text-center py-2.5 text-sm font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                Sign Up Free
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

function MobileLink({
  to, label, icon, onClick, active, badge,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
        ${active ? "bg-primary-50 text-primary-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}
    >
      <span className={active ? "text-primary-600" : "text-gray-400"}>{icon}</span>
      {label}
      {badge ? (
        <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
          +{badge > 99 ? "99" : badge}
        </span>
      ) : null}
    </Link>
  );
}
