import { request } from './client';
import type { NotificationItem } from '../types';

export interface NotificationsResponse {
  notifications: NotificationItem[];
}

export interface UnreadCountResponse {
  count: number;
}

export interface MarkReadResponse {
  notification: {
    id: string;
    read: boolean;
  };
}

/**
 * Generate warranty expiry and expired notifications for caller's accessible products.
 * Idempotent: duplicates are prevented on the backend.
 */
export async function generateNotifications(): Promise<NotificationItem[]> {
  const data = await request<NotificationsResponse>('/api/notifications/generate', {
    method: 'POST',
  });
  return data.notifications;
}

/**
 * Get all notifications for the authenticated user, sorted newest first.
 */
export async function getNotifications(): Promise<NotificationItem[]> {
  const data = await request<NotificationsResponse>('/api/notifications');
  return data.notifications;
}

/**
 * Get count of unread notifications for the authenticated user.
 */
export async function getUnreadCount(): Promise<number> {
  const data = await request<UnreadCountResponse>('/api/notifications/unread-count');
  return data.count;
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationAsRead(id: string): Promise<{ id: string; read: boolean }> {
  const data = await request<MarkReadResponse>(`/api/notifications/${id}/read`, {
    method: 'PATCH',
  });
  return data.notification;
}
