import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { useNotificationSocket } from "./hooks/useWebSocket";

import Layout from "./components/layout/Layout";
import ProtectedRoute from "./components/shared/ProtectedRoute";

// Auth pages
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./pages/auth/ForgotPasswordPage"));

// Shared
const JobSearchPage = lazy(() => import("./pages/JobSearchPage"));
const JobDetailPage = lazy(() => import("./pages/JobDetailPage"));

// Seeker pages
const SeekerDashboard = lazy(() => import("./pages/seeker/SeekerDashboard"));
const SeekerProfilePage = lazy(() => import("./pages/seeker/SeekerProfilePage"));
const ApplicationsPage = lazy(() => import("./pages/seeker/ApplicationsPage"));
const RecommendationsPage = lazy(() => import("./pages/seeker/RecommendationsPage"));

// Recruiter pages
const RecruiterDashboard = lazy(() => import("./pages/recruiter/RecruiterDashboard"));
const PostJobPage = lazy(() => import("./pages/recruiter/PostJobPage"));
const ManageJobsPage = lazy(() => import("./pages/recruiter/ManageJobsPage"));
const ApplicantsPage = lazy(() => import("./pages/recruiter/ApplicantsPage"));
const AnalyticsDashboard = lazy(() => import("./pages/recruiter/AnalyticsDashboard"));

// Admin pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));

// Shared pages
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  const { isAuthenticated } = useAuth();
  useNotificationSocket(isAuthenticated);

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/jobs" element={<Layout><JobSearchPage /></Layout>} />
          <Route path="/jobs/:id" element={<Layout><JobDetailPage /></Layout>} />

          {/* Seeker routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute role="seeker">
              <Layout><SeekerDashboard /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute role="seeker">
              <Layout><SeekerProfilePage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/applications" element={
            <ProtectedRoute role="seeker">
              <Layout><ApplicationsPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/recommendations" element={
            <ProtectedRoute role="seeker">
              <Layout><RecommendationsPage /></Layout>
            </ProtectedRoute>
          } />

          {/* Recruiter routes */}
          <Route path="/recruiter/dashboard" element={
            <ProtectedRoute role="recruiter">
              <Layout><RecruiterDashboard /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/recruiter/jobs/post" element={
            <ProtectedRoute role="recruiter">
              <Layout><PostJobPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/recruiter/jobs" element={
            <ProtectedRoute role="recruiter">
              <Layout><ManageJobsPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/recruiter/jobs/:jobId/applicants" element={
            <ProtectedRoute role="recruiter">
              <Layout><ApplicantsPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/recruiter/analytics" element={
            <ProtectedRoute role="recruiter">
              <Layout><AnalyticsDashboard /></Layout>
            </ProtectedRoute>
          } />

          {/* Admin routes */}
          <Route path="/admin" element={
            <ProtectedRoute role="admin">
              <Layout><AdminDashboard /></Layout>
            </ProtectedRoute>
          } />

          {/* Shared authenticated routes */}
          <Route path="/messages" element={
            <ProtectedRoute>
              <Layout><MessagesPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/notifications" element={
            <ProtectedRoute>
              <Layout><NotificationsPage /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/" element={<Navigate to="/jobs" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
