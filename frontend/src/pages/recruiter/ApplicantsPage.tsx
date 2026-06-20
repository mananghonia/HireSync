import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { useState } from "react";
import toast from "react-hot-toast";
import { User, FileText, ExternalLink } from "lucide-react";
import api from "../../lib/axios";

const PIPELINE_STAGES = ["applied", "viewed", "shortlisted", "interview_scheduled", "interviewed", "offer_made", "hired", "rejected"];

const STAGE_COLORS: Record<string, string> = {
  applied: "bg-blue-100 text-blue-700",
  viewed: "bg-yellow-100 text-yellow-700",
  shortlisted: "bg-purple-100 text-purple-700",
  interview_scheduled: "bg-orange-100 text-orange-700",
  interviewed: "bg-indigo-100 text-indigo-700",
  offer_made: "bg-emerald-100 text-emerald-700",
  hired: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function ApplicantsPage() {
  const { jobId } = useParams();
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["applicants", jobId, filterStatus],
    queryFn: () => api.get("/applications/manage/", { params: { job_id: jobId, status: filterStatus || undefined } }).then((r) => r.data.results),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, note }: { id: number; status: string; note?: string }) =>
      api.patch(`/applications/manage/${id}/update_status/`, { status, note }),
    onSuccess: () => {
      toast.success("Status updated.");
      qc.invalidateQueries({ queryKey: ["applicants"] });
    },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Applicants</h1>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">All Stages</option>
          {PIPELINE_STAGES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-4">{[...Array(5)].map((_, i) => <div key={i} className="bg-white rounded-xl h-24 animate-pulse" />)}</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {data?.map((app: any) => (
            <div key={app.id} className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{app.applicant?.full_name}</div>
                  <div className="text-sm text-gray-500">{app.applicant?.email}</div>
                  {app.skill_match_score > 0 && (
                    <div className="text-xs text-primary-600 mt-0.5">
                      {app.skill_match_score}% skill match
                    </div>
                  )}
                  {app.resume_snapshot && (
                    <a href={app.resume_snapshot} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline mt-0.5">
                      <FileText className="w-3 h-3" /> View Resume
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STAGE_COLORS[app.status] || "bg-gray-100 text-gray-600"}`}>
                  {app.status.replace(/_/g, " ")}
                </span>
                <select
                  value={app.status}
                  onChange={(e) => statusMutation.mutate({ id: app.id, status: e.target.value })}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500">
                  {PIPELINE_STAGES.map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          {data?.length === 0 && (
            <div className="text-center py-16 text-gray-400 text-sm">No applicants yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
