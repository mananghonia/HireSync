import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useMutation } from "@tanstack/react-query";
import { GoogleLogin } from "@react-oauth/google";
import toast from "react-hot-toast";
import { Briefcase } from "lucide-react";
import api from "../../lib/axios";
import { setCredentials } from "../../features/auth/authSlice";

interface LoginForm { email: string; password: string; }

function RolePickerModal({ onSelect }: { onSelect: (role: string) => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-2 text-center">One more step</h2>
        <p className="text-sm text-gray-500 text-center mb-6">How will you use HireSync?</p>
        <div className="space-y-3">
          <button onClick={() => onSelect("seeker")}
            className="w-full border-2 border-primary-200 hover:border-primary-500 hover:bg-primary-50 rounded-xl p-4 text-left transition">
            <div className="font-medium text-gray-900">Job Seeker</div>
            <div className="text-sm text-gray-500">Find and apply to jobs</div>
          </button>
          <button onClick={() => onSelect("recruiter")}
            className="w-full border-2 border-primary-200 hover:border-primary-500 hover:bg-primary-50 rounded-xl p-4 text-left transition">
            <div className="font-medium text-gray-900">Recruiter</div>
            <div className="text-sm text-gray-500">Post jobs and hire talent</div>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [pendingGoogle, setPendingGoogle] = useState<{ credential: string; email: string } | null>(null);

  const handleAuth = (data: { user: any; access: string; refresh: string }) => {
    dispatch(setCredentials({ user: data.user, tokens: { access: data.access, refresh: data.refresh } }));
    toast.success(`Welcome, ${data.user.first_name}!`);
    navigate(data.user.role === "recruiter" ? "/recruiter/dashboard" : "/dashboard");
  };

  const mutation = useMutation({
    mutationFn: (data: LoginForm) => api.post("/auth/login/", data),
    onSuccess: ({ data }) => handleAuth({ user: data.user, access: data.access, refresh: data.refresh }),
    onError: () => toast.error("Invalid email or password."),
  });

  const googleMutation = useMutation({
    mutationFn: (body: object) => api.post("/auth/google/", body),
    onSuccess: ({ data }) => {
      if (data.new_user) {
        setPendingGoogle({ credential: (googleMutation.variables as any).credential, email: data.email });
        return;
      }
      handleAuth(data);
    },
    onError: () => toast.error("Google sign-in failed. Try again."),
  });

  const handleRolePick = (role: string) => {
    if (!pendingGoogle) return;
    googleMutation.mutate({ credential: pendingGoogle.credential, role });
    setPendingGoogle(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      {pendingGoogle && <RolePickerModal onSelect={handleRolePick} />}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-8">
          <Briefcase className="w-7 h-7 text-primary-600" />
          <span className="text-2xl font-bold text-gray-900">HireSync</span>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-6 text-center">Sign in to your account</h1>

        {/* Google Login */}
        <div className="flex justify-center mb-4">
          <GoogleLogin
            onSuccess={(res) => googleMutation.mutate({ credential: res.credential })}
            onError={() => toast.error("Google sign-in failed.")}
            width="368"
            text="signin_with"
            shape="rectangular"
          />
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 font-medium">or continue with email</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" {...register("email", { required: "Email is required" })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Password</label>
              <Link to="/forgot-password" className="text-xs text-primary-600 hover:underline">Forgot password?</Link>
            </div>
            <input type="password" {...register("password", { required: "Password is required" })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <button type="submit" disabled={mutation.isPending}
            className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50">
            {mutation.isPending ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Don't have an account?{" "}
          <Link to="/register" className="text-primary-600 font-medium hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
