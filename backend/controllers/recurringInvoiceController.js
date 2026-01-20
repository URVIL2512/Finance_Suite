import RecurringInvoice from '../models/RecurringInvoice.js';
import Invoice from '../models/Invoice.js';
import { generateInvoicePDF } from '../utils/pdfGenerator.js';
import { sendInvoiceEmail } from '../utils/emailService.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_REPEAT_EVERY = new Set(['Week', 'Month', 'Quarter', 'Half Yearly', 'Six Month', 'Year']);

const normalizeToStartOfDay = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addRecurringInterval = (baseDate, repeatEvery) => {
  const next = new Date(baseDate);
  switch (repeatEvery) {
    case 'Week':
      next.setDate(next.getDate() + 7);
      break;
    case 'Month':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'Quarter':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'Half Yearly':
    case 'Six Month':
      next.setMonth(next.getMonth() + 6);
      break;
    case 'Year':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      break;
  }
  next.setHours(0, 0, 0, 0);
  return next;
};

// @desc    Create recurring invoice
// @route   POST /api/recurring-invoices
// @access  Private
export const createRecurringInvoice = async (req, res) => {
  try {
    const { invoiceIds, repeatEvery, startOn, endsOn, neverExpires } = req.body;

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return res.status(400).json({ message: 'At least one invoice ID is required' });
    }

    if (!repeatEvery || !startOn) {
      return res.status(400).json({ message: 'Repeat Every and Start On are required' });
    }

    if (!ALLOWED_REPEAT_EVERY.has(repeatEvery)) {
      return res.status(400).json({ message: 'Invalid repeat frequency' });
    }

    if (!neverExpires && !endsOn) {
      return res.status(400).json({ message: 'Ends On is required when Never Expires is not checked' });
    }

    const startDate = new Date(startOn);
    const endDate = endsOn ? new Date(endsOn) : null;

    if (endDate && endDate <= startDate) {
      return res.status(400).json({ message: 'Ends On date must be after Start On date' });
    }

    // Base invoice already exists, so next send should be after one interval
    const nextSendDate = addRecurringInterval(normalizeToStartOfDay(startDate), repeatEvery);

    // Create recurring invoice entries for each selected invoice
    const recurringInvoices = [];
    const validInvoiceIds = [];
    for (const invoiceId of invoiceIds) {
      // Verify invoice exists and belongs to user
      const invoice = await Invoice.findOne({
        _id: invoiceId,
        user: req.user._id,
      });

      if (!invoice) {
        continue; // Skip if invoice not found
      }
      validInvoiceIds.push(invoice._id);

      const recurringInvoice = await RecurringInvoice.create({
        baseInvoice: invoiceId,
        repeatEvery,
        startOn: startDate,
        endsOn: endDate,
        neverExpires,
        nextSendDate,
        user: req.user._id,
      });

      recurringInvoices.push(recurringInvoice);
    }

    // Mark base invoices as having a recurring schedule so Invoice list shows "Recurring = Yes".
    // This does NOT change the invoice amounts; it only tags the record.
    try {
      if (validInvoiceIds.length > 0) {
        await Invoice.updateMany(
          { _id: { $in: validInvoiceIds }, user: req.user._id },
          { $set: { hasRecurringSchedule: true } }
        );
      }
    } catch (e) {
      console.warn('Failed to mark base invoices as having recurring schedule:', e?.message || e);
    }

    res.status(201).json({
      message: `Recurring invoice created for ${recurringInvoices.length} invoice(s)`,
      recurringInvoices,
    });
  } catch (error) {
    console.error('Error creating recurring invoice:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all recurring invoices
// @route   GET /api/recurring-invoices
// @access  Private
export const getRecurringInvoices = async (req, res) => {
  try {
    // Remove any legacy seconds-based schedules (not supported)
    await RecurringInvoice.deleteMany({ user: req.user._id, repeatEvery: '10 Seconds' });

    const recurringInvoices = await RecurringInvoice.find({ user: req.user._id })
      .populate('baseInvoice')
      .sort({ createdAt: -1 })
      .lean();

    // Filter out recurring invoices where base invoice is deleted
    const validRecurringInvoices = recurringInvoices.filter(rec => {
      // If baseInvoice is null, it means the invoice was deleted
      return rec.baseInvoice !== null && rec.baseInvoice !== undefined;
    });

    // Backfill: ensure all base invoices referenced by schedules are tagged.
    try {
      const baseIds = validRecurringInvoices
        .map((r) => r?.baseInvoice?._id)
        .filter(Boolean);
      if (baseIds.length > 0) {
        await Invoice.updateMany(
          { _id: { $in: baseIds }, user: req.user._id },
          { $set: { hasRecurringSchedule: true } }
        );
      }
    } catch (e) {
      console.warn('Failed to backfill base invoices recurring schedule flag:', e?.message || e);
    }

    res.json(validRecurringInvoices);
  } catch (error) {
    console.error('Error fetching recurring invoices:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single recurring invoice
// @route   GET /api/recurring-invoices/:id
// @access  Private
export const getRecurringInvoice = async (req, res) => {
  try {
    const recurringInvoice = await RecurringInvoice.findOne({
      _id: req.params.id,
      user: req.user._id,
    })
      .populate('baseInvoice')
      .lean();

    if (!recurringInvoice) {
      return res.status(404).json({ message: 'Recurring invoice not found' });
    }

    if (recurringInvoice.repeatEvery === '10 Seconds') {
      await RecurringInvoice.deleteOne({ _id: req.params.id, user: req.user._id });
      return res.status(404).json({ message: 'Recurring invoice not found' });
    }

    // Check if base invoice is deleted
    if (!recurringInvoice.baseInvoice) {
      return res.status(404).json({ message: 'Base invoice for this recurring invoice has been deleted' });
    }

    res.json(recurringInvoice);
  } catch (error) {
    console.error('Error fetching recurring invoice:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update recurring invoice
// @route   PUT /api/recurring-invoices/:id
// @access  Private
export const updateRecurringInvoice = async (req, res) => {
  try {
    const { repeatEvery, startOn, endsOn, neverExpires, isActive } = req.body;

    const recurringInvoice = await RecurringInvoice.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!recurringInvoice) {
      return res.status(404).json({ message: 'Recurring invoice not found' });
    }

    // If a legacy seconds-based schedule exists, remove it (seconds frequency is not supported)
    if (recurringInvoice.repeatEvery === '10 Seconds') {
      await RecurringInvoice.deleteOne({ _id: recurringInvoice._id, user: req.user._id });
      return res.status(404).json({ message: 'Recurring invoice not found' });
    }

    if (repeatEvery) {
      if (!ALLOWED_REPEAT_EVERY.has(repeatEvery)) {
        return res.status(400).json({ message: 'Invalid repeat frequency' });
      }
      recurringInvoice.repeatEvery = repeatEvery;
    }
    if (startOn) {
      recurringInvoice.startOn = new Date(startOn);
    }
    if (endsOn !== undefined) recurringInvoice.endsOn = endsOn ? new Date(endsOn) : null;
    if (neverExpires !== undefined) recurringInvoice.neverExpires = neverExpires;
    if (isActive !== undefined) recurringInvoice.isActive = isActive;

    // Recompute nextSendDate so UI shows "next send" date (startOn/lastSent + interval)
    const baseForNext = recurringInvoice.lastSentDate || recurringInvoice.startOn;
    recurringInvoice.nextSendDate = addRecurringInterval(
      normalizeToStartOfDay(baseForNext),
      recurringInvoice.repeatEvery
    );

    await recurringInvoice.save();

    res.json(recurringInvoice);
  } catch (error) {
    console.error('Error updating recurring invoice:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete recurring invoice
// @route   DELETE /api/recurring-invoices/:id
// @access  Private
export const deleteRecurringInvoice = async (req, res) => {
  try {
    const recurringInvoice = await RecurringInvoice.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!recurringInvoice) {
      return res.status(404).json({ message: 'Recurring invoice not found' });
    }

    const baseInvoiceId = recurringInvoice.baseInvoice;

    await recurringInvoice.deleteOne();

    // Sync base invoice flag:
    // If this was the last recurring schedule for that base invoice, mark it as non-recurring (schedule).
    try {
      if (baseInvoiceId) {
        const anyRemaining = await RecurringInvoice.exists({
          user: req.user._id,
          baseInvoice: baseInvoiceId,
        });
        if (!anyRemaining) {
          await Invoice.updateOne(
            { _id: baseInvoiceId, user: req.user._id },
            { $set: { hasRecurringSchedule: false } }
          );
        }
      }
    } catch (e) {
      console.warn('Failed to sync base invoice recurring schedule flag on delete:', e?.message || e);
    }

    res.json({ message: 'Recurring invoice deleted successfully' });
  } catch (error) {
    console.error('Error deleting recurring invoice:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Process recurring invoices (to be called by cron job or directly)
// @route   POST /api/recurring-invoices/process
// @access  Private (should be called by cron job with special token)
export const processRecurringInvoices = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all active recurring invoices that need to be sent today
    const recurringInvoices = await RecurringInvoice.find({
      isActive: true,
      repeatEvery: { $ne: '10 Seconds' },
      nextSendDate: { $lte: today },
    }).populate('baseInvoice').populate('user');

    const results = [];

    for (const recurringInvoice of recurringInvoices) {
      try {
        // Check if we should still send (not expired)
        if (!recurringInvoice.neverExpires) {
          if (recurringInvoice.endsOn && new Date(recurringInvoice.endsOn) < today) {
            // Expired, deactivate
            recurringInvoice.isActive = false;
            await recurringInvoice.save();
            continue;
          }
        }

        const baseInvoice = recurringInvoice.baseInvoice;
        if (!baseInvoice) {
          console.error(`Base invoice not found for recurring invoice ${recurringInvoice._id}`);
          continue;
        }

        // Create a new invoice based on the base invoice with updated date
        const newInvoiceData = {
          ...baseInvoice.toObject(),
        };
        delete newInvoiceData._id;
        delete newInvoiceData.invoiceNumber;
        delete newInvoiceData.createdAt;
        delete newInvoiceData.updatedAt;
        delete newInvoiceData.emailSent;
        delete newInvoiceData.emailSentAt;

        // Use the scheduled send date (nextSendDate) for the generated invoice date
        const scheduledDate = normalizeToStartOfDay(recurringInvoice.nextSendDate);
        newInvoiceData.invoiceDate = scheduledDate;
        newInvoiceData.dueDate = new Date(scheduledDate);
        // Add payment terms days if exists
        if (baseInvoice.paymentTerms) {
          const days = baseInvoice.paymentTerms.match(/\d+/);
          if (days) {
            newInvoiceData.dueDate.setDate(newInvoiceData.dueDate.getDate() + parseInt(days[0]));
          }
        }

        // Generate new invoice number
        const year = scheduledDate.getFullYear();
        const lastInvoice = await Invoice.findOne({
          user: recurringInvoice.user._id,
          invoiceNumber: new RegExp(`^KVPL${year}`),
        }).sort({ invoiceNumber: -1 });

        let invoiceNumber;
        if (lastInvoice) {
          const lastNum = parseInt(lastInvoice.invoiceNumber.replace(`KVPL${year}`, ''));
          invoiceNumber = `KVPL${year}${String(lastNum + 1).padStart(3, '0')}`;
        } else {
          invoiceNumber = `KVPL${year}001`;
        }

        newInvoiceData.invoiceNumber = invoiceNumber;
        newInvoiceData.user = recurringInvoice.user._id;

        // Create new invoice
        const newInvoice = await Invoice.create(newInvoiceData);

        // Generate PDF
        const pdfPath = path.join(__dirname, '../temp', `invoice-${newInvoice._id}.pdf`);
        const tempDir = path.dirname(pdfPath);
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        await generateInvoicePDF(newInvoice, pdfPath, req.user._id);

        // Send email
        const clientEmail = newInvoice.clientEmail || baseInvoice.clientEmail;
        if (clientEmail && clientEmail.trim() !== '') {
          const currency = newInvoice.currencyDetails?.invoiceCurrency || newInvoice.currency || 'INR';
          const receivableAmount = newInvoice.amountDetails?.receivableAmount || newInvoice.grandTotal || 0;
          const serviceDescription = newInvoice.serviceDetails?.description || newInvoice.items[0]?.description || 'Service';

          const emailResult = await sendInvoiceEmail({
            to: clientEmail,
            clientName: newInvoice.clientDetails?.name || 'Client',
            invoiceNumber: newInvoice.invoiceNumber,
            receivableAmount: receivableAmount,
            dueDate: newInvoice.dueDate,
            service: serviceDescription,
            pdfPath: pdfPath,
            currency: currency,
          });

          if (emailResult && emailResult.success) {
            newInvoice.emailSent = true;
            newInvoice.emailSentAt = new Date();
            await newInvoice.save();
          } else {
            console.error(`Failed to send recurring invoice email to ${clientEmail}:`, emailResult?.error || 'Unknown error');
          }
        }

        const nextSendDate = addRecurringInterval(scheduledDate, recurringInvoice.repeatEvery);

        // Update recurring invoice
        recurringInvoice.lastSentDate = scheduledDate;
        recurringInvoice.nextSendDate = nextSendDate;

        // Check if expired
        if (!recurringInvoice.neverExpires && recurringInvoice.endsOn) {
          if (nextSendDate > new Date(recurringInvoice.endsOn)) {
            recurringInvoice.isActive = false;
          }
        }

        await recurringInvoice.save();

        results.push({
          recurringInvoiceId: recurringInvoice._id,
          newInvoiceId: newInvoice._id,
          invoiceNumber: newInvoice.invoiceNumber,
          success: true,
        });
      } catch (error) {
        console.error(`Error processing recurring invoice ${recurringInvoice._id}:`, error);
        results.push({
          recurringInvoiceId: recurringInvoice._id,
          success: false,
          error: error.message,
        });
      }
    }

    const response = {
      message: `Processed ${recurringInvoices.length} recurring invoice(s)`,
      results,
    };

    // If called from API, send response
    if (res) {
      res.json(response);
    }

    return response;
  } catch (error) {
    console.error('Error processing recurring invoices:', error);
    if (res) {
      res.status(500).json({ message: error.message });
    }
    throw error;
  }
};

// @desc    Process recurring invoices directly (for cron job)
// This function can be called directly without HTTP request/response
export const processRecurringInvoicesDirect = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all active recurring invoices that need to be sent today
    const recurringInvoices = await RecurringInvoice.find({
      isActive: true,
      repeatEvery: { $ne: '10 Seconds' },
      nextSendDate: { $lte: today },
    }).populate('baseInvoice').populate('user');

    const results = [];

    for (const recurringInvoice of recurringInvoices) {
      try {
        // Check if we should still send (not expired)
        if (!recurringInvoice.neverExpires) {
          if (recurringInvoice.endsOn && new Date(recurringInvoice.endsOn) < today) {
            // Expired, deactivate
            recurringInvoice.isActive = false;
            await recurringInvoice.save();
            continue;
          }
        }

        const baseInvoice = recurringInvoice.baseInvoice;
        if (!baseInvoice) {
          console.error(`Base invoice not found for recurring invoice ${recurringInvoice._id}`);
          continue;
        }

        // Create a new invoice based on the base invoice with updated date
        const newInvoiceData = {
          ...baseInvoice.toObject(),
        };
        delete newInvoiceData._id;
        delete newInvoiceData.invoiceNumber;
        delete newInvoiceData.createdAt;
        delete newInvoiceData.updatedAt;
        delete newInvoiceData.emailSent;
        delete newInvoiceData.emailSentAt;

        // Use the scheduled send date (nextSendDate) for the generated invoice date
        const scheduledDate = normalizeToStartOfDay(recurringInvoice.nextSendDate);
        newInvoiceData.invoiceDate = scheduledDate;
        newInvoiceData.dueDate = new Date(scheduledDate);
        // Add payment terms days if exists
        if (baseInvoice.paymentTerms) {
          const days = baseInvoice.paymentTerms.match(/\d+/);
          if (days) {
            newInvoiceData.dueDate.setDate(newInvoiceData.dueDate.getDate() + parseInt(days[0]));
          }
        }

        // Generate new invoice number
        const year = scheduledDate.getFullYear();
        const lastInvoice = await Invoice.findOne({
          user: recurringInvoice.user._id,
          invoiceNumber: new RegExp(`^KVPL${year}`),
        }).sort({ invoiceNumber: -1 });

        let invoiceNumber;
        if (lastInvoice) {
          const lastNum = parseInt(lastInvoice.invoiceNumber.replace(`KVPL${year}`, ''));
          invoiceNumber = `KVPL${year}${String(lastNum + 1).padStart(3, '0')}`;
        } else {
          invoiceNumber = `KVPL${year}001`;
        }

        newInvoiceData.invoiceNumber = invoiceNumber;
        newInvoiceData.user = recurringInvoice.user._id;

        // Create new invoice
        const newInvoice = await Invoice.create(newInvoiceData);

        // Generate PDF
        const pdfPath = path.join(__dirname, '../temp', `invoice-${newInvoice._id}.pdf`);
        const tempDir = path.dirname(pdfPath);
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        await generateInvoicePDF(newInvoice, pdfPath, req.user._id);

        // Send email
        const clientEmail = newInvoice.clientEmail || baseInvoice.clientEmail;
        if (clientEmail && clientEmail.trim() !== '') {
          const currency = newInvoice.currencyDetails?.invoiceCurrency || newInvoice.currency || 'INR';
          const receivableAmount = newInvoice.amountDetails?.receivableAmount || newInvoice.grandTotal || 0;
          const serviceDescription = newInvoice.serviceDetails?.description || newInvoice.items[0]?.description || 'Service';

          const emailResult = await sendInvoiceEmail({
            to: clientEmail,
            clientName: newInvoice.clientDetails?.name || 'Client',
            invoiceNumber: newInvoice.invoiceNumber,
            receivableAmount: receivableAmount,
            dueDate: newInvoice.dueDate,
            service: serviceDescription,
            pdfPath: pdfPath,
            currency: currency,
          });

          if (emailResult && emailResult.success) {
            newInvoice.emailSent = true;
            newInvoice.emailSentAt = new Date();
            await newInvoice.save();
          } else {
            console.error(`Failed to send recurring invoice email to ${clientEmail}:`, emailResult?.error || 'Unknown error');
          }
        }

        const nextSendDate = addRecurringInterval(scheduledDate, recurringInvoice.repeatEvery);

        // Update recurring invoice
        recurringInvoice.lastSentDate = scheduledDate;
        recurringInvoice.nextSendDate = nextSendDate;

        // Check if expired
        if (!recurringInvoice.neverExpires && recurringInvoice.endsOn) {
          if (nextSendDate > new Date(recurringInvoice.endsOn)) {
            recurringInvoice.isActive = false;
          }
        }

        await recurringInvoice.save();

        results.push({
          recurringInvoiceId: recurringInvoice._id,
          newInvoiceId: newInvoice._id,
          invoiceNumber: newInvoice.invoiceNumber,
          success: true,
        });
      } catch (error) {
        console.error(`Error processing recurring invoice ${recurringInvoice._id}:`, error);
        results.push({
          recurringInvoiceId: recurringInvoice._id,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      message: `Processed ${recurringInvoices.length} recurring invoice(s)`,
      results,
    };
  } catch (error) {
    console.error('Error processing recurring invoices:', error);
    throw error;
  }
};
