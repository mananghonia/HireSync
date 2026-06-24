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

    // VITE_WS_URL is set in production (e.g. wss://hiresync.railway.app).
    // In dev the Vite proxy handles /ws → localhost:8000.
    const wsBase = import.meta.env.VITE_WS_URL
      ?? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
    const wsUrl = `${wsBase}/ws/notifications/?token=${token}`;
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
          const convoId = notif.data?.conversation_id;
          // Bump unread count on the conversation in cache so Navbar badge updates instantly
          qc.setQueryData(["conversations"], (prev: any[]) =>
            prev?.map((c: any) =>
              c.id === convoId ? { ...c, unread_count: (c.unread_count ?? 0) + 1 } : c
            )
          );
          toast(
            `💬 ${notif.title}\n${notif.message}`,
            {
              duration: 5000,
              position: "bottom-right",
              style: { cursor: "pointer", maxWidth: "320px", whiteSpace: "pre-line" },
            } as any
          );
        } else {
          toast(`🔔 ${notif.title}`, { duration: 4000, position: "bottom-right" });
          qc.invalidateQueries({ queryKey: ["my-applications"] });
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
