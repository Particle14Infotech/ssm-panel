import { Injectable, NotFoundException } from "@nestjs/common";

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
  private notifications: NotificationItem[] = [];

  findAll(userId: string) {
    if (!userId) return [];
    return this.notifications.filter((n) => n.userId === userId);
  }

  markAsRead(id: string, userId: string) {
    const notif = this.notifications.find((n) => n.id === id && n.userId === userId);
    if (!notif) {
      throw new NotFoundException(`Notification #${id} not found.`);
    }
    notif.isRead = true;
    return { success: true, notification: notif };
  }

  addNotification(userId: string, title: string, message: string) {
    const item: NotificationItem = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      title,
      message,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    this.notifications.unshift(item);
    return item;
  }
}

