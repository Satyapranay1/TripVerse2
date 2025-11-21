import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Avatar, AvatarFallback } from "./ui/avatar";
import axios from "axios";
import { toast } from "sonner";

interface CreateGroupDialogProps {
  open: boolean;
  onClose: () => void;

  mode: "create" | "add";

  onCreateGroup?: (group: any) => void;

  conversationId?: string | number;
  existingMembers?: number[];
  onMembersAdded?: (added: number[]) => void;
}

interface User {
  id: number;
  name: string;
  email: string;
}

const API_BASE = "https://travel2-x2et.onrender.com/api";

const CreateGroupDialog = ({
  open,
  onClose,
  mode,
  onCreateGroup,
  conversationId,
  existingMembers = [],
  onMembersAdded,
}: CreateGroupDialogProps) => {
  const [groupName, setGroupName] = useState("");
  const [contacts, setContacts] = useState<User[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem("token");

  /** RESET state every time dialog opens */
  useEffect(() => {
    if (!open) {
      setGroupName("");
      setSelected([]);
      setSearch("");
    }
  }, [open]);

  /** FETCH USERS */
  useEffect(() => {
    if (!open || !token) return;

    const fetchUsers = async () => {
      try {
        const res = await axios.get(`${API_BASE}/auth/all`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        let users: User[] = res.data;

        // Exclude already added members in "add" mode
        if (mode === "add") {
          users = users.filter((u) => !existingMembers.includes(u.id));
        }

        setContacts(users);
      } catch {
        toast.error("Failed to load users");
      }
    };

    fetchUsers();
  }, [open, mode, existingMembers, token]);

  /* ---------------------------------------
        SUBMIT HANDLER
  ---------------------------------------- */
  const handleSubmit = () => {
    if (mode === "create") return handleCreateGroup();
    if (mode === "add") return handleAddMembers();
  };

  /* ---------------------------------------
        CREATE GROUP
  ---------------------------------------- */
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error("Enter a group name");
      return;
    }

    if (selected.length === 0) {
      toast.error("Select at least 1 member");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: groupName.trim(),
        memberIds: Array.from(new Set(selected)),
      };

      const res = await axios.post(`${API_BASE}/conversations/group`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const group = res.data.group;

      onCreateGroup?.({
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
      });

      toast.success("Group created!");

      closeDialog();
    } catch {
      toast.error("Failed to create group");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------------------
        ADD MEMBERS
  ---------------------------------------- */
  const handleAddMembers = async () => {
    if (!conversationId) return;

    if (selected.length === 0) {
      toast.error("Select at least 1 member");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        memberIds: Array.from(new Set(selected)),
      };

      await axios.post(
        `${API_BASE}/conversations/${conversationId}/members`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      onMembersAdded?.(selected);
      toast.success("Members added!");

      closeDialog();
    } catch {
      toast.error("Failed to add members");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------------------
        CLOSE DIALOG
  ---------------------------------------- */
  const closeDialog = () => {
    setGroupName("");
    setSelected([]);
    setSearch("");
    onClose();
  };

  /* ---------------------------------------
        FILTER CONTACTS
  ---------------------------------------- */
  const filtered = contacts.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  /* ---------------------------------------
        UI SECTION
  ---------------------------------------- */
  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create New Group" : "Add Members"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* GROUP NAME (create mode) */}
          {mode === "create" && (
            <div>
              <Label>Group Name</Label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name"
              />
            </div>
          )}

          {/* SEARCH */}
          <div>
            <Label>Search</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
            />
          </div>

          {/* USER LIST */}
          <div className="border rounded-md max-h-64 overflow-y-auto p-2 space-y-2">
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                No users found
              </p>
            ) : (
              filtered.map((user) => {
                const checked = selected.includes(user.id);

                return (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary cursor-pointer"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(isChecked) => {
                        if (isChecked) {
                          setSelected((prev) => [...prev, user.id]);
                        } else {
                          setSelected((prev) =>
                            prev.filter((id) => id !== user.id)
                          );
                        }
                      }}
                    />

                    <Avatar className="w-8 h-8">
                      <AvatarFallback>
                        {user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex flex-col">
                      <span className="font-medium">{user.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* FOOTER BUTTONS */}
        <div className="flex gap-2">
          <Button onClick={closeDialog} variant="outline" className="flex-1">
            Cancel
          </Button>

          <Button onClick={handleSubmit} disabled={loading} className="flex-1">
            {loading
              ? mode === "create"
                ? "Creating..."
                : "Adding..."
              : mode === "create"
              ? "Create Group"
              : "Add Members"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupDialog;
