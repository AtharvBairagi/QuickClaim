import { Schema, model, Model, HydratedDocument, Types } from 'mongoose';

export interface IOwnership {
  productId: Types.ObjectId;
  ownerId: Types.ObjectId;
  sharedWithId: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OwnershipResponse {
  id: string;
  productId: string;
  sharedWith: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
}

export interface IOwnershipMethods {
  toOwnershipResponse(): OwnershipResponse;
}

export type OwnershipDocument = HydratedDocument<IOwnership, IOwnershipMethods>;

export type OwnershipModel = Model<IOwnership, {}, IOwnershipMethods>;

const ownershipSchema = new Schema<IOwnership, OwnershipModel, IOwnershipMethods>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner ID is required'],
      index: true,
    },
    sharedWithId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Shared with User ID is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index to prevent duplicate sharing of the same product with the same user
ownershipSchema.index({ productId: 1, sharedWithId: 1 }, { unique: true });

// Index supporting queries for products shared with a specific user
ownershipSchema.index({ sharedWithId: 1 });

ownershipSchema.methods.toOwnershipResponse = function (): OwnershipResponse {
  const sharedWithDoc = this.sharedWithId as any;
  const prodDoc = this.productId as any;

  return {
    id: this._id.toString(),
    productId: prodDoc?._id ? prodDoc._id.toString() : prodDoc?.toString() || '',
    sharedWith: {
      id: sharedWithDoc?._id ? sharedWithDoc._id.toString() : sharedWithDoc?.toString() || '',
      name: sharedWithDoc?.name || '',
      email: sharedWithDoc?.email || '',
    },
    createdAt: this.createdAt ? this.createdAt.toISOString() : new Date().toISOString(),
  };
};

export const Ownership = model<IOwnership, OwnershipModel>('Ownership', ownershipSchema);
