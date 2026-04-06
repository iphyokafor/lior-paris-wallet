import { z } from 'zod';
import { UserRole } from '../constants';

export const loginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(5).max(15),
  })
  .strict();

export type Login = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z.string(),
    email: z.string().email(),
    password: z.string().min(5).max(15),
  })
  .strict();

export type Register = z.infer<typeof registerSchema>;

export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(5).max(15),
    newPassword: z.string().min(5).max(15),
  })
  .strict();

export type ChangePassword = z.infer<typeof changePasswordSchema>;

export const updateUserSchema = z
  .object({
    name: z.string(),
    role: z.nativeEnum(UserRole),
  })
  .partial();

export type UpdateUserDto = z.infer<typeof updateUserSchema>;

export const userIdSchema = z.string();
