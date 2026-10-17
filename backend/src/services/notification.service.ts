import mongoose from 'mongoose';
import { Notification, NotificationResponse, NotificationType } from '../models/notification.model';
import { Product } from '../models/product.model';
import { Ownership } from '../models/ownership.model';
import { calculateWarrantyStatus } from '../utilities/warrantyStatus.util';
import { AppError } from '../middleware/errorHandler';

export const generateNotificationsForUser = async (
  userId: string
): Promise<NotificationResponse[]> => {
  const userObjId = new mongoose.Types.ObjectId(userId);

  // 1. Gather all products relevant to this user (owned or shared)
  const ownedProducts = await Product.find({ userId: userObjId });
  const sharedOwnerships = await Ownership.find({ sharedWithId: userObjId });
  const sharedProductIds = sharedOwnerships.map((o) => o.productId);
  const sharedProducts = await Product.find({ _id: { $in: sharedProductIds } });

  const productMap = new Map<string, any>();
  for (const p of ownedProducts) productMap.set(p._id.toString(), p);
  for (const p of sharedProducts) productMap.set(p._id.toString(), p);
  const products = Array.from(productMap.values());

  const generatedForCaller: NotificationResponse[] = [];

  // 2. Evaluate warranty status and generate missing notifications
  for (const product of products) {
    const status = calculateWarrantyStatus(product.warrantyExpiry);
    if (status === 'active') {
      continue;
    }

    const type: NotificationType =
      status === 'expiring' ? 'warranty_expiring' : 'warranty_expired';
    const formattedDate = product.warrantyExpiry
      ? product.warrantyExpiry.toISOString().split('T')[0]
      : '';
    const title =
      status === 'expiring' ? 'Warranty expiring soon' : 'Warranty expired';
    const message =
      status === 'expiring'
        ? `Your ${product.name} warranty expires on ${formattedDate}`
        : `Your ${product.name} warranty expired on ${formattedDate}`;

    // 3. Collect all relevant recipients for this product (primary owner + currently shared users)
    const recipientSet = new Set<string>();
    recipientSet.add(product.userId.toString());

    const activeShares = await Ownership.find({ productId: product._id });
    for (const share of activeShares) {
      recipientSet.add(share.sharedWithId.toString());
    }

    // 4. Create missing notifications per user, preventing duplicates
    for (const recipientId of recipientSet) {
      const existing = await Notification.findOne({
        userId: new mongoose.Types.ObjectId(recipientId),
        productId: product._id,
        type,
      });

      if (!existing) {
        try {
          const created = await Notification.create({
            userId: new mongoose.Types.ObjectId(recipientId),
            productId: product._id,
            type,
            title,
            message,
            read: false,
          });

          if (recipientId === userId) {
            generatedForCaller.push(created.toNotificationResponse());
          }
        } catch (err: any) {
          if (err.code !== 11000) {
            throw err;
          }
        }
      }
    }
  }

  return generatedForCaller;
};

export const getNotifications = async (
  userId: string
): Promise<NotificationResponse[]> => {
  const notifications = await Notification.find({
    userId: new mongoose.Types.ObjectId(userId),
  }).sort({ createdAt: -1 });

  return notifications.map((n) => n.toNotificationResponse());
};

export const getUnreadCount = async (userId: string): Promise<number> => {
  return await Notification.countDocuments({
    userId: new mongoose.Types.ObjectId(userId),
    read: false,
  });
};

export const markNotificationAsRead = async (
  userId: string,
  notificationId: string
): Promise<{ id: string; read: boolean }> => {
  if (!mongoose.Types.ObjectId.isValid(notificationId)) {
    throw new AppError(400, 'Invalid notification ID format');
  }

  const notification = await Notification.findById(notificationId);
  if (!notification) {
    throw new AppError(404, 'Notification not found');
  }

  // Prevent accessing or marking another user's notification
  if (notification.userId.toString() !== userId.toString()) {
    throw new AppError(404, 'Notification not found');
  }

  notification.read = true;
  await notification.save();

  return {
    id: notification._id.toString(),
    read: notification.read,
  };
};
