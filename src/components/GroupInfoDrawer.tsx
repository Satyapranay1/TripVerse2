import { useState, useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  UserPlus,
  UserMinus,
  X,
  LogOut,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import CreateGroupDialog from "@/components/CreateGroupDialog";

interface Member {
  id: string;
  name: string;
  email?: string;
}

interface Group {
  id: string;
  name: string;
  members: Member[];
}

interface GroupInfoDrawerProps {
  open: boolean;
  onClose: () => void;
  group: Group | null;
  isAdmin?: boolean;
}

const API_BASE = "https://travel2-x2et.onrender.com/api";

const GroupInfoDrawer = ({
  open,
  onClose,
  group,
  isAdmin = true,
}: GroupInfoDrawerProps) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!group || !open) return;

    const fetchMembers = async () => {
      setLoading(true);
      try {
        const res = await axios.get(
          `${API_BASE}/conversations/${group.id}/members`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const normalized = res.data.members.map((m: any) => ({
          id: m.user?.id?.toString() || m.id?.toString(),
          name: m.user?.name || m.name || "Unknown",
          email: m.user?.email || "",
        }));

        setMembers(normalized);
      } catch {
        toast.error("Failed to load group members");
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [group, open]);

  const handleRemoveMember = async (
    memberId: string,
    memberName: string
  ) => {
    if (!group) return;

    try {
      await axios.delete(
        `${API_BASE}/conversations/${group.id}/members/${memberId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(`${memberName} removed`);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch {
      toast.error("Failed to remove member");
    }
  };

  const handleLeaveGroup = async () => {
    if (!group) return;

    try {
      const me = await axios.get(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const myId = me.data.id;

      await axios.delete(
        `${API_BASE}/conversations/${group.id}/members/${myId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("You left the group");
      onClose();
    } catch {
      toast.error("Failed to leave group");
    }
  };

  const handleDeleteGroup = async () => {
    if (!group) return;

    try {
      await axios.delete(`${API_BASE}/conversations/${group.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Group deleted");
      onClose();
    } catch {
      toast.error("Failed to delete group");
    }
  };

  if (!group) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent
          side="right"
          className="w-[600px] sm:w-[640px] p-0 bg-background border-l flex h-full shadow-xl"
        >
          <div className="absolute top-4 right-4 z-10">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex-1 p-8 overflow-y-auto space-y-8">
            <div className="flex flex-col items-center gap-3">
              <Avatar className="w-28 h-28 shadow-lg">
                <AvatarFallback className="text-3xl bg-gradient-primary text-primary-foreground">
                  {group.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-semibold">{group.name}</h2>
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">
                  Members ({members.length})
                </h3>

                {isAdmin && (
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => setShowAddDialog(true)}
                  >
                    <UserPlus className="w-4 h-4" />
                    Add Members
                  </Button>
                )}
              </div>

              {loading ? (
                <div className="text-center text-muted-foreground py-6 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
                  Loading members...
                </div>
              ) : (
                <div className="space-y-3">
                  {members.map((member) => {
                    const name = member.name || "Unknown";

                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/25 hover:bg-muted/40 transition border border-muted/30"
                      >
                        <div className="flex items-center gap-4">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback>
                              {name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          <div>
                            <p className="font-medium text-[15px]">{name}</p>
                            <p className="text-xs text-muted-foreground">
                              {member.email}
                            </p>
                          </div>
                        </div>

                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              handleRemoveMember(member.id, name)
                            }
                          >
                            <UserMinus className="w-5 h-5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2 pt-6 border-t">
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={handleLeaveGroup}
              >
                <LogOut className="w-4 h-4" /> Leave Group
              </Button>

              {isAdmin && (
                <Button
                  variant="destructive"
                  className="w-full justify-start gap-2"
                  onClick={handleDeleteGroup}
                >
                  <Trash2 className="w-4 h-4" /> Delete Group
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <CreateGroupDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        mode="add"
        conversationId={group.id}
        existingMembers={members.map((m) => Number(m.id))}
        onMembersAdded={(newIds) => {
          setMembers((prev) => [
            ...prev,
            ...newIds.map((id) => ({
              id: id.toString(),
              name: `User ${id}`,
            })),
          ]);
          toast.success("Members added");
        }}
      />
    </>
  );
};

export default GroupInfoDrawer;
