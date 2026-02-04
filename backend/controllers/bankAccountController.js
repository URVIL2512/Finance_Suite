import BankAccount from '../models/BankAccount.js';

// @desc    Get all bank accounts
// @route   GET /api/bank-accounts
// @access  Private
export const getBankAccounts = async (req, res) => {
  try {
    const { search, isActive } = req.query;
    const filter = { user: req.user._id };
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    } else {
      filter.isActive = true;
    }
    
    if (search) {
      filter.$or = [
        { accountName: { $regex: search, $options: 'i' } },
        { bankName: { $regex: search, $options: 'i' } },
        { accountNumber: { $regex: search, $options: 'i' } },
        { ifsc: { $regex: search, $options: 'i' } }
      ];
    }

    const bankAccounts = await BankAccount.find(filter)
      .select('-__v')
      .sort({ accountName: 1, createdAt: -1 })
      .lean();

    res.json(bankAccounts);
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch bank accounts',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get single bank account
// @route   GET /api/bank-accounts/:id
// @access  Private
export const getBankAccount = async (req, res) => {
  try {
    const bankAccount = await BankAccount.findOne({
      _id: req.params.id,
      user: req.user._id,
    })
      .select('-__v')
      .lean();

    if (!bankAccount) {
      return res.status(404).json({ message: 'Bank account not found' });
    }

    res.json(bankAccount);
  } catch (error) {
    console.error('Error fetching bank account:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch bank account',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Create bank account
// @route   POST /api/bank-accounts
// @access  Private
export const createBankAccount = async (req, res) => {
  try {
    const { accountName, bankName, ifsc, accountNumber, isActive } = req.body;

    if (!accountName || !accountName.trim()) {
      return res.status(400).json({ message: 'Account name is required' });
    }

    if (!bankName || !bankName.trim()) {
      return res.status(400).json({ message: 'Bank name is required' });
    }

    // Check if bank account with same name already exists for this user
    const existingBankAccount = await BankAccount.findOne({
      accountName: accountName.trim(),
      user: req.user._id,
    });

    if (existingBankAccount) {
      return res.status(400).json({ message: 'Bank account with this name already exists' });
    }

    const bankAccount = await BankAccount.create({
      accountName: accountName.trim(),
      bankName: bankName.trim(),
      ifsc: ifsc ? ifsc.trim().toUpperCase() : '',
      accountNumber: accountNumber ? accountNumber.trim() : '',
      isActive: isActive !== undefined ? isActive : true,
      user: req.user._id,
    });

    res.status(201).json(bankAccount);
  } catch (error) {
    console.error('Error creating bank account:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Bank account with this name already exists' });
    }
    
    res.status(500).json({ 
      message: error.message || 'Failed to create bank account',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Update bank account
// @route   PUT /api/bank-accounts/:id
// @access  Private
export const updateBankAccount = async (req, res) => {
  try {
    const { accountName, bankName, ifsc, accountNumber, isActive } = req.body;

    const bankAccount = await BankAccount.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!bankAccount) {
      return res.status(404).json({ message: 'Bank account not found' });
    }

    // If accountName is being updated, check for duplicates
    if (accountName && accountName.trim() !== bankAccount.accountName) {
      const existingBankAccount = await BankAccount.findOne({
        accountName: accountName.trim(),
        user: req.user._id,
        _id: { $ne: req.params.id },
      });

      if (existingBankAccount) {
        return res.status(400).json({ message: 'Bank account with this name already exists' });
      }
      bankAccount.accountName = accountName.trim();
    }

    if (bankName !== undefined) {
      bankAccount.bankName = bankName ? bankName.trim() : '';
    }
    if (ifsc !== undefined) {
      bankAccount.ifsc = ifsc ? ifsc.trim().toUpperCase() : '';
    }
    if (accountNumber !== undefined) {
      bankAccount.accountNumber = accountNumber ? accountNumber.trim() : '';
    }
    if (isActive !== undefined) {
      bankAccount.isActive = isActive;
    }

    await bankAccount.save();

    res.json(bankAccount);
  } catch (error) {
    console.error('Error updating bank account:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Bank account with this name already exists' });
    }
    
    res.status(500).json({ 
      message: error.message || 'Failed to update bank account',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Delete bank account
// @route   DELETE /api/bank-accounts/:id
// @access  Private
export const deleteBankAccount = async (req, res) => {
  try {
    const bankAccount = await BankAccount.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!bankAccount) {
      return res.status(404).json({ message: 'Bank account not found' });
    }

    await bankAccount.deleteOne();

    res.json({ message: 'Bank account deleted successfully' });
  } catch (error) {
    console.error('Error deleting bank account:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to delete bank account',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
