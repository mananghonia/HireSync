import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Briefcase, ArrowLeft, Mail, KeyRound, Lock } from "lucide-react";
import api from "../../lib/axios";

type Step = "email" | "reset";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const sendOtp = useMutation({
    mutationFn: (e: string) => api.post("/auth/forgot-password/", { email: e }),
    onSuccess: () => {
      toast.success("OTP sent to your email!");
      setStep("reset");
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || "Failed to send OTP."),
  });

  const resetPwd = useMutation({
    mutationFn: () => api.post("/auth/reset-password/", { email, otp, new_password: newPassword }),
    onSuccess: () => {
      toast.success("Password reset! Please log in.");
      navigate("/login");
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || "Reset failed. Check your OTP."),
  });

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-full max-w-md">

        {/* Header */}
        <div className="flex items-center gap-2 justify-center mb-6">
          <Briefcase className="w-7 h-7 text-primary-600" />
          <span className="text-2xl font-bold text-gray-900">HireSync</span>
        </div>

        {step === "email" ? (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <Mail className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Forgot password?</h1>
                <p className="text-sm text-gray-500">We'll send a 6-digit OTP to your email</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <button
                onClick={() => { if (email) sendOtp.mutate(email); }}
                disabled={sendOtp.isPending || !email}
                className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {sendOtp.isPending ? "Sending OTP..." : "Send OTP"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <KeyRound className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Enter OTP & new password</h1>
                <p className="text-sm text-gray-500">OTP sent to <strong>{email}</strong></p>
              </div>
            </div>

            <div className="space-y-4">
              {/* OTP boxes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">6-digit OTP</label>
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••••"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-center text-2xl font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                {confirm && newPassword !== confirm && (
                  <p className="text-red-500 text-xs mt-1">Passwords don't match</p>
                )}
              </div>

              <button
                onClick={() => {
                  if (newPassword !== confirm) { toast.error("Passwords don't match"); return; }
                  resetPwd.mutate();
                }}
                disabled={resetPwd.isPending || otp.length < 6 || !newPassword || newPassword !== confirm}
                className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {resetPwd.isPending ? "Resetting..." : "Reset Password"}
              </button>

              <button
                onClick={() => { setStep("email"); setOtp(""); }}
                className="w-full text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> Resend OTP
              </button>
            </div>
          </>
        )}

        <p className="text-center text-sm text-gray-600 mt-6">
          <Link to="/login" className="text-primary-600 font-medium hover:underline flex items-center justify-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
