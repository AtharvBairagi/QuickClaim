import { Schema, model, Model, HydratedDocument, Types } from 'mongoose';
import { calculateWarrantyStatus, WarrantyStatus } from '../utilities/warrantyStatus.util';

export interface IProduct {
  userId: Types.ObjectId;
  name: string;
  category?: string;
  brand?: string;
  model?: string;
  purchaseDate: Date;
  warrantyStartDate?: Date;
  warrantyExpiry: Date;
  retailer?: string;
  price?: number;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProductResponse {
  id: string;
  name: string;
  category?: string;
  brand?: string;
  model?: string;
  purchaseDate: string;
  warrantyStartDate?: string;
  warrantyExpiry: string;
  retailer?: string;
  price?: number;
  notes?: string;
  status: WarrantyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface IProductMethods {
  toProductResponse(): ProductResponse;
}

export type ProductDocument = HydratedDocument<IProduct, IProductMethods>;

export type ProductModel = Model<IProduct, {}, IProductMethods>;

const productSchema = new Schema<IProduct, ProductModel, IProductMethods>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [200, 'Product name cannot exceed 200 characters'],
    },
    category: {
      type: String,
      trim: true,
      maxlength: [100, 'Category cannot exceed 100 characters'],
    },
    brand: {
      type: String,
      trim: true,
      maxlength: [100, 'Brand cannot exceed 100 characters'],
    },
    model: {
      type: String,
      trim: true,
      maxlength: [100, 'Model cannot exceed 100 characters'],
    },
    purchaseDate: {
      type: Date,
      required: [true, 'Purchase date is required'],
    },
    warrantyStartDate: {
      type: Date,
    },
    warrantyExpiry: {
      type: Date,
      required: [true, 'Warranty expiry date is required'],
    },
    retailer: {
      type: String,
      trim: true,
      maxlength: [150, 'Retailer cannot exceed 150 characters'],
    },
    price: {
      type: Number,
      min: [0, 'Price must be a non-negative number'],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Notes cannot exceed 2000 characters'],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for optimized querying of user's products sorted by date
productSchema.index({ userId: 1, createdAt: -1 });

productSchema.methods.toProductResponse = function (): ProductResponse {
  const status = calculateWarrantyStatus(this.warrantyExpiry);

  const response: ProductResponse = {
    id: this._id.toString(),
    name: this.name,
    purchaseDate: this.purchaseDate ? this.purchaseDate.toISOString().split('T')[0] : '',
    warrantyExpiry: this.warrantyExpiry ? this.warrantyExpiry.toISOString().split('T')[0] : '',
    status,
    createdAt: this.createdAt ? this.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: this.updatedAt ? this.updatedAt.toISOString() : new Date().toISOString(),
  };

  if (this.category !== undefined && this.category !== null) response.category = this.category;
  if (this.brand !== undefined && this.brand !== null) response.brand = this.brand;
  if (this.get('model') !== undefined && this.get('model') !== null) response.model = this.get('model');
  if (this.warrantyStartDate) {
    response.warrantyStartDate = this.warrantyStartDate.toISOString().split('T')[0];
  }
  if (this.retailer !== undefined && this.retailer !== null) response.retailer = this.retailer;
  if (this.price !== undefined && this.price !== null) response.price = this.price;
  if (this.notes !== undefined && this.notes !== null) response.notes = this.notes;

  return response;
};

export const Product = model<IProduct, ProductModel>('Product', productSchema);
