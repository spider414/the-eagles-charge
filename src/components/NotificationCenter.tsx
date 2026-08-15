import { useState } from "react";
import { Bell, Check, CheckCheck, Trash2, X, BellOff, Wallet, ShoppingCart, FileText, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications, AppNotification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";

const typeIcons: Record<string, React.ReactNode> = {
  transaction: <ShoppingCart className="h-4 w-4 text-primary" />,
  wallet: <Wallet className="h-4 w-4 text-primary" />,
  registration: <FileText className="h-4 w-4 text-primary" />,
  promotion: <Megaphone className="h-4 w-4 text-accent-foreground" />,
  general: <Bell className="h-4 w-4 text-muted-foreground" />,
};

const NotificationItem = ({
  notification,
  onRead,
  onDelete,
}: {
  notification: AppNotification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) => {
  return (
    <div
      className={`flex items-start gap-3 p-3 border-b border-border/50 transition-colors cursor-pointer hover:bg-muted/50 ${
        !notification.read ? "bg-primary/5" : ""
      }`}
      onClick={() => !notification.read && onRead(notification.id)}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted flex-shrink-0 mt-0.5">
        {typeIcons[notification.type] || typeIcons.general}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm leading-tight ${!notification.read ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
            {notification.title}
          </p>
          {!notification.read && (
            <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.body}</p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notification.id);
        }}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
};

const NotificationCenter = () => {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center text-[10px] font-bold bg-destructive text-destructive-foreground border-2 border-background">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 max-h-[70vh] flex flex-col"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm">Notifications</h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={markAllAsRead}
              >
                <CheckCheck className="h-3 w-3" />
                Read all
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                onClick={clearAll}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Notification list */}
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <BellOff className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm font-medium">No notifications yet</p>
            <p className="text-xs mt-0.5">We'll notify you when something happens</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 max-h-[50vh]">
            <div className="divide-y divide-border/30">
              {notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onRead={markAsRead}
                  onDelete={deleteNotification}
                />
              ))}
            </div>
          </ScrollArea>
        )}
        <div className="border-t p-2">
          <Link
            to="/notifications"
            className="block w-full rounded-md px-2 py-1.5 text-center text-xs font-medium text-primary hover:bg-muted"
          >
            View message history
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationCenter;
