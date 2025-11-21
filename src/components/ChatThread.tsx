import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Send, Star, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import axios from "axios";

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  isOwn: boolean;
}

interface Chat {
  id: string;
  name: string;
  isGroup: boolean;
  isFavorite: boolean;
}

interface ChatThreadProps {
  chat: Chat;
  onToggleFavorite: () => void;
  onOpenInfo: () => void;
}

const API_BASE = "https://travel2-x2et.onrender.com/api";

const ChatThread = ({ chat, onToggleFavorite, onOpenInfo }: ChatThreadProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const token = localStorage.getItem("token");

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch messages on chat change
  useEffect(() => {
    const fetchMessages = async () => {
      if (!chat?.id || !token) return;
      setLoading(true);

      try {
        const res = await axios.get(`${API_BASE}/messages/${chat.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const fetched = res.data.messages.map((m: any) => ({
          id: m.id.toString(),
          sender: m.sender?.name || "Unknown",
          content: m.content,
          timestamp: new Date(m.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          isOwn: m.sender?.isMe || false,
        }));

        setMessages(fetched);
      } catch {}
      finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [chat.id, token]);

  // SEND message — only send to backend
  const handleSend = async () => {
    if (!message.trim()) return;

    try {
      await axios.post(
        `${API_BASE}/messages`,
        { conversationId: chat.id, content: message },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Clear input only — WebSocket will update UI
      setMessage("");
    } catch {}
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSend();
  };

  return (
    <div className="flex flex-col h-full bg-background">
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback className="bg-gradient-primary text-primary-foreground font-semibold">
              {chat.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div>
            <h3 className="font-semibold">{chat.name}</h3>
            {chat.isGroup && (
              <p className="text-xs text-muted-foreground">Group Chat</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleFavorite}
            className={cn(chat.isFavorite && "text-primary")}
          >
            <Star
              className={cn(
                "w-5 h-5",
                chat.isFavorite ? "fill-current" : "text-muted-foreground"
              )}
            />
          </Button>

          {chat.isGroup && (
            <Button variant="ghost" size="icon" onClick={onOpenInfo}>
              <Info className="w-5 h-5 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10 no-scrollbar">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center items-center h-full text-muted-foreground">
            No messages yet. Start the conversation 👋
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex items-end gap-2",
                msg.isOwn ? "justify-end" : "justify-start"
              )}
            >
              {!msg.isOwn && (
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-secondary text-xs">
                    {msg.sender.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}

              <div
                className={cn(
                  "max-w-[70%] rounded-2xl px-4 py-2 shadow-sm",
                  msg.isOwn
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-foreground"
                )}
              >
                {chat.isGroup && !msg.isOwn && (
                  <p className="text-xs font-semibold text-muted-foreground mb-1">
                    {msg.sender}
                  </p>
                )}
                <p className="text-sm break-words">{msg.content}</p>
                <p className="text-[11px] mt-1 text-right text-muted-foreground/70">
                  {msg.timestamp}
                </p>
              </div>

              {msg.isOwn && (
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">
                    You
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t flex items-center gap-2 bg-card">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1"
        />
        <Button onClick={handleSend} size="icon" disabled={!message.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default ChatThread;
