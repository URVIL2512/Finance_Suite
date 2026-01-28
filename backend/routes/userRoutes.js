import express from 'express';
import { protect, requireAdmin } from '../middleware/auth.js';
import {
  createUser,
  listUsers,
  updateUser,
  updateStatus,
  resetPassword,
  deleteUser,
} from '../controllers/userController.js';

const router = express.Router();

router.use(protect, requireAdmin);

router.post('/create', createUser);
router.get('/list', listUsers);
router.put('/update/:id', updateUser);
router.put('/status/:id', updateStatus);
router.put('/reset-password/:id', resetPassword);
router.delete('/delete/:id', deleteUser);

export default router;
