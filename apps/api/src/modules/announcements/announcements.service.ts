import { Injectable, BadRequestException } from "@nestjs/common";

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  type: string;
  isActive: boolean;
  createdAt: string;
}

@Injectable()
export class AnnouncementsService {
  private announcements: AnnouncementItem[] = [
    {
      id: "ann_1",
      title: "Scheduled Gateway Maintenance",
      content: "Razorpay banking partner maintenance scheduled on Sunday 02:00-03:30 AM IST.",
      type: "WARNING",
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "ann_2",
      title: "New High-Retention YouTube Shards",
      content: "YouTube High Retention Views (Service #2015) throughput expanded to 500k/day.",
      type: "INFO",
      isActive: true,
      createdAt: new Date(Date.now() - 172800000).toISOString(),
    },
  ];

  findAll() {
    return this.announcements.filter((a) => a.isActive);
  }

  create(body: { title: string; content: string; type?: string }) {
    if (!body.title || !body.content) {
      throw new BadRequestException("Title and content are required.");
    }
    const ann: AnnouncementItem = {
      id: `ann_${Math.random().toString(36).substring(2, 7)}`,
      title: body.title,
      content: body.content,
      type: body.type || "INFO",
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    this.announcements.unshift(ann);
    return { success: true, announcement: ann };
  }
}
