import { request } from './client';
import type { User } from '../types';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
}

export interface LogoutResponse {
  message: string;
}

export async function login(credentials: LoginInput): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

export async function register(data: RegisterInput): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function logout(): Promise<LogoutResponse> {
  return request<LogoutResponse>('/auth/logout', {
    method: 'POST',
  });
}

export async function getMe(): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/me', {
    method: 'GET',
  });
}
