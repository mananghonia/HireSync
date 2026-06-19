import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { User, Upload } from "lucide-react";
import api from "../../lib/axios";

export default function SeekerProfilePage() {
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const { data: profile } = useQuery({
    queryKey: ["seeker-profile"],
    queryFn: () => api.get("/profiles/seeker/").then((r) => r.data),
    onSuccess: (data) => reset(data),
  } as any);

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch("/profiles/seeker/", data),
    onSuccess: () => {
      toast.success("Profile updated!");
      qc.invalidateQueries({ queryKey: ["seeker-profile"] });
    },
    onError: () => toast.error("Failed to update profile."),
  });

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
          <Upload className="w-4 h-4" /> Resume
        </h2>
        {profile?.resume ? (
          <div className="flex items-center gap-3">
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-700">{profile.resume_filename || "Resume.pdf"}</div>
            <a href={profile.resume} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:underline">View</a>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No resume uploaded yet.</p>
        )}
      </div>
    </div>
  );
}
