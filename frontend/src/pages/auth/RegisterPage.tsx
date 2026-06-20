import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Briefcase, Mail, CheckCircle } from "lucide-react";
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

type Step = "form" | "verify";

export default function RegisterPage() {
  const { register, handleSubmit, watch, getValues, formState: { errors } } = useForm<RegisterForm>({
    defaultValues: { role: "seeker" },
  });
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("form");
  const [otp, setOtp] = useState("");

  // Step 1: send OTP to email
  const sendOtp = useMutation({
    mutationFn: (email: string) => api.post("/auth/send-registration-otp/", { email }),
    onSuccess: () => {
      toast.success("Verification code sent! Check your email.");
      setStep("verify");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || "Failed to send code.";
      toast.error(msg);
    },
  });

  // Step 2: register with OTP
  const registerMutation = useMutation({
    mutationFn: (data: RegisterForm & { otp: string }) => api.post("/auth/register/", data),
    onSuccess: ({ data }) => {
      dispatch(setCredentials({ user: data.user, tokens: data.tokens }));
      toast.success("Account created! Welcome to HireSync.");
      navigate(data.user.role === "recruiter" ? "/recruiter/dashboard" : "/dashboard");
    },
    onError: (err: any) => {
      const d = err?.response?.data;
      const msg = d?.detail || d?.email?.[0] || d?.otp?.[0] || "Registration failed.";
      toast.error(msg);
    },
  });

  const onFormSubmit = (data: RegisterForm) => {
    sendOtp.mutate(data.email.trim().toLowerCase());
  };

  const onVerify = () => {
    if (otp.length < 6) { toast.error("Enter the 6-digit code."); return; }
    registerMutation.mutate({ ...getValues(), otp });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-6">
          <Briefcase className="w-7 h-7 text-primary-600" />
          <span className="text-2xl font-bold text-gray-900">HireSync</span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${step === "form" ? "bg-primary-100 text-primary-700" : "bg-green-100 text-green-700"}`}>
            {step === "verify" ? <CheckCircle className="w-3.5 h-3.5" /> : <span className="w-4 h-4 rounded-full bg-primary-600 text-white flex items-center justify-center text-[10px]">1</span>}
            Your details
          </div>
          <div className="w-8 h-px bg-gray-300" />
          <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${step === "verify" ? "bg-primary-100 text-primary-700" : "bg-gray-100 text-gray-400"}`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${step === "verify" ? "bg-primary-600 text-white" : "bg-gray-300 text-gray-500"}`}>2</span>
            Verify email
          </div>
        </div>

        {step === "form" ? (
          <>
            <h1 className="text-xl font-semibold text-gray-900 mb-5 text-center">Create your account</h1>
            <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input {...register("first_name", { required: "Required" })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  {errors.first_name && <p className="text-red-500 text-xs mt-1">{errors.first_name.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input {...register("last_name", { required: "Required" })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  {errors.last_name && <p className="text-red-500 text-xs mt-1">{errors.last_name.message}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" {...register("email", { required: "Email is required" })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
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
                <input type="password" {...register("password", { required: "Required", minLength: { value: 8, message: "Min 8 characters" } })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input type="password" {...register("password_confirm", {
                  required: "Required",
                  validate: (v) => v === watch("password") || "Passwords don't match",
                })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                {errors.password_confirm && <p className="text-red-500 text-xs mt-1">{errors.password_confirm.message}</p>}
              </div>

              <button type="submit" disabled={sendOtp.isPending}
                className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2">
                <Mail className="w-4 h-4" />
                {sendOtp.isPending ? "Sending code..." : "Send Verification Code"}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Mail className="w-7 h-7 text-primary-600" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900 mb-1">Check your email</h1>
              <p className="text-sm text-gray-500">
                We sent a 6-digit code to <strong className="text-gray-700">{getValues("email")}</strong>
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">Enter verification code</label>
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••••"
                  className="w-full border-2 border-gray-300 rounded-xl px-3 py-3 text-center text-3xl font-bold tracking-widest focus:outline-none focus:border-primary-500"
                  autoFocus
                />
                <p className="text-xs text-gray-400 text-center mt-1">Code expires in 10 minutes</p>
              </div>

              <button
                onClick={onVerify}
                disabled={registerMutation.isPending || otp.length < 6}
                className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {registerMutation.isPending ? "Creating account..." : "Create Account"}
              </button>

              <button
                onClick={() => { setOtp(""); sendOtp.mutate(getValues("email")); }}
                disabled={sendOtp.isPending}
                className="w-full text-sm text-gray-500 hover:text-primary-600 disabled:opacity-50"
              >
                {sendOtp.isPending ? "Resending..." : "Didn't get it? Resend code"}
              </button>

              <button onClick={() => { setStep("form"); setOtp(""); }}
                className="w-full text-sm text-gray-400 hover:text-gray-600">
                ← Change email or details
              </button>
            </div>
          </>
        )}

        <p className="text-center text-sm text-gray-600 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
