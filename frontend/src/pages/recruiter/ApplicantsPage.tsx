import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import toast from "react-hot-toast";
import { User, FileText, MessageCircle, Wand2, X, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
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

const CATEGORY_COLORS: Record<string, string> = {
  "Technical Skills": "bg-blue-50 border-blue-200 text-blue-700",
  "Problem Solving": "bg-purple-50 border-purple-200 text-purple-700",
  "Behavioral": "bg-amber-50 border-amber-200 text-amber-700",
  "Role Fit": "bg-emerald-50 border-emerald-200 text-emerald-700",
};

function QuestionPanel({ app, onClose }: { app: any; onClose: () => void }) {
  const [categories, setCategories] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const generate = async () => {
    setIsGenerating(true);
    try {
      const res = await api.post(`/applications/manage/${app.id}/generate_questions/`);
      const cats = res.data.categories ?? [];
      setCategories(cats);
      const open: Record<string, boolean> = {};
      cats.forEach((c: any) => { open[c.name] = true; });
      setExpanded(open);
      setGenerated(true);
    } catch {
      toast.error("Failed to generate questions.");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyQuestion = (q: string) => {
    navigator.clipboard.writeText(q);
    setCopied(q);
    setTimeout(() => setCopied(null), 2000);
  };

  const copyAll = () => {
    const text = categories
      .map(c => `${c.name}\n${c.questions.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")}`)
      .join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success("All questions copied!");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-white h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 text-base flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-primary-600" />
              Interview Questions
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {app.applicant?.full_name} · {app.applicant?.email}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!generated ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-16">
              <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center">
                <Wand2 className="w-8 h-8 text-primary-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">AI-Powered Question Generator</p>
                <p className="text-sm text-gray-500 mt-1 max-w-xs">
                  Claude will analyze the job requirements and this candidate's resume to generate tailored interview questions.
                </p>
              </div>
              <button
                onClick={generate}
                disabled={isGenerating}
                className="flex items-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-primary-700 disabled:opacity-60 transition-colors"
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Generating…
                  </>
                ) : (
                  <><Wand2 className="w-4 h-4" /> Generate Questions</>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {categories.map((cat: any) => (
                <div key={cat.name} className="rounded-xl border border-gray-100 overflow-hidden">
                  <button
                    className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold border-b ${CATEGORY_COLORS[cat.name] ?? "bg-gray-50 border-gray-200 text-gray-700"}`}
                    onClick={() => setExpanded(p => ({ ...p, [cat.name]: !p[cat.name] }))}
                  >
                    {cat.name}
                    {expanded[cat.name] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {expanded[cat.name] && (
                    <ul className="divide-y divide-gray-50">
                      {cat.questions.map((q: string, i: number) => (
                        <li key={i} className="px-4 py-3 flex items-start gap-3 group hover:bg-gray-50 transition-colors">
                          <span className="text-xs font-bold text-gray-400 mt-0.5 w-4 shrink-0">{i + 1}</span>
                          <span className="text-sm text-gray-800 flex-1 leading-relaxed">{q}</span>
                          <button
                            onClick={() => copyQuestion(q)}
                            className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-primary-600 transition-all p-1"
                            title="Copy question"
                          >
                            {copied === q ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {generated && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <button
              onClick={generate}
              disabled={isGenerating}
              className="text-xs text-primary-600 hover:underline disabled:opacity-50 flex items-center gap-1"
            >
              <Wand2 className="w-3 h-3" />
              {isGenerating ? "Regenerating…" : "Regenerate"}
            </button>
            <button
              onClick={copyAll}
              className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Copy className="w-3.5 h-3.5" /> Copy All
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ApplicantsPage() {
  const { jobId } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState("");
  const [questionApp, setQuestionApp] = useState<any>(null);

  const messageMutation = useMutation({
    mutationFn: (userId: string) =>
      api.post("/messaging/conversations/start/", { user_id: userId }).then((r) => r.data),
    onSuccess: (convo) => {
      qc.setQueryData(["conversations"], (prev: any[] | undefined) => {
        const list = prev ?? [];
        if (list.find((c: any) => c.id === convo.id)) return list;
        return [convo, ...list];
      });
      navigate(`/messages?convo=${convo.id}`);
    },
    onError: () => toast.error("Could not open conversation."),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["applicants", jobId, filterStatus],
    queryFn: () => api.get("/applications/manage/", { params: { job_id: jobId, status: filterStatus || undefined } }).then((r) => r.data.results),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) =>
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
                    <div className="text-xs text-primary-600 mt-0.5">{app.skill_match_score}% skill match</div>
                  )}
                  {app.resume_snapshot && (
                    <a href={app.resume_snapshot} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline mt-0.5">
                      <FileText className="w-3 h-3" /> View Resume
                    </a>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Generate interview questions */}
                <button
                  onClick={() => setQuestionApp(app)}
                  title="Generate interview questions"
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:text-primary-600 hover:border-primary-300 hover:bg-primary-50 transition-colors">
                  <Wand2 className="w-4 h-4" />
                </button>

                {/* Message applicant */}
                <button
                  onClick={() => messageMutation.mutate(app.applicant?.id)}
                  disabled={messageMutation.isPending}
                  title="Message applicant"
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:text-primary-600 hover:border-primary-300 hover:bg-primary-50 transition-colors disabled:opacity-50">
                  <MessageCircle className="w-4 h-4" />
                </button>

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

      {/* Interview question slide-over */}
      {questionApp && <QuestionPanel app={questionApp} onClose={() => setQuestionApp(null)} />}
    </div>
  );
}
