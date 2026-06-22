import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { useState, useRef } from "react";
import toast from "react-hot-toast";
import { User, FileText, MessageCircle, Wand2, X, Copy, Check, ChevronDown, ChevronUp, Calendar, ClipboardList } from "lucide-react";
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

function InterviewModal({ app, onConfirm, onClose }: {
  app: any;
  onConfirm: (isoDateTime: string) => void;
  onClose: () => void;
}) {
  const minDateTime = new Date();
  minDateTime.setMinutes(minDateTime.getMinutes() - minDateTime.getTimezoneOffset());
  const minStr = minDateTime.toISOString().slice(0, 16);

  const [value, setValue] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-5 h-5 text-violet-600" />
            <h2 className="font-semibold text-gray-900">Schedule Interview</h2>
          </div>
          <p className="text-xs text-gray-500">
            {app.applicant?.full_name} · {app.job?.title || ""}
          </p>
        </div>

        <div className="px-6 py-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Interview date & time
          </label>
          <input
            type="datetime-local"
            min={minStr}
            value={value}
            onChange={e => setValue(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <p className="text-xs text-gray-400 mt-2">An email will be sent to the applicant with this date and time.</p>
        </div>

        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            disabled={!value}
            onClick={() => value && onConfirm(new Date(value).toISOString())}
            className="flex-1 bg-violet-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors">
            Schedule & Notify
          </button>
        </div>
      </div>
    </div>
  );
}


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

const RECOMMENDATION_STYLES: Record<string, string> = {
  "Strong Hire": "bg-green-100 text-green-800",
  "Hire": "bg-emerald-100 text-emerald-700",
  "Maybe": "bg-yellow-100 text-yellow-700",
  "No Hire": "bg-red-100 text-red-700",
};

function TranscriptPanel({ app, onClose }: { app: any; onClose: () => void }) {
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyze = async () => {
    if (transcript.trim().length < 50) {
      toast.error("Transcript is too short.");
      return;
    }
    setIsAnalyzing(true);
    try {
      const res = await api.post(`/applications/manage/${app.id}/analyze_transcript/`, { transcript });
      setResult(res.data);
    } catch {
      toast.error("Failed to analyze transcript.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 text-base flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-indigo-600" />
              Transcript Analysis
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {app.applicant?.full_name} · {app.job?.title}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!result ? (
            <div className="flex flex-col gap-4 h-full">
              <p className="text-sm text-gray-500">Paste the interview transcript below. Claude will analyze the candidate's performance and provide a structured assessment.</p>
              <textarea
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
                placeholder="Paste interview transcript here…"
                className="flex-1 min-h-64 w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
              <button
                onClick={analyze}
                disabled={isAnalyzing || transcript.trim().length < 50}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {isAnalyzing ? (
                  <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg> Analyzing…</>
                ) : (
                  <><ClipboardList className="w-4 h-4" /> Analyze Transcript</>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Recommendation */}
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold px-3 py-1.5 rounded-full ${RECOMMENDATION_STYLES[result.recommendation] ?? "bg-gray-100 text-gray-700"}`}>
                  {result.recommendation}
                </span>
                <button onClick={() => setResult(null)} className="text-xs text-indigo-600 hover:underline">Analyze another</button>
              </div>

              {/* Scores */}
              {result.scores && (
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(result.scores).map(([key, val]: [string, any]) => (
                    <div key={key} className="bg-gray-50 rounded-xl p-3">
                      <div className="text-xs text-gray-500 mb-1">{key}</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(val / 10) * 100}%` }} />
                        </div>
                        <span className="text-sm font-semibold text-gray-800">{val}/10</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Summary */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Summary</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{result.summary}</p>
              </div>

              {/* Strengths */}
              {result.strengths?.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Strengths</h3>
                  <ul className="space-y-1.5">
                    {result.strengths.map((s: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-green-500 mt-0.5">✓</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Concerns */}
              {result.concerns?.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Concerns</h3>
                  <ul className="space-y-1.5">
                    {result.concerns.map((c: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-amber-500 mt-0.5">!</span> {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Key Quotes */}
              {result.key_quotes?.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Key Quotes</h3>
                  <div className="space-y-2">
                    {result.key_quotes.map((q: any, i: number) => (
                      <div key={i} className="border-l-2 border-indigo-300 pl-3 py-1">
                        <p className="text-sm italic text-gray-700">"{q.quote}"</p>
                        <p className="text-xs text-gray-400 mt-0.5">{q.context}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
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
  const [transcriptApp, setTranscriptApp] = useState<any>(null);
  const [interviewApp, setInterviewApp] = useState<any>(null);
  const pendingSelectRef = useRef<HTMLSelectElement | null>(null);

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
    mutationFn: ({ id, status, note, interview_scheduled_at }: {
      id: string; status: string; note?: string; interview_scheduled_at?: string
    }) => api.patch(`/applications/manage/${id}/update_status/`, { status, note, interview_scheduled_at }),
    onSuccess: (_, vars) => {
      toast.success(vars.status === "interview_scheduled" ? "Interview scheduled — email sent!" : "Status updated.");
      qc.invalidateQueries({ queryKey: ["applicants"] });
    },
  });

  const handleStatusChange = (app: any, newStatus: string, el: HTMLSelectElement) => {
    if (newStatus === "interview_scheduled") {
      pendingSelectRef.current = el;
      setInterviewApp(app);
    } else {
      statusMutation.mutate({ id: app.id, status: newStatus });
    }
  };

  const confirmInterview = (isoDateTime: string) => {
    if (!interviewApp) return;
    statusMutation.mutate({
      id: interviewApp.id,
      status: "interview_scheduled",
      interview_scheduled_at: isoDateTime,
    });
    setInterviewApp(null);
  };

  const cancelInterview = () => {
    // Revert the select back to previous value
    if (pendingSelectRef.current) {
      const app = data?.find((a: any) => a.id === interviewApp?.id);
      if (app && pendingSelectRef.current) pendingSelectRef.current.value = app.status;
    }
    setInterviewApp(null);
  };

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

                {/* Analyze interview transcript */}
                <button
                  onClick={() => setTranscriptApp(app)}
                  title="Analyze interview transcript"
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
                  <ClipboardList className="w-4 h-4" />
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
                  defaultValue={app.status}
                  onChange={(e) => handleStatusChange(app, e.target.value, e.currentTarget)}
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

      {/* Interview scheduling modal */}
      {interviewApp && (
        <InterviewModal
          app={interviewApp}
          onConfirm={confirmInterview}
          onClose={cancelInterview}
        />
      )}

      {/* Interview question slide-over */}
      {questionApp && <QuestionPanel app={questionApp} onClose={() => setQuestionApp(null)} />}

      {/* Transcript analysis slide-over */}
      {transcriptApp && <TranscriptPanel app={transcriptApp} onClose={() => setTranscriptApp(null)} />}
    </div>
  );
}
