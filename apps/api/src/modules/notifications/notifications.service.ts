import { Injectable } from "@nestjs/common";

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

@Injectable()
export class NotificationsService {
  private notifications: NotificationItem[] = [
    {
      id: "notif_1",
      userId: "usr_default_demo",
      title: "Order Fulfilled",
      message: "Order #ORD-98421 Instagram High-Retention has successfully completed.",
      isRead: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: "notif_2",
      userId: "usr_default_demo",
      title: "Deposit Confirmed",
      message: "Wallet deposit of INR 2,500.00 confirmed with +10% bonus credit.",
      isRead: true,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  findAll(userId?: string) {
    if (!userId) return this.notifications;
    return this.notifications.filter((n) => n.userId === userId);
  }

  markAsRead(id: string) {
    const notif = this.notifications.find((n) => n.id === id);
    if (notif) notif.isRead = true;
    return { success: true, notification: notif };
  }
}
