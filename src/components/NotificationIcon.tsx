import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export function NotificationIcon() {
  const { notifications = [], unreadNotificationCount = 0, markNotificationAsRead, markAllNotificationsAsRead } = useAuth();
  const [open, setOpen] = useState(false);

  console.log("Notification data:", { notifications, unreadNotificationCount });

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
  };

  // Handle clicking on a notification
  const handleNotificationClick = (id: string) => {
    if (markNotificationAsRead) {
      markNotificationAsRead(id);
    }
  };

  // Get notification type icon/color
  const getNotificationTypeStyles = (type: string) => {
    switch (type) {
      case 'due_date_change':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'worker_assignment':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'job_update':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="relative p-2 h-9 w-9 mr-4"
        >
          <Bell className="h-5 w-5" />
          {unreadNotificationCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 px-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-xs flex items-center justify-center rounded-full"
            >
              {unreadNotificationCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-medium">Notifications</h3>
          {notifications.length > 0 && markAllNotificationsAsRead && (
            <Button 
              onClick={markAllNotificationsAsRead} 
              size="sm" 
              variant="ghost" 
              className="text-xs"
            >
              Mark all as read
            </Button>
          )}
        </div>
        
        <ScrollArea className="max-h-[400px]">
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <DropdownMenuItem 
                key={notification.id} 
                className={`p-3 border-b last:border-0 cursor-pointer ${!notification.read ? 'bg-slate-50' : ''}`}
                onClick={() => handleNotificationClick(notification.id)}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-start">
                    <div className="font-medium">{notification.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(notification.timestamp), 'MMM d, h:mm a')}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">{notification.message}</div>
                  
                  {notification.type !== 'general' && (
                    <div className={`text-xs mt-1.5 px-2 py-0.5 rounded-full inline-block w-fit border ${getNotificationTypeStyles(notification.type)}`}>
                      {notification.type.replace('_', ' ')}
                    </div>
                  )}
                </div>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 