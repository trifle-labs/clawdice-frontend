"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { X, Check, AlertCircle, Loader2 } from "lucide-react";
import clsx from "clsx";

type NotificationType = "success" | "error" | "info" | "pending";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  txHash?: string;
  duration?: number;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, "id">) => string;
  removeNotification: (id: string) => void;
  updateNotification: (id: string, updates: Partial<Notification>) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, "id">) => {
    const id = Math.random().toString(36).slice(2);
    const duration = notification.duration ?? (notification.type === "pending" ? 0 : 5000);
    
    setNotifications((prev) => [...prev, { ...notification, id }]);
    
    if (duration > 0) {
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, duration);
    }
    
    return id;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const updateNotification = useCallback((id: string, updates: Partial<Notification>) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...updates } : n))
    );
    
    // Auto-remove after update if it's a final state
    if (updates.type === "success" || updates.type === "error") {
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, 5000);
    }
  }, []);

  return (
    <NotificationContext.Provider
      value={{ notifications, addNotification, removeNotification, updateNotification }}
    >
      {children}
      <NotificationContainer notifications={notifications} onDismiss={removeNotification} />
    </NotificationContext.Provider>
  );
}

function NotificationContainer({
  notifications,
  onDismiss,
}: {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="fixed top-16 right-4 z-[200] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={() => onDismiss(notification.id)}
        />
      ))}
    </div>
  );
}

function NotificationToast({
  notification,
  onDismiss,
}: {
  notification: Notification;
  onDismiss: () => void;
}) {
  const { type, title, message, txHash } = notification;

  const icons = {
    success: <Check className="w-5 h-5 text-mint-dark" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    info: <AlertCircle className="w-5 h-5 text-primary" />,
    pending: <Loader2 className="w-5 h-5 text-primary animate-spin" />,
  };

  const bgColors = {
    success: "bg-mint/20 border-mint/30",
    error: "bg-red-50 border-red-200",
    info: "bg-primary/10 border-primary/20",
    pending: "bg-primary/10 border-primary/20",
  };

  return (
    <div
      className={clsx(
        "pointer-events-auto glass rounded-xl p-3 border shadow-lg animate-slide-in-right",
        bgColors[type]
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{icons[type]}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {message && (
            <p className="text-xs text-foreground/60 mt-0.5">{message}</p>
          )}
          {txHash && (
            <a
              href={`https://sepolia.basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline mt-1 block"
            >
              View transaction ↗
            </a>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 hover:bg-white/50 rounded transition-colors"
        >
          <X className="w-4 h-4 text-foreground/50" />
        </button>
      </div>
    </div>
  );
}
