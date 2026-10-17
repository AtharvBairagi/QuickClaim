import { User, IUser } from '../models/user.model';
import { hashPassword, comparePassword } from '../utilities/password.util';
import { generateToken } from '../utilities/token.util';
import { AppError } from '../middleware/errorHandler';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
}

export interface LoginResult {
  user: UserResponse;
  token: string;
}

export const registerUser = async (data: RegisterInput): Promise<UserResponse> => {
  const normalizedEmail = data.email.trim().toLowerCase();
  const trimmedName = data.name.trim();

  // Check if user already exists
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new AppError(409, 'Email is already registered');
  }

  // Hash password
  const passwordHash = await hashPassword(data.password);

  // Create user
  const user = await User.create({
    name: trimmedName,
    email: normalizedEmail,
    passwordHash,
  });

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
  };
};

export const loginUser = async (data: LoginInput): Promise<LoginResult> => {
  const normalizedEmail = data.email.trim().toLowerCase();

  // Find user by normalized email
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    // Generic message to avoid email enumeration
    throw new AppError(401, 'Invalid email or password');
  }

  // Verify password
  const isMatch = await comparePassword(data.password, user.passwordHash);
  if (!isMatch) {
    // Generic message to avoid password enumeration
    throw new AppError(401, 'Invalid email or password');
  }

  // Generate authentication token
  const token = generateToken({ userId: user._id.toString() });

  return {
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
    },
    token,
  };
};

export const getCurrentUser = async (userId: string): Promise<UserResponse> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(401, 'User not found');
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
  };
};
