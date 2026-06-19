import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Filter, Briefcase, Clock, DollarSign } from "lucide-react";
import api from "../lib/axios";

const JOB_TYPES = ["full_time", "part_time", "contract", "internship", "remote"];
const EXPERIENCE_LEVELS = ["fresher", "junior", "mid", "senior"];

export default function JobSearchPage() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [jobType, setJobType] = useState("");
  const [experience, setExperience] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState({ q: "", location: "", job_type: "", experience_level: "" });
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["jobs", search, page],
    queryFn: () => api.get("/search/jobs/", { params: { ...search, page } }).then((r) => r.data),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch({ q: query, location, job_type: jobType, experience_level: experience });
  };

  return (
    <div>
      {/* Search bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <form onSubmit={handleSearch} className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-48 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Job title, company, or keyword"
              className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="relative min-w-36">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder="Location"
              className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <select value={jobType} onChange={(e) => setJobType(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">All Types</option>
            {JOB_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
          </select>
          <select value={experience} onChange={(e) => setExperience(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">All Levels</option>
            {EXPERIENCE_LEVELS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <button type="submit" className="bg-primary-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-700">
            Search
          </button>
        </form>
      </div>

      {/* Results */}
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-600">
          {isLoading ? "Searching..." : `${data?.count ?? 0} jobs found`}
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-2/3 mb-3" />
              <div className="h-4 bg-gray-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {data?.results?.map((job: any) => (
            <div key={job.id} onClick={() => navigate(`/jobs/${job.id}`)}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-primary-300 hover:shadow-sm cursor-pointer transition-all">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-lg">{job.title}</h3>
                  <p className="text-primary-600 font-medium text-sm mt-0.5">{job.company?.name}</p>
                  <div className="flex gap-4 mt-2 text-gray-500 text-sm">
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location || "Remote"}</span>
                    <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{job.job_type?.replace("_", " ")}</span>
                    {job.salary_min && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5" />
                        {job.salary_currency} {job.salary_min.toLocaleString()} - {job.salary_max?.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {job.skills?.slice(0, 5).map((s: any) => (
                      <span key={s.id} className="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full">{s.name}</span>
                    ))}
                  </div>
                </div>
                <div className="text-right ml-4 shrink-0">
                  <span className="text-xs text-gray-400">{new Date(job.created_at).toLocaleDateString()}</span>
                  {job.has_applied && (
                    <div className="mt-1 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">Applied</div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {data?.results?.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No jobs found. Try different keywords or filters.</p>
            </div>
          )}
        </div>
      )}

      {data && data.total_pages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {[...Array(data.total_pages)].map((_, i) => (
            <button key={i} onClick={() => setPage(i + 1)}
              className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors
                ${page === i + 1 ? "bg-primary-600 text-white" : "border border-gray-300 text-gray-600 hover:border-primary-400"}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
