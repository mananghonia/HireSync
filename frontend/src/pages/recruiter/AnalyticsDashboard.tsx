import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import api from "../../lib/axios";

const PIE_COLORS = ["#3b82f6", "#f59e0b", "#8b5cf6", "#f97316", "#6366f1", "#10b981", "#22c55e", "#ef4444"];

export default function AnalyticsDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["recruiter-analytics"],
    queryFn: () => api.get("/analytics/recruiter/dashboard/").then((r) => r.data),
  });

  if (isLoading) return <div className="animate-pulse space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-xl h-48" />)}</div>;

  const statusData = Object.entries(data?.status_breakdown ?? {}).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
  const dailyData = data?.daily_applications ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Recruiter Analytics</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total Jobs", value: data?.overview?.total_jobs ?? 0 },
          { label: "Total Applications", value: data?.overview?.total_applications ?? 0 },
          { label: "Hires", value: data?.overview?.hired_count ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-3xl font-bold text-gray-900">{value}</div>
            <div className="text-sm text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Applications Over Time (Last 30 Days)</h2>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyData}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => new Date(v).toLocaleDateString("en", { month: "short", day: "numeric" })} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No application data yet.</div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Application Pipeline</h2>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet.</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Top Performing Jobs</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-left border-b border-gray-100">
              <th className="pb-3">Job Title</th>
              <th className="pb-3">Views</th>
              <th className="pb-3">Applications</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data?.top_jobs?.map((job: any) => (
              <tr key={job.id}>
                <td className="py-3 font-medium text-gray-900">{job.title}</td>
                <td className="py-3 text-gray-600">{job.views_count}</td>
                <td className="py-3 text-gray-600">{job.app_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
