import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, MessageCircle } from "lucide-react";
import api from "../lib/axios";
import { useAuth } from "../hooks/useAuth";

export default function MessagesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeConvo, setActiveConvo] = useState<any>(null);
  const [message, setMessage] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.get("/messaging/conversations/").then((r) => r.data.results ?? r.data),
  });

  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ["messages", activeConvo?.id],
    queryFn: () => api.get(`/messaging/conversations/${activeConvo.id}/messages/`).then((r) => r.data.results ?? r.data),
    enabled: !!activeConvo,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!activeConvo) return;
    const token = localStorage.getItem("access_token");
    const ws = new WebSocket(`ws://${window.location.host}/ws/chat/${activeConvo.id}/?token=${token}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "message") refetchMessages();
    };
    return () => ws.close();
  }, [activeConvo?.id]);

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      api.post(`/messaging/conversations/${activeConvo.id}/messages/`, { content }),
    onSuccess: () => {
      setMessage("");
      refetchMessages();
    },
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

  return (
    <div className="flex h-[calc(100vh-10rem)] bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 border-r border-gray-100 flex flex-col">
        <div className="p-4 border-b border-gray-100 font-semibold text-gray-900">Messages</div>
        <div className="flex-1 overflow-y-auto">
          {conversations?.map((convo: any) => (
            <div key={convo.id} onClick={() => setActiveConvo(convo)}
              className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50
                ${activeConvo?.id === convo.id ? "bg-primary-50 border-l-2 border-l-primary-500" : ""}`}>
              <div className="font-medium text-gray-900 text-sm">{convo.other_participant?.full_name}</div>
              {convo.last_message && (
                <div className="text-xs text-gray-500 mt-0.5 truncate">{convo.last_message.content}</div>
              )}
              {convo.unread_count > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 bg-primary-500 text-white text-xs rounded-full mt-1">
                  {convo.unread_count}
                </span>
              )}
            </div>
          ))}
          {conversations?.length === 0 && (
            <div className="text-center text-gray-400 text-sm p-8">No conversations yet.</div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {activeConvo ? (
          <>
            <div className="p-4 border-b border-gray-100 font-semibold text-gray-900">
              {activeConvo.other_participant?.full_name}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages?.map((msg: any) => (
                <div key={msg.id} className={`flex ${msg.sender?.id === user?.id ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm
                    ${msg.sender?.id === user?.id
                      ? "bg-primary-600 text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-900 rounded-bl-sm"}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <form onSubmit={handleSend} className="p-4 border-t border-gray-100 flex gap-2">
              <input value={message} onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <button type="submit" className="bg-primary-600 text-white p-2.5 rounded-lg hover:bg-primary-700">
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
