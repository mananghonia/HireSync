import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Sparkles, MapPin, Briefcase } from "lucide-react";
import api from "../../lib/axios";

export default function RecommendationsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["recommendations"],
    queryFn: () => api.get("/search/recommendations/").then((r) => r.data.results),
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="w-6 h-6 text-yellow-500" />
        <h1 className="text-2xl font-bold text-gray-900">Jobs For You</h1>
      </div>
      <p className="text-gray-500 text-sm mb-6">Based on your skills — ranked by match score.</p>

      {isLoading ? (
        <div className="grid gap-4">{[...Array(5)].map((_, i) => <div key={i} className="bg-white rounded-xl h-24 animate-pulse" />)}</div>
      ) : (
        <div className="grid gap-4">
          {data?.map((job: any, idx: number) => (
            <div key={job.id} onClick={() => navigate(`/jobs/${job.id}`)}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-primary-300 cursor-pointer transition-all flex gap-4">
              <div className="w-8 h-8 bg-yellow-50 rounded-lg flex items-center justify-center shrink-0 font-bold text-yellow-600 text-sm">
                #{idx + 1}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{job.title}</h3>
                <p className="text-primary-600 text-sm">{job.company?.name}</p>
                <div className="flex gap-4 mt-2 text-gray-500 text-sm">
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location || "Remote"}</span>
                  <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{job.job_type?.replace("_", " ")}</span>
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {job.skills?.slice(0, 5).map((s: any) => (
                    <span key={s.id} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{s.name}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {data?.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-200" />
              <p>Add skills to your profile to get personalized recommendations.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
