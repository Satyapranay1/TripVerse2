import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import TopNavbar from "@/components/TopNavbar";
import BottomNavBar from "@/components/BottomNavBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Star, MessageSquare, Users } from "lucide-react";
import ChatList from "@/components/ChatList";
import ChatThread from "@/components/ChatThread";
import GroupInfoDrawer from "@/components/GroupInfoDrawer";
import CreateGroupDialog from "@/components/CreateGroupDialog";
import { Input } from "@/components/ui/input";
import axios from "axios";
import { toast } from "sonner";
import { Client, IMessage, StompSubscription } from "@stomp/stompjs";

interface CommunityProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  isOwn: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

type ChatType = "GROUP" | "DM" | "USER";

interface Chat {
  id: string;
  name: string;
  isGroup: boolean;
  isFavorite: boolean;
  unread: number;
  timestamp: string;
  members: any[];
  messages: Message[];
  type?: ChatType;
}

interface CurrentUser {
  id: number;
  name: string;
  email: string;
}

const API_BASE = "https://travel2-x2et.onrender.com";
const WS_URL = "wss://travel2-x2et.onrender.com/ws";

const Community = ({ theme, toggleTheme }: CommunityProps) => {
  const navigate = useNavigate();

  const [activeFilter, setActiveFilter] = useState<
    "all" | "favorites" | "groups" | "users"
  >("all");
  const [selectedChatId, setSelectedChatId] = useState<string>();
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const token = localStorage.getItem("token");

  const stompClientRef = useRef<Client | null>(null);
  const subscriptionRef = useRef<StompSubscription | null>(null);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    const fetchData = async () => {
      try {
        const meRes = await axios.get(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const me: CurrentUser = meRes.data;
        setCurrentUser(me);

        await Promise.all([fetchConversations(), fetchAllUsers()]);
      } catch (error) {
        navigate("/login");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate, token]);

  const fetchConversations = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data.conversations || [];

      const formattedChats: Chat[] = data.map((conv: any) => {
        const type: ChatType = conv.type === "DM" ? "DM" : "GROUP";

        return {
          id: conv.id.toString(),
          name: conv.name || "Conversation",
          isGroup: type === "GROUP",
          isFavorite: false,
          unread: 0,
          timestamp: conv.updatedAt
            ? new Date(conv.updatedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "",
          members: conv.members || [],
          messages: [],
          type,
        };
      });

      setChats(formattedChats);
    } catch {
      toast.error("Failed to load conversations");
    }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/auth/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data);
    } catch {}
  };

  useEffect(() => {
    if (!selectedChatId || !currentUser) return;

    const fetchMessages = async () => {
      try {
        const res = await axios.get(
          `${API_BASE}/api/messages/${selectedChatId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const msgs = res.data.messages || [];

        setChats((prev) =>
          prev.map((chat) =>
            chat.id === selectedChatId
              ? {
                  ...chat,
                  messages: msgs.map((m: any) => ({
                    id: m.id.toString(),
                    sender: m.sender?.name || "Unknown",
                    content: m.content,
                    timestamp: new Date(m.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                    isOwn: m.sender?.id === currentUser.id,
                  })),
                }
              : chat
          )
        );
      } catch {}
    };

    fetchMessages();
  }, [selectedChatId, currentUser, token]);

  useEffect(() => {
    if (!token) return;

    const client = new Client({
      brokerURL: WS_URL,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,
    });

    client.activate();
    stompClientRef.current = client;

    return () => {
      subscriptionRef.current?.unsubscribe();
      client.deactivate();
      stompClientRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const client = stompClientRef.current;

    if (!client || !client.connected || !selectedChatId || !currentUser) {
      return;
    }

    subscriptionRef.current?.unsubscribe();

    const sub = client.subscribe(
      `/topic/conversations/${selectedChatId}`,
      (frame: IMessage) => {
        try {
          const body = JSON.parse(frame.body);

          const newMessage: Message = {
            id: body.id?.toString() ?? crypto.randomUUID(),
            sender: body.sender?.name || "Unknown",
            content: body.content,
            timestamp: body.createdAt
              ? new Date(body.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
            isOwn: body.sender?.id === currentUser.id,
          };

          setChats((prev) =>
            prev.map((chat) =>
              chat.id === selectedChatId
                ? {
                    ...chat,
                    messages: [...chat.messages, newMessage],
                  }
                : chat
            )
          );
        } catch {}
      }
    );

    subscriptionRef.current = sub;

    return () => sub.unsubscribe();
  }, [selectedChatId, currentUser]);

  const handleSendMessage = async (chatId: string, content: string) => {
    if (!content.trim()) return;

    try {
      await axios.post(
        `${API_BASE}/api/messages`,
        { conversationId: chatId, content },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch {
      toast.error("Failed to send message");
    }
  };

  const handleCreateGroup = async (newGroup: {
    name: string;
    memberIds: number[];
  }) => {
    try {
      const res = await axios.post(
        `${API_BASE}/api/conversations/group`,
        newGroup,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const group = res.data.group;

      const newChat: Chat = {
        id: group.id.toString(),
        name: group.name,
        isGroup: true,
        isFavorite: false,
        unread: 0,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        members: group.members || [],
        messages: [],
        type: "GROUP",
      };

      setChats((prev) => [newChat, ...prev]);
      setShowCreateGroup(false);
      setSelectedChatId(newChat.id);
    } catch {
      toast.error("Failed to create group");
    }
  };

  const handleOpenDm = async (user: User) => {
    try {
      const res = await axios.post(
        `${API_BASE}/api/conversations/dm?userId=${user.id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const conv = res.data.conversation;
      const chatId = conv.id.toString();
      const type: ChatType = conv.type === "DM" ? "DM" : "GROUP";

      if (!chats.some((c) => c.id === chatId)) {
        const newChat: Chat = {
          id: chatId,
          name: conv.name || user.name,
          isGroup: type === "GROUP",
          isFavorite: false,
          unread: 0,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          members: conv.members || [user],
          messages: [],
          type,
        };

        setChats((prev) => [newChat, ...prev]);
      }

      setSelectedChatId(chatId);
    } catch {
      toast.error("Failed to open DM");
    }
  };

  const handleToggleFavorite = (chatId?: string) => {
    if (!chatId) return;
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId ? { ...c, isFavorite: !c.isFavorite } : c
      )
    );
  };

  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedChat = chats.find((c) => c.id === selectedChatId);

  const combinedAll: Chat[] = [
    ...filteredChats,
    ...users.map((u) => ({
      id: `user-${u.id}`,
      name: u.name,
      isGroup: false,
      isFavorite: false,
      unread: 0,
      timestamp: "",
      members: [u],
      messages: [],
      type: "USER" as const,
    })),
  ];

  if (loading || !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading community...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <TopNavbar theme={theme} toggleTheme={toggleTheme} />

      <div className="container py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Community
          </h1>
          <Button
            onClick={() => setShowCreateGroup(true)}
            size="sm"
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            New Group
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-240px)]">
          <div
            className={`border rounded-xl bg-card overflow-hidden ${
              selectedChatId ? "hidden md:block" : ""
            }`}
          >
            <Tabs
              value={activeFilter}
              onValueChange={(v) =>
                setActiveFilter(v as "all" | "favorites" | "groups" | "users")
              }
              className="h-full flex flex-col"
            >
              <div className="p-4 border-b space-y-3">
                <TabsList className="w-full grid grid-cols-4">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="favorites">Favorites</TabsTrigger>
                  <TabsTrigger value="groups">Groups</TabsTrigger>
                  <TabsTrigger value="users">Users</TabsTrigger>
                </TabsList>

                <Input
                  placeholder="Search chats or users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <TabsContent value="all" className="flex-1 overflow-y-auto p-4">
                <h4 className="font-semibold mb-3 text-sm text-muted-foreground">
                  All Groups, DMs & Users
                </h4>
                {combinedAll
                  .filter((i) =>
                    i.name.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary cursor-pointer transition"
                      onClick={() =>
                        item.type === "USER"
                          ? handleOpenDm(item.members[0])
                          : setSelectedChatId(item.id)
                      }
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          {item.type === "USER" || item.type === "DM" ? (
                            <MessageSquare className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <Users className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex flex-col">
                          <span className="font-medium">{item.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {item.type === "GROUP"
                              ? "Group Chat"
                              : item.type === "DM"
                              ? "Direct Message"
                              : "User"}
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.type === "USER") {
                            handleOpenDm(item.members[0]);
                          } else {
                            handleToggleFavorite(item.id);
                          }
                        }}
                      >
                        {item.type === "USER" ? (
                          <MessageSquare className="w-4 h-4" />
                        ) : (
                          <Star className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  ))}
              </TabsContent>

              <TabsContent
                value="favorites"
                className="flex-1 overflow-y-auto p-4"
              >
                <ChatList
                  chats={filteredChats.filter((c) => c.isFavorite)}
                  activeFilter="favorites"
                  selectedChatId={selectedChatId}
                  onSelectChat={setSelectedChatId}
                />
              </TabsContent>

              <TabsContent
                value="groups"
                className="flex-1 overflow-y-auto p-4"
              >
                <ChatList
                  chats={filteredChats.filter((c) => c.isGroup)}
                  activeFilter="groups"
                  selectedChatId={selectedChatId}
                  onSelectChat={setSelectedChatId}
                />
              </TabsContent>

              <TabsContent value="users" className="flex-1 overflow-y-auto p-4">
                <h4 className="font-semibold mb-3 text-sm text-muted-foreground">
                  Registered Users
                </h4>
                {users
                  .filter((u) =>
                    u.name.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary cursor-pointer transition"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{user.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDm(user)}
                        >
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const existing = chats.find(
                              (c) =>
                                c.type === "DM" &&
                                c.name.toLowerCase() === user.name.toLowerCase()
                            );
                            if (existing) handleToggleFavorite(existing.id);
                            else handleOpenDm(user);
                          }}
                        >
                          <Star className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </TabsContent>
            </Tabs>
          </div>

          <div
            className={`md:col-span-2 border rounded-xl bg-card overflow-hidden ${
              !selectedChatId ? "hidden md:flex" : "flex"
            } h-full flex flex-col`}
          >
            {selectedChat ? (
              <ChatThread
                chat={selectedChat}
                onToggleFavorite={() => handleToggleFavorite(selectedChat.id)}
                onOpenInfo={() => setShowGroupInfo(true)}
              />
            ) : (
              <div className="flex items-center justify-center w-full text-muted-foreground">
                Select a chat or open a user DM
              </div>
            )}
          </div>
        </div>
      </div>

      <GroupInfoDrawer
        open={showGroupInfo}
        onClose={() => setShowGroupInfo(false)}
        group={selectedChat}
      />

      <CreateGroupDialog
        open={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        mode="create"
        onCreateGroup={handleCreateGroup}
      />

      <BottomNavBar />
    </div>
  );
};

export default Community;
