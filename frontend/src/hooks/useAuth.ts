import { useSelector } from "react-redux";
import type { RootState } from "../app/store";

export function useAuth() {
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  return {
    user,
    isAuthenticated,
    isSeeker: user?.role === "seeker",
    isRecruiter: user?.role === "recruiter",
    isAdmin: user?.role === "admin",
  };
}
