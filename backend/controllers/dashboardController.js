import Expense from '../models/Expense.js';
import RecurringExpense from '../models/RecurringExpense.js';
import Revenue from '../models/Revenue.js';
import Invoice from '../models/Invoice.js';
import { syncInvoicesWithCollectionsWithoutRevenue } from '../utils/revenueSync.js';
import { generateExpenseAgingPDF } from '../utils/expenseAgingPdfGenerator.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CANCEL_STATUSES = ['Cancel', 'Cancelled', 'Canceled'];

// @desc    Get expense dashboard summary
// @route   GET /api/dashboard/expenses
// @access  Private
export const getExpenseDashboard = async (req, res) => {
  try {
    const { year, month } = req.query;
    const filter = { user: req.user._id };
    if (year) filter.year = parseInt(year);
    if (month) filter.month = month;
    // Exclude cancelled expenses from dashboard totals
    filter.status = { $nin: CANCEL_STATUSES };

    const expenses = await Expense.find(filter);

    // Get baseExpense IDs from recurring expenses (these should be excluded from dashboard calculations)
    const recurringExpenses = await RecurringExpense.find({ user: req.user._id })
      .select('baseExpense')
      .lean();
    
    const baseExpenseIds = new Set(
      recurringExpenses
        .map(re => re.baseExpense?.toString())
        .filter(id => id)
    );

    // Filter out expenses that are baseExpense for recurring expenses
    const nonRecurringExpenses = expenses
      .filter((expense) => !baseExpenseIds.has(expense._id.toString()))
      .filter((expense) => !CANCEL_STATUSES.includes(expense.status));

    // Total expenses for the year (excluding baseExpense expenses)
    const totalExpenses = nonRecurringExpenses.reduce((sum, exp) => sum + Math.max(0, exp.totalAmount || 0), 0);
    const totalGST = nonRecurringExpenses.reduce((sum, exp) => sum + (exp.gstAmount || 0), 0);
    const totalTDS = nonRecurringExpenses.reduce((sum, exp) => sum + (exp.tdsAmount || 0), 0);
    
    // Calculate paid and unpaid amounts from expenses (excluding baseExpense expenses)
    const paidAmount = nonRecurringExpenses.reduce((sum, exp) => {
      const total = Math.max(0, exp.totalAmount || 0);
      const paid = Math.min(Math.max(0, exp.paidAmount || 0), total);
      return sum + paid;
    }, 0);
    const unpaidAmount = nonRecurringExpenses.reduce((sum, exp) => {
      const total = Math.max(0, exp.totalAmount || 0);
      const paid = Math.min(Math.max(0, exp.paidAmount || 0), total);
      return sum + Math.max(0, total - paid);
    }, 0);

    // Category-wise summary (excluding baseExpense expenses)
    const categorySummary = nonRecurringExpenses.reduce((acc, exp) => {
      if (!acc[exp.category]) {
        acc[exp.category] = {
          totalExpense: 0,
          totalGST: 0,
          totalTDS: 0,
        };
      }
      acc[exp.category].totalExpense += exp.totalAmount;
      acc[exp.category].totalGST += exp.gstAmount;
      acc[exp.category].totalTDS += exp.tdsAmount;
      return acc;
    }, {});

    // Month-wise summary (excluding baseExpense expenses)
    const monthSummary = nonRecurringExpenses.reduce((acc, exp) => {
      if (!acc[exp.month]) {
        acc[exp.month] = {
          totalExpense: 0,
          totalGST: 0,
          totalTDS: 0,
        };
      }
      acc[exp.month].totalExpense += exp.totalAmount;
      acc[exp.month].totalGST += exp.gstAmount;
      acc[exp.month].totalTDS += exp.tdsAmount;
      return acc;
    }, {});

    // Category-wise monthly breakdown (excluding baseExpense expenses)
    const categoryMonthlyBreakdown = {};
    nonRecurringExpenses.forEach((exp) => {
      if (!categoryMonthlyBreakdown[exp.category]) {
        categoryMonthlyBreakdown[exp.category] = {
          category: exp.category,
          months: {},
          total: 0,
        };
      }
      if (!categoryMonthlyBreakdown[exp.category].months[exp.month]) {
        categoryMonthlyBreakdown[exp.category].months[exp.month] = 0;
      }
      categoryMonthlyBreakdown[exp.category].months[exp.month] += exp.totalAmount;
      categoryMonthlyBreakdown[exp.category].total += exp.totalAmount;
    });

    // Department-wise monthly breakdown (excluding baseExpense expenses)
    const departmentMonthlyBreakdown = {};
    nonRecurringExpenses.forEach((exp) => {
      if (!departmentMonthlyBreakdown[exp.department]) {
        departmentMonthlyBreakdown[exp.department] = {
          department: exp.department,
          months: {},
          total: 0,
        };
      }
      if (!departmentMonthlyBreakdown[exp.department].months[exp.month]) {
        departmentMonthlyBreakdown[exp.department].months[exp.month] = 0;
      }
      departmentMonthlyBreakdown[exp.department].months[exp.month] += exp.totalAmount;
      departmentMonthlyBreakdown[exp.department].total += exp.totalAmount;
    });

    // Current year total (replacing all-time total, excluding baseExpense expenses)
    const currentYear = new Date().getFullYear();
    const currentYearExpenses = await Expense.find({
      user: req.user._id,
      year: currentYear,
      status: { $nin: CANCEL_STATUSES },
    });
    const currentYearBaseExpenseIds = new Set(
      recurringExpenses
        .map(re => re.baseExpense?.toString())
        .filter(id => id)
    );
    const currentYearNonRecurringExpenses = currentYearExpenses.filter(expense => 
      !currentYearBaseExpenseIds.has(expense._id.toString())
    );
    const allTimeTotal = currentYearNonRecurringExpenses.reduce((sum, exp) => sum + exp.totalAmount, 0);

    res.json({
      year: year || 'All',
      month: month || 'All',
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      paidAmount: Math.round(paidAmount * 100) / 100,
      unpaidAmount: Math.round(unpaidAmount * 100) / 100,
      allTimeTotal: Math.round(allTimeTotal * 100) / 100,
      totalGST: Math.round(totalGST * 100) / 100,
      totalTDS: Math.round(totalTDS * 100) / 100,
      categorySummary: Object.entries(categorySummary).map(([category, data]) => ({
        category,
        totalExpense: Math.round(data.totalExpense * 100) / 100,
        totalGST: Math.round(data.totalGST * 100) / 100,
        totalTDS: Math.round(data.totalTDS * 100) / 100,
      })),
      monthSummary: Object.entries(monthSummary).map(([month, data]) => ({
        month,
        totalExpense: Math.round(data.totalExpense * 100) / 100,
        totalGST: Math.round(data.totalGST * 100) / 100,
        totalTDS: Math.round(data.totalTDS * 100) / 100,
      })),
      categoryMonthlyBreakdown: Object.values(categoryMonthlyBreakdown).map((item) => ({
        category: item.category,
        months: Object.entries(item.months).reduce((acc, [month, amount]) => {
          acc[month] = Math.round(amount * 100) / 100;
          return acc;
        }, {}),
        total: Math.round(item.total * 100) / 100,
      })),
      departmentMonthlyBreakdown: Object.values(departmentMonthlyBreakdown).map((item) => ({
        department: item.department,
        months: Object.entries(item.months).reduce((acc, [month, amount]) => {
          acc[month] = Math.round(amount * 100) / 100;
          return acc;
        }, {}),
        total: Math.round(item.total * 100) / 100,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get expense aging report
// @route   GET /api/dashboard/expenses/aging
// @access  Private
export const getExpenseAging = async (req, res) => {
  try {
    const expenses = await Expense.find({
      user: req.user._id,
      status: { $nin: CANCEL_STATUSES },
    }).lean();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Initialize age buckets
    const ageBuckets = {
      '0-5': { label: '0-5 Days', amount: 0, count: 0, expenses: [] },
      '6-15': { label: '6-15 Days', amount: 0, count: 0, expenses: [] },
      '16-30': { label: '16-30 Days', amount: 0, count: 0, expenses: [] },
      '30+': { label: '30+ Days', amount: 0, count: 0, expenses: [] },
    };

    // Get baseExpense IDs from recurring expenses (exclude from aging report)
    const recurringExpenses = await RecurringExpense.find({ user: req.user._id })
      .select('baseExpense')
      .lean();
    
    const baseExpenseIds = new Set(
      recurringExpenses
        .map(re => re.baseExpense?.toString())
        .filter(id => id)
    );

    // Filter out expenses that are baseExpense for recurring expenses
    const nonRecurringExpenses = expenses
      .filter((expense) => !baseExpenseIds.has(expense._id.toString()))
      .filter((expense) => !CANCEL_STATUSES.includes(expense.status));

    let totalOutstanding = 0;

    nonRecurringExpenses.forEach((expense) => {
      const totalAmount = expense.totalAmount || 0;
      const paidAmount = Math.min(Math.max(0, expense.paidAmount || 0), Math.max(0, totalAmount || 0));
      const outstandingAmount = Math.max(0, (totalAmount || 0) - paidAmount);

      // Only consider expenses with outstanding amount
      if (outstandingAmount > 0) {
        // Calculate age in days
        const expenseDate = new Date(expense.date);
        expenseDate.setHours(0, 0, 0, 0);
        const daysDifference = Math.floor((today - expenseDate) / (1000 * 60 * 60 * 24));

        // Determine age bucket
        let bucket;
        if (daysDifference <= 5) {
          bucket = '0-5';
        } else if (daysDifference <= 15) {
          bucket = '6-15';
        } else if (daysDifference <= 30) {
          bucket = '16-30';
        } else {
          bucket = '30+';
        }

        // Add to bucket
        ageBuckets[bucket].amount += outstandingAmount;
        ageBuckets[bucket].count += 1;
        ageBuckets[bucket].expenses.push({
          _id: expense._id,
          date: expense.date,
          vendor: expense.vendor || '',
          category: expense.category || '',
          totalAmount,
          paidAmount,
          outstandingAmount,
          daysDifference,
        });

        totalOutstanding += outstandingAmount;
      }
    });

    // Convert to array and round amounts
    const agingData = Object.values(ageBuckets).map((bucket) => ({
      ...bucket,
      amount: Math.round(bucket.amount * 100) / 100,
    }));

    res.json({
      agingData,
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      asOfDate: today.toISOString().split('T')[0],
    });
  } catch (error) {
    console.error('Error fetching expense aging:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch expense aging report' });
  }
};

// @desc    Export expense aging report to PDF
// @route   GET /api/dashboard/expenses/aging/pdf
// @access  Private
export const exportExpenseAgingToPDF = async (req, res) => {
  try {
    const { bucket } = req.query; // Get selected bucket from query parameter
    const expenses = await Expense.find({
      user: req.user._id,
      status: { $nin: CANCEL_STATUSES },
    }).lean();
    
    // Get baseExpense IDs from recurring expenses (exclude from aging report)
    const recurringExpenses = await RecurringExpense.find({ user: req.user._id })
      .select('baseExpense')
      .lean();
    
    const baseExpenseIds = new Set(
      recurringExpenses
        .map(re => re.baseExpense?.toString())
        .filter(id => id)
    );

    // Filter out expenses that are baseExpense for recurring expenses
    const nonRecurringExpenses = expenses
      .filter((expense) => !baseExpenseIds.has(expense._id.toString()))
      .filter((expense) => !CANCEL_STATUSES.includes(expense.status));
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Initialize age buckets
    const ageBuckets = {
      '0-5': { label: '0-5 Days', amount: 0, count: 0, expenses: [] },
      '6-15': { label: '6-15 Days', amount: 0, count: 0, expenses: [] },
      '16-30': { label: '16-30 Days', amount: 0, count: 0, expenses: [] },
      '30+': { label: '30+ Days', amount: 0, count: 0, expenses: [] },
    };

    let totalOutstanding = 0;

    nonRecurringExpenses.forEach((expense) => {
      const totalAmount = expense.totalAmount || 0;
      const paidAmount = Math.min(Math.max(0, expense.paidAmount || 0), Math.max(0, totalAmount || 0));
      const outstandingAmount = Math.max(0, (totalAmount || 0) - paidAmount);

      // Only consider expenses with outstanding amount
      if (outstandingAmount > 0) {
        // Calculate age in days
        const expenseDate = new Date(expense.date);
        expenseDate.setHours(0, 0, 0, 0);
        const daysDifference = Math.floor((today - expenseDate) / (1000 * 60 * 60 * 24));

        // Determine age bucket
        let bucketKey;
        if (daysDifference <= 5) {
          bucketKey = '0-5';
        } else if (daysDifference <= 15) {
          bucketKey = '6-15';
        } else if (daysDifference <= 30) {
          bucketKey = '16-30';
        } else {
          bucketKey = '30+';
        }

        // Add to bucket
        ageBuckets[bucketKey].amount += outstandingAmount;
        ageBuckets[bucketKey].count += 1;
        ageBuckets[bucketKey].expenses.push({
          _id: expense._id,
          date: expense.date,
          vendor: expense.vendor || '',
          category: expense.category || '',
          totalAmount,
          paidAmount,
          outstandingAmount,
          daysDifference,
        });

        totalOutstanding += outstandingAmount;
      }
    });

    // Convert to array and round amounts
    let agingData = Object.values(ageBuckets).map((bucket) => ({
      ...bucket,
      amount: Math.round(bucket.amount * 100) / 100,
    }));

    // Filter by selected bucket if provided
    let filteredTotalOutstanding = totalOutstanding;
    let detailedExpenses = null;
    if (bucket) {
      const selectedBucketData = agingData.find(b => b.label === bucket);
      if (selectedBucketData) {
        agingData = [selectedBucketData];
        filteredTotalOutstanding = selectedBucketData.amount;
        detailedExpenses = selectedBucketData.expenses || [];
      }
    }

    const asOfDate = today.toISOString().split('T')[0];
    const totalOutstandingRounded = Math.round(filteredTotalOutstanding * 100) / 100;

    const outputPath = path.join(__dirname, '../temp', `expense-aging-${Date.now()}.pdf`);
    
    // Ensure temp directory exists
    const tempDir = path.dirname(outputPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Generate PDF with selected bucket info and detailed expenses
    await generateExpenseAgingPDF(agingData, totalOutstandingRounded, asOfDate, outputPath, bucket, detailedExpenses);

    // Check if file was created
    if (!fs.existsSync(outputPath)) {
      throw new Error('PDF file was not created');
    }

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="expense-aging-${asOfDate}.pdf"`);
    res.setHeader('Cache-Control', 'no-cache');

    // Send the PDF file
    const fileStream = fs.createReadStream(outputPath);
    fileStream.pipe(res);

    fileStream.on('end', () => {
      // Clean up: delete the temporary file after sending
      setTimeout(() => {
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
      }, 1000);
    });

    fileStream.on('error', (error) => {
      console.error('Error streaming PDF:', error);
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error generating PDF' });
      }
    });
  } catch (error) {
    console.error('Error exporting expense aging to PDF:', error);
    res.status(500).json({ message: error.message || 'Failed to export expense aging report to PDF' });
  }
};

// @desc    Get revenue dashboard summary
// @route   GET /api/dashboard/revenue
// @access  Private
export const getRevenueDashboard = async (req, res) => {
  try {
    const { year, month } = req.query;
    const filter = { user: req.user._id };
    if (year) filter.year = parseInt(year);
    if (month) filter.month = month;

    // Sync: ensure paid/partial invoices appear in Revenue + dashboard
    // This is a safety net for older data or missed hooks.
    try {
      await syncInvoicesWithCollectionsWithoutRevenue(req.user._id);
    } catch (syncError) {
      console.error('⚠️ Revenue dashboard sync failed:', syncError?.message || syncError);
    }

    const revenue = await Revenue.find(filter)
      .populate({
        path: 'invoiceId',
        select: 'invoiceNumber invoiceDate status receivedAmount paidAmount',
        options: { lean: true }
      })
      .lean();

    // Total revenue (cash collected) for the year
    const totalRevenue = revenue.reduce((sum, rev) => sum + (rev.receivedAmount || 0), 0);
    const totalGST = revenue.reduce((sum, rev) => sum + rev.gstAmount, 0);
    const totalTDS = revenue.reduce((sum, rev) => sum + rev.tdsAmount, 0);
    const totalRemittance = revenue.reduce((sum, rev) => sum + (rev.remittanceCharges || 0), 0);

    // Revenue by geography
    const geoSummary = revenue.reduce((acc, rev) => {
      if (!acc[rev.country]) {
        acc[rev.country] = 0;
      }
      acc[rev.country] += (rev.receivedAmount || 0);
      return acc;
    }, {});

    // Revenue by service
    const serviceSummary = revenue.reduce((acc, rev) => {
      if (!acc[rev.service]) {
        acc[rev.service] = 0;
      }
      acc[rev.service] += (rev.receivedAmount || 0);
      return acc;
    }, {});

    // Month-wise summary
    const monthSummary = revenue.reduce((acc, rev) => {
      if (!acc[rev.month]) {
        acc[rev.month] = {
          invoiceAmount: 0,
          received: 0,
          due: 0,
          gst: 0,
          tds: 0,
        };
      }
      acc[rev.month].invoiceAmount += rev.invoiceAmount;
      acc[rev.month].received += rev.receivedAmount;
      acc[rev.month].due += rev.dueAmount;
      acc[rev.month].gst += rev.gstAmount;
      acc[rev.month].tds += rev.tdsAmount;
      return acc;
    }, {});

    // Service-wise monthly breakdown
    const serviceMonthlyBreakdown = {};
    revenue.forEach((rev) => {
      if (!serviceMonthlyBreakdown[rev.service]) {
        serviceMonthlyBreakdown[rev.service] = {
          service: rev.service,
          months: {},
          total: 0,
        };
      }
      if (!serviceMonthlyBreakdown[rev.service].months[rev.month]) {
        serviceMonthlyBreakdown[rev.service].months[rev.month] = 0;
      }
      serviceMonthlyBreakdown[rev.service].months[rev.month] += (rev.receivedAmount || 0);
      serviceMonthlyBreakdown[rev.service].total += (rev.receivedAmount || 0);
    });

    // Country-wise monthly breakdown
    const countryMonthlyBreakdown = {};
    revenue.forEach((rev) => {
      if (!countryMonthlyBreakdown[rev.country]) {
        countryMonthlyBreakdown[rev.country] = {
          country: rev.country,
          months: {},
          total: 0,
        };
      }
      if (!countryMonthlyBreakdown[rev.country].months[rev.month]) {
        countryMonthlyBreakdown[rev.country].months[rev.month] = 0;
      }
      countryMonthlyBreakdown[rev.country].months[rev.month] += (rev.receivedAmount || 0);
      countryMonthlyBreakdown[rev.country].total += (rev.receivedAmount || 0);
    });

    res.json({
      year: year || 'All',
      month: month || 'All',
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalGST: Math.round(totalGST * 100) / 100,
      totalTDS: Math.round(totalTDS * 100) / 100,
      totalRemittance: Math.round(totalRemittance * 100) / 100,
      geoSummary: Object.entries(geoSummary).map(([country, total]) => ({
        country,
        total: Math.round(total * 100) / 100,
      })),
      serviceSummary: Object.entries(serviceSummary).map(([service, total]) => ({
        service,
        total: Math.round(total * 100) / 100,
      })),
      monthSummary: Object.entries(monthSummary).map(([month, data]) => ({
        month,
        invoiceAmount: Math.round(data.invoiceAmount * 100) / 100,
        received: Math.round(data.received * 100) / 100,
        due: Math.round(data.due * 100) / 100,
        gst: Math.round(data.gst * 100) / 100,
        tds: Math.round(data.tds * 100) / 100,
      })),
      serviceMonthlyBreakdown: Object.values(serviceMonthlyBreakdown).map((item) => ({
        service: item.service,
        months: Object.entries(item.months).reduce((acc, [month, amount]) => {
          acc[month] = Math.round(amount * 100) / 100;
          return acc;
        }, {}),
        total: Math.round(item.total * 100) / 100,
      })),
      countryMonthlyBreakdown: Object.values(countryMonthlyBreakdown).map((item) => ({
        country: item.country,
        months: Object.entries(item.months).reduce((acc, [month, amount]) => {
          acc[month] = Math.round(amount * 100) / 100;
          return acc;
        }, {}),
        total: Math.round(item.total * 100) / 100,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get overall dashboard summary
// @route   GET /api/dashboard/summary
// @access  Private
export const getDashboardSummary = async (req, res) => {
  try {
    const { year } = req.query;
    const yearFilter = year ? { year: parseInt(year) } : {};

    const expenses = await Expense.find({
      user: req.user._id,
      ...yearFilter,
      status: { $nin: CANCEL_STATUSES },
    });
    const revenue = await Revenue.find({ user: req.user._id, ...yearFilter });

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.totalAmount, 0);
    const totalRevenue = revenue.reduce((sum, rev) => sum + rev.invoiceAmount, 0);
    const netProfit = totalRevenue - totalExpenses;

    res.json({
      year: year || 'All',
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

