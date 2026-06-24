import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { User, Upload, FileText, Trash2, ExternalLink } from "lucide-react";
import api from "../../lib/axios";

export default function SeekerProfilePage() {
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profile } = useQuery<any>({
    queryKey: ["seeker-profile"],
    queryFn: () => api.get("/profiles/seeker/").then((r) => r.data),
    onSuccess: (data: any) => reset(data),
  } as any);

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch("/profiles/seeker/", data),
    onSuccess: () => {
      toast.success("Profile updated!");
      qc.invalidateQueries({ queryKey: ["seeker-profile"] });
    },
    onError: () => toast.error("Failed to update profile."),
  });

  const resumeMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("resume", file);
      return api.patch("/profiles/seeker/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      toast.success("Resume uploaded!");
      qc.invalidateQueries({ queryKey: ["seeker-profile"] });
    },
    onError: () => toast.error("Upload failed. Only PDF allowed."),
  });

  const deleteResumeMutation = useMutation({
    mutationFn: () => api.patch("/profiles/seeker/", { resume: null }),
    onSuccess: () => {
      toast.success("Resume removed.");
      qc.invalidateQueries({ queryKey: ["seeker-profile"] });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") { toast.error("Only PDF files allowed."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("File too large. Max 5MB."); return; }
    resumeMutation.mutate(file);
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-900 text-lg">{profile?.full_name}</div>
            <div className="text-gray-500 text-sm">{profile?.email}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit((d) => updateMutation.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Headline</label>
            <input {...register("headline")} placeholder="e.g. Full Stack Developer | React & Django"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
            <textarea {...register("bio")} rows={4} placeholder="Tell recruiters about yourself..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input {...register("location")} placeholder="City, Country"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Experience Level</label>
              <select {...register("experience_level")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Select level</option>
                <option value="fresher">Fresher</option>
                <option value="junior">Junior (1-2 yrs)</option>
                <option value="mid">Mid-level (3-5 yrs)</option>
                <option value="senior">Senior (6-9 yrs)</option>
                <option value="lead">Lead (10+ yrs)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GitHub</label>
              <input {...register("github_url")} placeholder="https://github.com/username"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn</label>
              <input {...register("linkedin_url")} placeholder="https://linkedin.com/in/username"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" {...register("is_open_to_work")} id="open_to_work" className="rounded" />
            <label htmlFor="open_to_work" className="text-sm text-gray-700">Open to work</label>
          </div>
          <button type="submit" disabled={updateMutation.isPending}
            className="bg-primary-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50">
            {updateMutation.isPending ? "Saving..." : "Save Profile"}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4" /> Resume
        </h2>

        {profile?.resume ? (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{profile.resume_filename || "Resume.pdf"}</p>
                <p className="text-xs text-gray-400">PDF · uploaded</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a href={profile.resume} target="_blank" rel="noopener noreferrer"
                className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition" title="View">
                <ExternalLink className="w-4 h-4" />
              </a>
              <button onClick={() => deleteResumeMutation.mutate()}
                disabled={deleteResumeMutation.isPending}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition" title="Remove">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition group">
            <Upload className="w-8 h-8 text-gray-400 group-hover:text-primary-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-600 group-hover:text-primary-600">
              {resumeMutation.isPending ? "Uploading..." : "Click to upload your resume"}
            </p>
            <p className="text-xs text-gray-400 mt-1">PDF only · Max 5MB</p>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept=".pdf,application/pdf"
          className="hidden" onChange={handleFileChange} />

        {profile?.resume && (
          <button onClick={() => fileInputRef.current?.click()}
            disabled={resumeMutation.isPending}
            className="mt-3 text-xs text-primary-600 hover:underline disabled:opacity-50">
            {resumeMutation.isPending ? "Uploading..." : "Replace resume"}
          </button>
        )}
      </div>
    </div>
  );
}
