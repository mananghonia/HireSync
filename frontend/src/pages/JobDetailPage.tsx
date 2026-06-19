import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MapPin, Briefcase, DollarSign, Calendar, Users, BookmarkPlus, Send } from "lucide-react";
import toast from "react-hot-toast";
import api from "../lib/axios";
import { useAuth } from "../hooks/useAuth";

export default function JobDetailPage() {
  const { id } = useParams();
  const { isAuthenticated, isSeeker } = useAuth();
  const [coverLetter, setCoverLetter] = useState("");
  const [showApplyForm, setShowApplyForm] = useState(false);

  const { data: job, isLoading, refetch } = useQuery({
    queryKey: ["job", id],
    queryFn: () => api.get(`/jobs/${id}/`).then((r) => r.data),
  });

  const applyMutation = useMutation({
    mutationFn: () => api.post("/applications/my/", { job: id, cover_letter: coverLetter }),
    onSuccess: () => {
      toast.success("Application submitted!");
      setShowApplyForm(false);
      refetch();
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Failed to apply."),
  });

  const saveMutation = useMutation({
    mutationFn: () => api.post("/jobs/saved/", { job_id: id }),
    onSuccess: ({ data }) => toast.success(data.detail || "Saved!"),
  });

  if (isLoading) return <div className="animate-pulse bg-white rounded-xl h-96" />;
  if (!job) return <div className="text-center py-16 text-gray-500">Job not found.</div>;

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2">
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
              <p className="text-primary-600 font-semibold mt-1">{job.company?.name}</p>
              <div className="flex gap-4 mt-3 text-gray-500 text-sm flex-wrap">
                {job.location && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{job.location}</span>}
                <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" />{job.job_type?.replace("_", " ")}</span>
                <span className="flex items-center gap-1"><Users className="w-4 h-4" />{job.experience_level}</span>
                {job.salary_min && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    {job.salary_currency} {job.salary_min?.toLocaleString()} – {job.salary_max?.toLocaleString()}
                  </span>
                )}
                {job.application_deadline && (
                  <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />Deadline: {new Date(job.application_deadline).toLocaleDateString()}</span>
                )}
              </div>
              <div className="flex gap-2 mt-4 flex-wrap">
                {job.skills?.map((s: any) => (
                  <span key={s.id} className="bg-primary-50 text-primary-700 text-sm px-3 py-1 rounded-full border border-primary-200">{s.name}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Description</h2>
          <div className="prose text-gray-700 text-sm leading-relaxed whitespace-pre-line">{job.description}</div>
        </div>

        {job.requirements && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Requirements</h2>
            <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{job.requirements}</div>
          </div>
        )}

        {showApplyForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {job.application_status === "withdrawn" ? "Re-apply for this position" : "Apply for this position"}
            </h2>
            <textarea value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)}
              placeholder="Write a cover letter (optional)..."
              rows={6}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending}
                className="bg-primary-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2">
                <Send className="w-4 h-4" />
                {applyMutation.isPending ? "Submitting..." : "Submit Application"}
              </button>
              <button onClick={() => setShowApplyForm(false)} className="border border-gray-300 px-4 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-4">
          <p className="text-sm text-gray-500 mb-4">{job.views_count} views</p>

          {isAuthenticated && isSeeker && (
            <div className="space-y-3">
              {job.application_status === "withdrawn" ? (
                <button onClick={() => setShowApplyForm(true)}
                  className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700">
                  Apply Again
                </button>
              ) : job.has_applied ? (
                <div>
                  <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm text-center font-medium capitalize">
                    {job.application_status?.replace(/_/g, " ") || "Applied"}
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowApplyForm(true)}
                  className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700">
                  Apply Now
                </button>
              )}
              <button onClick={() => saveMutation.mutate()}
                className="w-full border border-gray-300 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2">
                <BookmarkPlus className="w-4 h-4" />
                {job.is_saved ? "Saved" : "Save Job"}
              </button>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-2">{job.company?.name}</h3>
            {job.company?.industry && <p className="text-sm text-gray-500 capitalize">{job.company.industry}</p>}
            {job.company?.size && <p className="text-sm text-gray-500">{job.company.size} employees</p>}
            {job.company?.website && (
              <a href={job.company.website} target="_blank" rel="noopener noreferrer"
                className="text-sm text-primary-600 hover:underline mt-1 block">
                Visit website
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
