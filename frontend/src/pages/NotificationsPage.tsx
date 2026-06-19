import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import api from "../lib/axios";

const TYPE_ICONS: Record<string, string> = {
  application_status: "📋",
  new_application: "👤",
  new_message: "💬",
  job_recommendation: "✨",
  general: "🔔",
};

export default function NotificationsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications/").then((r) => r.data.results ?? r.data),
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.post("/notifications/mark-all-read/"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => api.post(`/notifications/${id}/read/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div className="max-w-2xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <button onClick={() => markAllMutation.mutate()}
          className="flex items-center gap-2 text-sm text-primary-600 hover:underline">
          <CheckCheck className="w-4 h-4" /> Mark all read
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {isLoading ? (
          [...Array(5)].map((_, i) => <div key={i} className="p-5 h-16 animate-pulse" />)
        ) : data?.map((n: any) => (
          <div key={n.id}
            onClick={() => !n.is_read && markReadMutation.mutate(n.id)}
            className={`p-5 flex gap-4 cursor-pointer hover:bg-gray-50 transition-colors ${!n.is_read ? "bg-blue-50" : ""}`}>
            <div className="text-2xl shrink-0">{TYPE_ICONS[n.notification_type] || "🔔"}</div>
            <div className="flex-1">
              <div className="font-medium text-gray-900 text-sm">{n.title}</div>
              <div className="text-gray-500 text-sm mt-0.5">{n.message}</div>
              <div className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</div>
            </div>
            {!n.is_read && <div className="w-2 h-2 bg-primary-500 rounded-full shrink-0 mt-2" />}
          </div>
        ))}
        {data?.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Bell className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p className="text-sm">No notifications yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
