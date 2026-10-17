import { Schema, model, Model, HydratedDocument, Types } from 'mongoose';

export type NotificationType = 'warranty_expiring' | 'warranty_expired';

export interface INotification {
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface NotificationResponse {
  id: string;
  productId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface INotificationMethods {
  toNotificationResponse(): NotificationResponse;
}

export type NotificationDocument = HydratedDocument<INotification, INotificationMethods>;
export type NotificationModel = Model<INotification, {}, INotificationMethods>;

const notificationSchema = new Schema<INotification, NotificationModel, INotificationMethods>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
    },
    type: {
      type: String,
      enum: ['warranty_expiring', 'warranty_expired'],
      required: [true, 'Notification type is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
// Prevent duplicate notifications for the same user + product + notification type
notificationSchema.index({ userId: 1, productId: 1, type: 1 }, { unique: true });

// Query notifications newest first
notificationSchema.index({ userId: 1, createdAt: -1 });

// Query unread notifications count
notificationSchema.index({ userId: 1, read: 1 });

// Query by product
notificationSchema.index({ productId: 1 });

notificationSchema.methods.toNotificationResponse = function (): NotificationResponse {
  return {
    id: this._id.toString(),
    productId: this.productId ? (this.productId._id ? this.productId._id.toString() : this.productId.toString()) : '',
    type: this.type,
    title: this.title,
    message: this.message,
    read: this.read,
    createdAt: this.createdAt ? this.createdAt.toISOString() : new Date().toISOString(),
  };
};

export const Notification = model<INotification, NotificationModel>('Notification', notificationSchema);
