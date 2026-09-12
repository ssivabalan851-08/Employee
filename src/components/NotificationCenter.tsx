import React, { useState, useEffect } from "react";
import { Bell, Check, Clock, AlertTriangle } from "lucide-react";
import { Notification } from "../types.ts";
import { DbService } from "../lib/db-service.ts";

interface NotificationCenterProps {
  token: string | null;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ token }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const data = await DbService.getNotifications(token);
      setNotifications(data);
    } catch (err) {
      console.error("Failed to load notifications", err);
    }
  };

  const markAsRead = async (id: string) => {
    if (!token) return;
    try {
      await DbService.markNotificationAsRead(token, id);
      // Optimistically update status
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: "read" } : n))
      );
    } catch (err) {
      console.error("Error marking notification as read", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll notifications every 30 seconds to keep updated
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200/40 transition"
      >
        <span className="sr-only">View notifications</span>
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 inline-flex items-center justify-center px-1 py-0.5 text-[8px] font-bold leading-none text-white bg-slate-900 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop overlay to close */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          
          <div className="absolute right-0 mt-2 w-80 z-50 bg-white rounded-xl border border-slate-200/60 shadow-xl py-3 max-h-[400px] overflow-y-auto">
            <div className="flex items-center justify-between px-4 pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-900">Corporate Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{unreadCount} unread</span>
              )}
            </div>

            <div className="divide-y divide-slate-100 mt-1">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs font-semibold text-slate-400">
                  No notifications recorded.
                </div>
              ) : (
                notifications.map((notif) => {
                  const isUnread = notif.status === "unread";
                  const isWarning = notif.title.includes("Warning") || notif.title.includes("Update") || notif.title.includes("Overdraft");

                  return (
                    <div
                      key={notif.id}
                      onClick={() => {
                        if (isUnread) markAsRead(notif.id);
                      }}
                      className={`p-3.5 text-left text-xs cursor-pointer transition-colors ${
                        isUnread ? "bg-slate-50 hover:bg-slate-100/70" : "hover:bg-slate-50/50"
                      }`}
                    >
                      <div className="flex items-start justify-between space-x-2">
                        <div className="flex items-start space-x-2.5">
                          <div className={`mt-0.5 p-1 rounded-md ${
                            isWarning ? "bg-amber-50 border border-amber-200/40 text-amber-700" : "bg-emerald-50 border border-emerald-200/40 text-emerald-700"
                          }`}>
                            {isWarning ? <AlertTriangle className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                          </div>
                          <div>
                            <span className={`block font-bold ${isUnread ? "text-slate-900" : "text-slate-500"}`}>
                              {notif.title}
                            </span>
                            <p className="text-[11px] text-slate-500 font-medium leading-normal mt-0.5">
                              {notif.message}
                            </p>
                            <span className="text-[9px] text-slate-400 font-bold block mt-1.5">
                              {new Date(notif.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} • {new Date(notif.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        {isUnread && (
                          <span className="h-1.5 w-1.5 bg-slate-900 rounded-full flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
