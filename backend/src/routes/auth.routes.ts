import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
} from '../controllers/auth.controller';
import {
  validateRegister,
  validateLogin,
} from '../middleware/validation.middleware';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);

export default router;
