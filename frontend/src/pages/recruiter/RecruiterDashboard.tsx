import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Briefcase, Eye, Users, TrendingUp, PlusCircle } from "lucide-react";
import api from "../../lib/axios";
import { useAuth } from "../../hooks/useAuth";

export default function RecruiterDashboard() {
  const { user } = useAuth();
  const { data: analytics } = useQuery({
    queryKey: ["recruiter-analytics"],
    queryFn: () => api.get("/analytics/recruiter/dashboard/").then((r) => r.data),
  });

  const overview = analytics?.overview ?? {};

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.first_name}</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your job postings and track applications.</p>
        </div>
        <Link to="/recruiter/jobs/post"
          className="bg-primary-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-primary-700 flex items-center gap-2">
          <PlusCircle className="w-4 h-4" /> Post a Job
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Active Jobs", value: overview.active_jobs ?? 0, icon: Briefcase, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Total Views", value: overview.total_views ?? 0, icon: Eye, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Applications", value: overview.total_applications ?? 0, icon: Users, color: "text-yellow-600", bg: "bg-yellow-50" },
          { label: "Conversion Rate", value: `${overview.conversion_rate ?? 0}%`, icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
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

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-semibold text-gray-900">Top Performing Jobs</h2>
          <Link to="/recruiter/jobs" className="text-sm text-primary-600 hover:underline">View all</Link>
        </div>
        <div className="divide-y divide-gray-50">
          {analytics?.top_jobs?.map((job: any) => (
            <div key={job.id} className="p-5 flex items-center justify-between">
              <div className="font-medium text-gray-900">{job.title}</div>
              <div className="flex gap-6 text-sm text-gray-500">
                <span className="flex items-center gap-1"><Eye className="w-4 h-4" />{job.views_count} views</span>
                <span className="flex items-center gap-1"><Users className="w-4 h-4" />{job.app_count} applicants</span>
                <Link to={`/recruiter/jobs/${job.id}/applicants`} className="text-primary-600 hover:underline">View</Link>
              </div>
            </div>
          ))}
          {(!analytics?.top_jobs || analytics.top_jobs.length === 0) && (
            <div className="text-center py-12 text-gray-400 text-sm">
              No jobs yet. <Link to="/recruiter/jobs/post" className="text-primary-600 hover:underline">Post your first job</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
