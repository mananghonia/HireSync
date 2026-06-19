import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Eye, Users, PlusCircle, Pause, Play, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../lib/axios";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  draft: "bg-gray-100 text-gray-600",
  closed: "bg-red-100 text-red-700",
};

export default function ManageJobsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-jobs"],
    queryFn: () => api.get("/jobs/my_jobs/").then((r) => r.data.results),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/jobs/${id}/`, { status }),
    onSuccess: () => {
      toast.success("Job status updated.");
      qc.invalidateQueries({ queryKey: ["my-jobs"] });
    },
  });

  if (isLoading) return <div className="animate-pulse space-y-4">{[...Array(5)].map((_, i) => <div key={i} className="bg-white rounded-xl h-20" />)}</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Jobs</h1>
        <Link to="/recruiter/jobs/post"
          className="bg-primary-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-primary-700 flex items-center gap-2">
          <PlusCircle className="w-4 h-4" /> Post New Job
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {data?.map((job: any) => (
          <div key={job.id} className="p-5 flex items-center justify-between">
            <div>
              <div className="font-semibold text-gray-900">{job.title}</div>
              <div className="text-sm text-gray-500">{job.company?.name} · {job.location || "Remote"}</div>
              <div className="flex gap-4 mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{job.views_count} views</span>
                <span>{new Date(job.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[job.status] || "bg-gray-100 text-gray-600"}`}>
                {job.status}
              </span>
              <Link to={`/recruiter/jobs/${job.id}/applicants`}
                className="flex items-center gap-1 text-sm text-primary-600 hover:underline">
                <Users className="w-4 h-4" /> Applicants
              </Link>
              {job.status === "active" ? (
                <button onClick={() => statusMutation.mutate({ id: job.id, status: "paused" })}
                  className="text-gray-400 hover:text-yellow-500"><Pause className="w-4 h-4" /></button>
              ) : job.status === "paused" ? (
                <button onClick={() => statusMutation.mutate({ id: job.id, status: "active" })}
                  className="text-gray-400 hover:text-green-500"><Play className="w-4 h-4" /></button>
              ) : null}
              <button onClick={() => statusMutation.mutate({ id: job.id, status: "closed" })}
                className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {data?.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            No jobs posted yet. <Link to="/recruiter/jobs/post" className="text-primary-600 hover:underline">Post your first job</Link>
          </div>
        )}
      </div>
    </div>
  );
}
