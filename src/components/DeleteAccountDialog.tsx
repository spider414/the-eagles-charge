import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DeleteAccountDialog = ({ open, onOpenChange }: DeleteAccountDialogProps) => {
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleDeleteAccount = async () => {
    if (confirmText !== "DELETE") {
      toast({
        title: "Confirmation Required",
        description: "Please type DELETE to confirm account deletion.",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to delete your account.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);

    try {
      // Schedules deletion (7-day grace period), emails admins and confirms to the user
      const { error } = await supabase.functions.invoke("request-account-deletion", {
        body: { reason: "User requested deletion" },
      });

      if (error) throw error;

      toast({
        title: "Account Scheduled for Deletion",
        description:
          "Your account will be permanently deleted in 7 days. We've emailed you a confirmation — log back in before then to cancel.",
      });

      // Sign out the user
      await signOut();
      onOpenChange(false);
      navigate("/");
    } catch (error) {
      console.error("Failed to schedule account deletion:", error);
      toast({
        title: "Error",
        description: "Failed to schedule account deletion. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmText("");
    }
    onOpenChange(newOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-xl">Delete Account</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-left">
              <p className="text-muted-foreground">
                This action will permanently delete your account and all associated data. 
                This process cannot be undone.
              </p>
              
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-2">
                <p className="font-semibold text-destructive flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  What will be deleted:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Your profile and personal information</li>
                  <li>All transaction history</li>
                  <li>Saved favorite numbers</li>
                  <li>Wallet balance (non-refundable)</li>
                  <li>Referral earnings and history</li>
                </ul>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  <strong>Important:</strong> Your account will be permanently deleted after 
                  <span className="font-bold"> 7 days</span>. During this period, you can cancel 
                  the deletion by logging back into your account.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-delete" className="text-foreground">
                  Type <span className="font-mono font-bold text-destructive">DELETE</span> to confirm
                </Label>
                <Input
                  id="confirm-delete"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  placeholder="Type DELETE here"
                  className="font-mono"
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteAccount}
            disabled={confirmText !== "DELETE" || isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Scheduling..." : "Delete My Account"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteAccountDialog;
