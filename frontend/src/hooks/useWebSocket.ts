import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { addNotification, setUnreadCount } from "../features/notifications/notificationsSlice";

export function useNotificationSocket(isAuthenticated: boolean) {
  const dispatch = useDispatch();
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const token = localStorage.getItem("access_token");
    if (!token) return;

    // Use relative WS path so Vite proxy handles it in dev;
    // in production this connects directly to the same host.
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${proto}://${window.location.host}/ws/notifications/?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => console.log("[WS] Notification socket connected");
    ws.onclose = () => console.log("[WS] Notification socket closed");
    ws.onerror = (e) => console.warn("[WS] Notification socket error", e);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "unread_count") {
        dispatch(setUnreadCount(data.count));
        qc.setQueryData(["notif-unread-count"], data.count);
      } else if (data.type === "notification") {
        const notif = data.notification;
        dispatch(addNotification(notif));
        qc.setQueryData<number>(["notif-unread-count"], (prev = 0) => prev + 1);
        qc.invalidateQueries({ queryKey: ["notifications-popup"] });
        qc.invalidateQueries({ queryKey: ["notifications"] });

        // Show a popup toast for new messages
        if (notif.type === "new_message") {
          toast.custom(
            (t) => (
              <div
                onClick={() => {
                  window.location.href = `/messages?convo=${notif.data?.conversation_id}`;
                  toast.dismiss(t.id);
                }}
                className={`cursor-pointer flex items-start gap-3 bg-white border border-gray-200 shadow-lg rounded-xl px-4 py-3 max-w-sm transition-all ${t.visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`}
              >
                <div className="text-xl shrink-0">💬</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{notif.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                </div>
              </div>
            ),
            { duration: 5000, position: "bottom-right" }
          );
          // Also refresh conversation list
          qc.invalidateQueries({ queryKey: ["conversations"] });
        } else {
          // Generic notification toast for application events
          toast(notif.title, { icon: "🔔", duration: 4000, position: "bottom-right" });
        }
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [isAuthenticated, dispatch, qc]);

  return wsRef;
}
