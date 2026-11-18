import bcrypt from 'bcryptjs';
import type { LoginInput } from '@bazar/shared';
import { AppError } from '../../lib/errors';
import { signToken } from '../../middlewares/auth';
import { authRepository } from './auth.repository';

export const authService = {
  async login({ email, password }: LoginInput) {
    const user = await authRepository.findByEmail(email.toLowerCase());
    const valid = user && user.active && (await bcrypt.compare(password, user.passwordHash));
    if (!user || !valid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos');
    }
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    return {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  },

  async me(userId: string) {
    const user = await authRepository.findById(userId);
    if (!user || !user.active) throw AppError.unauthorized('Usuário inativo ou inexistente');
    return user;
  },
};
