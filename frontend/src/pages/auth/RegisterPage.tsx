import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Briefcase } from "lucide-react";
import api from "../../lib/axios";
import { setCredentials } from "../../features/auth/authSlice";

interface RegisterForm {
  email: string;
  first_name: string;
  last_name: string;
  role: "seeker" | "recruiter";
  password: string;
  password_confirm: string;
}

export default function RegisterPage() {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterForm>({ defaultValues: { role: "seeker" } });
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: (data: RegisterForm) => api.post("/auth/register/", data),
    onSuccess: ({ data }) => {
      dispatch(setCredentials({ user: data.user, tokens: data.tokens }));
      toast.success("Account created!");
      navigate(data.user.role === "recruiter" ? "/recruiter/dashboard" : "/dashboard");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.email?.[0] || "Registration failed.";
      toast.error(msg);
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-6">
          <Briefcase className="w-7 h-7 text-primary-600" />
          <span className="text-2xl font-bold text-gray-900">HireSync</span>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-6 text-center">Create your account</h1>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input {...register("first_name", { required: true })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input {...register("last_name", { required: true })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" {...register("email", { required: true })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">I am a...</label>
            <div className="grid grid-cols-2 gap-3">
              {(["seeker", "recruiter"] as const).map((role) => (
                <label key={role} className={`flex items-center justify-center gap-2 border-2 rounded-lg p-3 cursor-pointer text-sm font-medium transition-colors
                  ${watch("role") === role ? "border-primary-500 bg-primary-50 text-primary-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                  <input type="radio" value={role} {...register("role")} className="hidden" />
                  {role === "seeker" ? "Job Seeker" : "Recruiter"}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" {...register("password", { required: true, minLength: 8 })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input type="password" {...register("password_confirm", {
              required: true,
              validate: (v) => v === watch("password") || "Passwords don't match",
            })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            {errors.password_confirm && <p className="text-red-500 text-xs mt-1">{errors.password_confirm.message}</p>}
          </div>

          <button type="submit" disabled={mutation.isPending}
            className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50">
            {mutation.isPending ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
