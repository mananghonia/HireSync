import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { MessageCircle } from "lucide-react";
import api from "../../lib/axios";

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

export default function ApplicationsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-applications"],
    queryFn: () => api.get("/applications/my/").then((r) => r.data.results),
  });

  const messageMutation = useMutation({
    mutationFn: (recruiterId: string) =>
      api.post("/messaging/conversations/", { user_id: recruiterId }).then((r) => r.data),
    onSuccess: (convo) => navigate(`/messages?convo=${convo.id}`),
    onError: () => toast.error("Could not open conversation."),
  });

  const withdrawMutation = useMutation({
    mutationFn: (id: number) => api.post(`/applications/my/${id}/withdraw/`),
    onSuccess: () => {
      toast.success("Application withdrawn.");
      qc.invalidateQueries({ queryKey: ["my-applications"] });
    },
  });

  if (isLoading) return <div className="animate-pulse space-y-4">{[...Array(5)].map((_, i) => <div key={i} className="bg-white rounded-xl h-20" />)}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Applications</h1>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {data?.map((app: any) => (
          <div key={app.id} className="p-5 flex items-center justify-between">
            <div className="flex-1">
              <div className="font-semibold text-gray-900 cursor-pointer hover:text-primary-600"
                onClick={() => navigate(`/jobs/${app.job?.id}`)}>
                {app.job?.title}
              </div>
              <div className="text-sm text-gray-500">{app.job?.company?.name} · {app.job?.location || "Remote"}</div>
              <div className="text-xs text-gray-400 mt-1">Applied {new Date(app.applied_at).toLocaleDateString()}</div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => messageMutation.mutate(app.job?.recruiter_id)}
                disabled={messageMutation.isPending || !app.job?.recruiter_id}
                title="Message recruiter"
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:text-primary-600 hover:border-primary-300 hover:bg-primary-50 transition-colors disabled:opacity-40">
                <MessageCircle className="w-4 h-4" />
              </button>
              <span className={`text-xs px-3 py-1 rounded-full font-medium capitalize ${STATUS_STYLES[app.status] || "bg-gray-100 text-gray-600"}`}>
                {app.status.replace(/_/g, " ")}
              </span>
              {app.status === "withdrawn" ? (
                <button
                  onClick={() => navigate(`/jobs/${app.job?.id}`)}
                  className="text-xs text-primary-600 font-medium hover:underline"
                >
                  Apply Again
                </button>
              ) : !["hired", "rejected"].includes(app.status) && (
                <button onClick={() => withdrawMutation.mutate(app.id)}
                  className="text-xs text-red-500 hover:underline">
                  Withdraw
                </button>
              )}
            </div>
          </div>
        ))}
        {data?.length === 0 && (
          <div className="text-center py-16 text-gray-400">No applications yet.</div>
        )}
      </div>
    </div>
  );
}
