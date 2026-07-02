import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Send, MessageCircle } from "lucide-react";
import api from "../lib/axios";
import { useAuth } from "../hooks/useAuth";

export default function MessagesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [activeConvo, setActiveConvo] = useState<any>(null);
  const [message, setMessage] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.get("/messaging/conversations/").then((r) => r.data.results ?? r.data),
  });

  // Auto-open conversation from ?convo=ID
  useEffect(() => {
    const convoId = searchParams.get("convo");
    if (!convoId || !conversations) return;
    const found = conversations.find((c: any) => c.id === convoId);
    if (found) setActiveConvo(found);
  }, [conversations, searchParams]);

  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ["messages", activeConvo?.id],
    queryFn: () =>
      api.get(`/messaging/conversations/${activeConvo.id}/messages/`).then((r) => r.data.results ?? r.data),
    enabled: !!activeConvo,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Explicitly tell the backend the user opened this conversation, so unread
  // messages get marked read — a deliberate action, not a GET side effect.
  useEffect(() => {
    if (!activeConvo) return;
    api.post(`/messaging/conversations/${activeConvo.id}/read/`).catch(() => {});
  }, [activeConvo?.id]);

  // WebSocket for real-time messages in active convo
  useEffect(() => {
    if (!activeConvo) return;
    const token = localStorage.getItem("access_token");
    const wsBase = import.meta.env.VITE_WS_URL
      ?? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
    const ws = new WebSocket(`${wsBase}/ws/chat/${activeConvo.id}/?token=${token}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "message") {
        refetchMessages();
        // Mark this convo's unread as 0 locally
        qc.setQueryData(["conversations"], (prev: any[]) =>
          prev?.map((c) => c.id === activeConvo.id ? { ...c, unread_count: 0 } : c)
        );
      }
    };
    return () => ws.close();
  }, [activeConvo?.id]);

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      api.post(`/messaging/conversations/${activeConvo.id}/messages/`, { content }),
    onSuccess: () => { setMessage(""); refetchMessages(); },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ content: message }));
      setMessage("");
    } else {
      sendMutation.mutate(message);
    }
  };

  const handleSelectConvo = (convo: any) => {
    setActiveConvo(convo);
    // Optimistically clear unread badge when opening
    qc.setQueryData(["conversations"], (prev: any[]) =>
      prev?.map((c) => c.id === convo.id ? { ...c, unread_count: 0 } : c)
    );
  };

  const getInitials = (name: string) =>
    name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  return (
    <div className="flex h-[calc(100vh-10rem)] bg-white rounded-xl border border-gray-200 overflow-hidden">

      {/* Sidebar */}
      <div className="w-80 border-r border-gray-100 flex flex-col shrink-0">
        <div className="px-4 py-3.5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Messages</h2>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {conversations?.map((convo: any) => {
            const name = convo.other_participant?.full_name || "Unknown";
            const isActive = activeConvo?.id === convo.id;
            const unread = convo.unread_count ?? 0;

            return (
              <div
                key={convo.id}
                onClick={() => handleSelectConvo(convo)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors
                  ${isActive ? "bg-primary-50 border-l-[3px] border-l-primary-500" : "hover:bg-gray-50 border-l-[3px] border-l-transparent"}`}
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {getInitials(name)}
                </div>

                {/* Name + preview */}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm truncate ${unread > 0 ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
                    {name}
                  </div>
                  {convo.last_message && (
                    <div className={`text-xs truncate mt-0.5 ${unread > 0 ? "text-gray-700 font-medium" : "text-gray-400"}`}>
                      {convo.last_message.content}
                    </div>
                  )}
                </div>

                {/* Right side: unread badge */}
                {unread > 0 && (
                  <span className="shrink-0 min-w-[20px] h-5 bg-primary-600 text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1.5">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </div>
            );
          })}

          {conversations?.length === 0 && (
            <div className="text-center text-gray-400 text-sm p-8">No conversations yet.</div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeConvo ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-xs font-bold">
                {getInitials(activeConvo.other_participant?.full_name || "")}
              </div>
              <span className="font-semibold text-gray-900 text-sm">
                {activeConvo.other_participant?.full_name}
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
              {messages?.map((msg: any) => {
                const isMine = msg.sender?.id === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[65%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                      ${isMine
                        ? "bg-primary-600 text-white rounded-br-sm"
                        : "bg-gray-100 text-gray-900 rounded-bl-sm"}`}>
                      {msg.content}
                      <div className={`text-[10px] mt-1 text-right ${isMine ? "text-primary-200" : "text-gray-400"}`}>
                        {new Date(msg.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="px-4 py-3 border-t border-gray-100 flex gap-2">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50"
              />
              <button
                type="submit"
                disabled={!message.trim()}
                className="bg-primary-600 text-white p-2.5 rounded-full hover:bg-primary-700 disabled:opacity-40 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-200" />
              <p className="text-sm">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
