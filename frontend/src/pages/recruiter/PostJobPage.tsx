import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Building2 } from "lucide-react";
import api from "../../lib/axios";

function SetupCompanyForm({ onDone }: { onDone: () => void }) {
  const { register, handleSubmit } = useForm();
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: any) => api.post("/profiles/companies/my_company/", data),
    onSuccess: () => { toast.success("Company created!"); qc.invalidateQueries({ queryKey: ["my-company"] }); onDone(); },
    onError: () => toast.error("Failed to create company."),
  });

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="w-5 h-5 text-amber-600" />
        <h2 className="font-semibold text-amber-900">Set up your company first</h2>
      </div>
      <p className="text-sm text-amber-700 mb-4">You need a company profile before posting jobs.</p>
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
        <input {...register("name", { required: true })} placeholder="Company name *"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        <div className="grid grid-cols-2 gap-3">
          <select {...register("industry")} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">Industry</option>
            {["technology","finance","healthcare","education","ecommerce","media","manufacturing","consulting","other"].map(i =>
              <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>)}
          </select>
          <select {...register("size")} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">Company size</option>
            {["1-10","11-50","51-200","201-500","501-1000","1000+"].map(s => <option key={s} value={s}>{s} employees</option>)}
          </select>
        </div>
        <input {...register("location")} placeholder="Location"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        <button type="submit" disabled={mutation.isPending}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
          {mutation.isPending ? "Creating..." : "Create Company & Continue"}
        </button>
      </form>
    </div>
  );
}

export default function PostJobPage() {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const navigate = useNavigate();
  const [showSetup, setShowSetup] = useState(false);

  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ["my-company"],
    queryFn: () => api.get("/profiles/companies/my_company/").then((r) => r.data),
  });

  const { data: skills } = useQuery({
    queryKey: ["skills"],
    queryFn: () => api.get("/profiles/skills/").then((r) => r.data.results ?? r.data),
  });

  const mutation = useMutation({
    mutationFn: (data: any) => api.post("/jobs/", data),
    onSuccess: () => { toast.success("Job posted successfully!"); navigate("/recruiter/jobs"); },
    onError: (err: any) => {
      const msg = err?.response?.data ? JSON.stringify(err.response.data) : "Failed to post job.";
      toast.error(msg);
    },
  });

  const noCompany = !companyLoading && !company;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Post a New Job</h1>

      {noCompany && <SetupCompanyForm onDone={() => setShowSetup(false)} />}

      {!noCompany && (
        <form onSubmit={handleSubmit((d) => {
          const skillIds = Array.isArray(d.skill_ids)
            ? d.skill_ids.filter(Boolean)
            : d.skill_ids ? [d.skill_ids] : [];
          mutation.mutate({ ...d, company_id: company?.id, skill_ids: skillIds });
        })} className="space-y-5">

          {/* Company badge */}
          {company && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <Building2 className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-800">Posting as <strong>{company.name}</strong></span>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Basic Information</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
              <input {...register("title", { required: true })} placeholder="e.g. Senior React Developer"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              {errors.title && <p className="text-red-500 text-xs mt-1">Title is required</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Type</label>
                <select {...register("job_type")} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="contract">Contract</option>
                  <option value="internship">Internship</option>
                  <option value="remote">Remote</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Experience Level</label>
                <select {...register("experience_level")} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="any">Any</option>
                  <option value="fresher">Fresher</option>
                  <option value="junior">Junior</option>
                  <option value="mid">Mid-level</option>
                  <option value="senior">Senior</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input {...register("location")} placeholder="e.g. Mumbai, India"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" {...register("is_remote")} id="remote" className="rounded" />
              <label htmlFor="remote" className="text-sm text-gray-700">This is a remote position</label>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Salary & Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Salary (₹)</label>
                <input type="number" {...register("salary_min")} placeholder="500000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Salary (₹)</label>
                <input type="number" {...register("salary_max")} placeholder="1200000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Application Deadline</label>
              <input type="date" {...register("application_deadline")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Description & Requirements</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Description *</label>
              <textarea {...register("description", { required: true })} rows={6}
                placeholder="Describe the role, responsibilities, and what makes it exciting..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
              {errors.description && <p className="text-red-500 text-xs mt-1">Description is required</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Requirements</label>
              <textarea {...register("requirements")} rows={4}
                placeholder="List required skills, qualifications, and experience..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Required Skills</label>
              <div className="flex flex-wrap gap-2">
                {skills?.map((s: any) => (
                  <label key={s.id} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" value={s.id} {...register("skill_ids")} className="rounded" />
                    <span className="text-sm text-gray-700">{s.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <button type="submit" disabled={mutation.isPending}
            className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50">
            {mutation.isPending ? "Posting..." : "Post Job"}
          </button>
        </form>
      )}
    </div>
  );
}
