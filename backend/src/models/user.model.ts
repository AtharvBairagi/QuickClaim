import { Schema, model, Document } from 'mongoose';

export interface IUser {
  _id?: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserDocument extends Omit<IUser, '_id'>, Document {
  toUserResponse(): { id: string; name: string; email: string };
}

const userSchema = new Schema<IUserDocument>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name must be at most 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        return {
          id: ret._id ? String(ret._id) : '',
          name: ret.name,
          email: ret.email,
        };
      },
    },
    toObject: {
      transform: (_doc, ret: Record<string, unknown>) => {
        return {
          id: ret._id ? String(ret._id) : '',
          name: ret.name,
          email: ret.email,
        };
      },
    },
  }
);

userSchema.methods.toUserResponse = function (): { id: string; name: string; email: string } {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
  };
};

export const User = model<IUserDocument>('User', userSchema);
