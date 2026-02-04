import express from 'express';
import { protect, requireAdmin } from '../middleware/auth.js';
import { changeOwnAdminPassword, createUserAsAdmin } from '../controllers/adminController.js';

const router = express.Router();

router.use(protect, requireAdmin);

router.post('/create-user', createUserAsAdmin);
router.put('/change-password', changeOwnAdminPassword);

export default router;

