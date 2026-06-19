import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Briefcase, Clock, CheckCircle, XCircle, BookmarkCheck } from "lucide-react";
import api from "../../lib/axios";
import { useAuth } from "../../hooks/useAuth";

const STATUS_STYLES: Record<string, string> = {
  applied: "bg-blue-100 text-blue-700",
  viewed: "bg-yellow-100 text-yellow-700",
  shortlisted: "bg-purple-100 text-purple-700",
  interview_scheduled: "bg-orange-100 text-orange-700",
  interviewed: "bg-indigo-100 text-indigo-700",
  offer_made: "bg-emerald-100 text-emerald-700",
  hired: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  withdrawn: "bg-gray-100 text-gray-600",
};

export default function SeekerDashboard() {
  const { user } = useAuth();
  const { data: apps } = useQuery({
    queryKey: ["my-applications"],
    queryFn: () => api.get("/applications/my/").then((r) => r.data.results),
  });

  const stats = {
    total: apps?.length ?? 0,
    active: apps?.filter((a: any) => !["rejected", "withdrawn", "hired"].includes(a.status)).length ?? 0,
    hired: apps?.filter((a: any) => a.status === "hired").length ?? 0,
    rejected: apps?.filter((a: any) => a.status === "rejected").length ?? 0,
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.first_name}</h1>
        <p className="text-gray-500 text-sm mt-1">Track your job applications and discover new opportunities.</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Applications", value: stats.total, icon: Briefcase, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Active", value: stats.active, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" },
          { label: "Hired", value: stats.hired, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
          { label: "Rejected", value: stats.rejected, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center mb-3`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-sm text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <Link to="/jobs" className="bg-primary-600 text-white rounded-xl p-5 hover:bg-primary-700 transition-colors">
          <Briefcase className="w-6 h-6 mb-2" />
          <div className="font-semibold">Browse Jobs</div>
          <div className="text-sm text-primary-200 mt-0.5">Find new opportunities</div>
        </Link>
        <Link to="/recommendations" className="bg-white border border-gray-200 rounded-xl p-5 hover:border-primary-300 transition-colors">
          <BookmarkCheck className="w-6 h-6 mb-2 text-primary-600" />
          <div className="font-semibold text-gray-900">Recommendations</div>
          <div className="text-sm text-gray-500 mt-0.5">Jobs matching your skills</div>
        </Link>
        <Link to="/profile" className="bg-white border border-gray-200 rounded-xl p-5 hover:border-primary-300 transition-colors">
          <CheckCircle className="w-6 h-6 mb-2 text-green-600" />
          <div className="font-semibold text-gray-900">Update Profile</div>
          <div className="text-sm text-gray-500 mt-0.5">Improve your visibility</div>
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-semibold text-gray-900">Recent Applications</h2>
          <Link to="/applications" className="text-sm text-primary-600 hover:underline">View all</Link>
        </div>
        <div>
          {apps?.slice(0, 5).map((app: any) => (
            <div key={app.id} className="flex items-center justify-between p-5 border-b border-gray-50 last:border-0">
              <div>
                <div className="font-medium text-gray-900">{app.job?.title}</div>
                <div className="text-sm text-gray-500">{app.job?.company?.name}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[app.status] || "bg-gray-100 text-gray-600"}`}>
                  {app.status.replace("_", " ")}
                </span>
                <span className="text-xs text-gray-400">{new Date(app.applied_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
          {(!apps || apps.length === 0) && (
            <div className="text-center py-12 text-gray-400 text-sm">
              No applications yet. <Link to="/jobs" className="text-primary-600 hover:underline">Browse jobs</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
