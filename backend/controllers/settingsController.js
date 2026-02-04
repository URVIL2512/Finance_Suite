import Settings from '../models/Settings.js';

// @desc    Get user settings
// @route   GET /api/settings
// @access  Private
export const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne({ user: req.user._id });

    // If settings don't exist, create default settings
    if (!settings) {
      settings = await Settings.create({
        user: req.user._id,
        termsAndConditions: [
          'Raise disputes within 7 days of the invoice date. Late disputes will not be considered.',
          'Payments are non-refundable unless stated in the agreement.',
          'Invoice covers agreed services only. Additional services will be invoiced separately.',
          'This invoice is governed by the laws of Ahmedabad juridistrict.',
          'For queries, contact mihir@kology.in'
        ],
        bankDetails: {
          companyName: 'Kology Ventures Private Limited',
          bankName: 'ICICI Bank Ltd.',
          accountNumber: '471405500040',
          ifscCode: 'ICIC0004714',
          swiftCode: 'ICICNBBCTS',
          branch: 'AEC Cross Road',
        },
      });
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user settings
// @route   PUT /api/settings
// @access  Private
export const updateSettings = async (req, res) => {
  try {
    const { declaration, termsAndConditions, bankDetails, gstRates, tdsRates, tcsRates } = req.body;

    let settings = await Settings.findOne({ user: req.user._id });

    if (!settings) {
      // Create new settings if they don't exist
      settings = await Settings.create({
        user: req.user._id,
        declaration: declaration || '',
        termsAndConditions: termsAndConditions || [],
        bankDetails: bankDetails || {},
        gstRates: gstRates || [],
        tdsRates: tdsRates || [],
        tcsRates: tcsRates || [],
      });
    } else {
      // Update existing settings
      if (declaration !== undefined) {
        settings.declaration = typeof declaration === 'string' ? declaration : '';
      }
      if (termsAndConditions !== undefined) {
        settings.termsAndConditions = Array.isArray(termsAndConditions) 
          ? termsAndConditions 
          : [];
      }
      if (bankDetails !== undefined) {
        settings.bankDetails = {
          ...settings.bankDetails,
          ...bankDetails,
        };
      }
      if (gstRates !== undefined) {
        settings.gstRates = Array.isArray(gstRates) ? gstRates : [];
      }
      if (tdsRates !== undefined) {
        settings.tdsRates = Array.isArray(tdsRates) ? tdsRates : [];
      }
      if (tcsRates !== undefined) {
        settings.tcsRates = Array.isArray(tcsRates) ? tcsRates : [];
      }
      await settings.save();
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
