import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Users, Briefcase, FileText, TrendingUp,
  Search, ChevronDown, Trash2, Ban, CheckCircle, XCircle,
} from "lucide-react";
import api from "../../lib/axios";

type Tab = "overview" | "users" | "jobs";

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: number; sub: string; icon: any; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function Overview() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.get("/admin/stats/").then(r => r.data),
  });

  if (isLoading) return <div className="text-center py-20 text-gray-400">Loading stats...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={data.users.total} sub={`+${data.users.new_this_week} this week`} icon={Users} color="bg-blue-500" />
        <StatCard label="Job Seekers" value={data.users.seekers} sub={`${data.users.recruiters} recruiters`} icon={Users} color="bg-violet-500" />
        <StatCard label="Active Jobs" value={data.jobs.active} sub={`${data.jobs.total} total posted`} icon={Briefcase} color="bg-green-500" />
        <StatCard label="Applications" value={data.applications.total} sub={`${data.applications.this_week} this week`} icon={FileText} color="bg-orange-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500 mb-3">User Breakdown</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Job Seekers</span>
              <span className="font-semibold text-gray-900">{data.users.seekers}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${data.users.total ? (data.users.seekers / data.users.total) * 100 : 0}%` }} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Recruiters</span>
              <span className="font-semibold text-gray-900">{data.users.recruiters}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-violet-500 h-2 rounded-full" style={{ width: `${data.users.total ? (data.users.recruiters / data.users.total) * 100 : 0}%` }} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500 mb-3">Job Stats</p>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Active</span>
              <span className="font-semibold text-green-600">{data.jobs.active}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total posted</span>
              <span className="font-semibold text-gray-900">{data.jobs.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">This month</span>
              <span className="font-semibold text-blue-600">{data.jobs.posted_this_month}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500 mb-3">Application Stats</p>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total</span>
              <span className="font-semibold text-gray-900">{data.applications.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">This week</span>
              <span className="font-semibold text-blue-600">{data.applications.this_week}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Hired</span>
              <span className="font-semibold text-green-600">{data.applications.hired}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users", roleFilter],
    queryFn: () => api.get("/admin/users/", { params: { role: roleFilter || undefined } }).then(r => r.data),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(`/admin/users/${id}/`, { is_active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("User updated."); },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Failed."),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("User deleted."); },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Failed."),
  });

  const filtered = users.filter((u: any) =>
    !search || u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const roleColors: Record<string, string> = {
    seeker: "bg-blue-100 text-blue-700",
    recruiter: "bg-violet-100 text-violet-700",
    admin: "bg-red-100 text-red-700",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">All roles</option>
          <option value="seeker">Seekers</option>
          <option value="recruiter">Recruiters</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading users...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Joined</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((u: any) => (
                <tr key={u.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{u.full_name}</div>
                    <div className="text-xs text-gray-400">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${roleColors[u.role] || "bg-gray-100 text-gray-600"}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.is_active
                      ? <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle className="w-3.5 h-3.5" /> Active</span>
                      : <span className="flex items-center gap-1 text-red-500 text-xs"><XCircle className="w-3.5 h-3.5" /> Suspended</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleActive.mutate({ id: u.id, is_active: !u.is_active })}
                        title={u.is_active ? "Suspend user" : "Activate user"}
                        className={`p-1.5 rounded-lg transition ${u.is_active ? "text-orange-500 hover:bg-orange-50" : "text-green-600 hover:bg-green-50"}`}>
                        <Ban className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { if (confirm(`Delete ${u.full_name}?`)) deleteUser.mutate(u.id); }}
                        title="Delete user"
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Jobs Tab ─────────────────────────────────────────────────────────────────
function JobsTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["admin-jobs", statusFilter],
    queryFn: () => api.get("/admin/jobs/", { params: { status: statusFilter || undefined } }).then(r => r.data),
  });

  const updateJob = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/jobs/${id}/`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-jobs"] }); toast.success("Job updated."); },
  });

  const deleteJob = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/jobs/${id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-jobs"] }); toast.success("Job deleted."); },
  });

  const filtered = jobs.filter((j: any) =>
    !search || j.title.toLowerCase().includes(search.toLowerCase()) ||
    j.company.toLowerCase().includes(search.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    open: "bg-green-100 text-green-700",
    closed: "bg-red-100 text-red-700",
    paused: "bg-yellow-100 text-yellow-700",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title or company..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="paused">Paused</option>
        </select>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading jobs...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="text-left px-4 py-3">Job</th>
                <th className="text-left px-4 py-3">Recruiter</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Posted</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((j: any) => (
                <tr key={j.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{j.title}</div>
                    <div className="text-xs text-gray-400">{j.company} · {j.location}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-700">{j.recruiter}</div>
                    <div className="text-xs text-gray-400">{j.recruiter_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[j.status] || "bg-gray-100 text-gray-600"}`}>
                      {j.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(j.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <select
                        value={j.status}
                        onChange={e => updateJob.mutate({ id: j.id, status: e.target.value })}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500">
                        <option value="open">Open</option>
                        <option value="paused">Paused</option>
                        <option value="closed">Closed</option>
                      </select>
                      <button
                        onClick={() => { if (confirm(`Delete "${j.title}"?`)) deleteJob.mutate(j.id); }}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">No jobs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: TrendingUp },
    { id: "users", label: "Users", icon: Users },
    { id: "jobs", label: "Jobs", icon: Briefcase },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Platform management and analytics</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview />}
      {tab === "users" && <UsersTab />}
      {tab === "jobs" && <JobsTab />}
    </div>
  );
}
