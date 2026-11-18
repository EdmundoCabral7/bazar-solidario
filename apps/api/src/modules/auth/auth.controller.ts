import type { Request, Response } from 'express';
import { authService } from './auth.service';

export const authController = {
  async login(req: Request, res: Response) {
    res.json(await authService.login(req.body));
  },
  async me(req: Request, res: Response) {
    res.json(await authService.me(req.user!.id));
  },
};
