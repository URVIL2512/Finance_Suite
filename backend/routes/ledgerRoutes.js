import express from 'express';
import { getClientLedger, getLedgerCustomers } from '../controllers/ledgerController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/customers', getLedgerCustomers);
router.get('/', getClientLedger);

export default router;
