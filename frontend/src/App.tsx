import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { useNotificationSocket } from "./hooks/useWebSocket";

import Layout from "./components/layout/Layout";
import ProtectedRoute from "./components/shared/ProtectedRoute";

// Auth pages
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";

// Shared
import JobSearchPage from "./pages/JobSearchPage";
import JobDetailPage from "./pages/JobDetailPage";

// Seeker pages
import SeekerDashboard from "./pages/seeker/SeekerDashboard";
import SeekerProfilePage from "./pages/seeker/SeekerProfilePage";
import ApplicationsPage from "./pages/seeker/ApplicationsPage";
import RecommendationsPage from "./pages/seeker/RecommendationsPage";

// Recruiter pages
import RecruiterDashboard from "./pages/recruiter/RecruiterDashboard";
import PostJobPage from "./pages/recruiter/PostJobPage";
import ManageJobsPage from "./pages/recruiter/ManageJobsPage";
import ApplicantsPage from "./pages/recruiter/ApplicantsPage";
import AnalyticsDashboard from "./pages/recruiter/AnalyticsDashboard";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";

// Shared pages
import MessagesPage from "./pages/MessagesPage";
import NotificationsPage from "./pages/NotificationsPage";

export default function App() {
  const { isAuthenticated } = useAuth();
  useNotificationSocket(isAuthenticated);

  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
