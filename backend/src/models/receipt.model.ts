import { Schema, model, Model, HydratedDocument, Types } from 'mongoose';

export interface IReceipt {
  productId: Types.ObjectId;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  uploadedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ReceiptResponse {
  id: string;
  productId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface IReceiptMethods {
  toReceiptResponse(): ReceiptResponse;
}

export type ReceiptDocument = HydratedDocument<IReceipt, IReceiptMethods>;

export type ReceiptModel = Model<IReceipt, {}, IReceiptMethods>;

const receiptSchema = new Schema<IReceipt, ReceiptModel, IReceiptMethods>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true,
    },
    fileName: {
      type: String,
      required: [true, 'Generated filename is required'],
    },
    originalName: {
      type: String,
      required: [true, 'Original filename is required'],
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required'],
    },
    fileSize: {
      type: Number,
      required: [true, 'File size is required'],
      min: [0, 'File size must be positive'],
    },
    storagePath: {
      type: String,
      required: [true, 'Storage path is required'],
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

receiptSchema.methods.toReceiptResponse = function (): ReceiptResponse {
  return {
    id: this._id.toString(),
    productId: this.productId.toString(),
    fileName: this.fileName,
    originalName: this.originalName,
    mimeType: this.mimeType,
    fileSize: this.fileSize,
    uploadedAt: this.uploadedAt.toISOString(),
    createdAt: this.createdAt ? this.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: this.updatedAt ? this.updatedAt.toISOString() : new Date().toISOString(),
  };
};

export const Receipt = model<IReceipt, ReceiptModel>('Receipt', receiptSchema);
