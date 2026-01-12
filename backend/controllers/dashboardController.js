import Expense from '../models/Expense.js';
import Revenue from '../models/Revenue.js';
import Invoice from '../models/Invoice.js';

// @desc    Get expense dashboard summary
// @route   GET /api/dashboard/expenses
// @access  Private
export const getExpenseDashboard = async (req, res) => {
  try {
    const { year, month } = req.query;
    const filter = { user: req.user._id };
    if (year) filter.year = parseInt(year);
    if (month) filter.month = month;

    const expenses = await Expense.find(filter);

    // Total expenses for the year
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.totalAmount, 0);
    const totalGST = expenses.reduce((sum, exp) => sum + exp.gstAmount, 0);
    const totalTDS = expenses.reduce((sum, exp) => sum + exp.tdsAmount, 0);

    // Category-wise summary
    const categorySummary = expenses.reduce((acc, exp) => {
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

    // Month-wise summary
    const monthSummary = expenses.reduce((acc, exp) => {
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

    // Category-wise monthly breakdown
    const categoryMonthlyBreakdown = {};
    expenses.forEach((exp) => {
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

    // Operation Type-wise monthly breakdown
    const operationTypeMonthlyBreakdown = {};
    expenses.forEach((exp) => {
      if (!operationTypeMonthlyBreakdown[exp.operationType]) {
        operationTypeMonthlyBreakdown[exp.operationType] = {
          operationType: exp.operationType,
          months: {},
          total: 0,
        };
      }
      if (!operationTypeMonthlyBreakdown[exp.operationType].months[exp.month]) {
        operationTypeMonthlyBreakdown[exp.operationType].months[exp.month] = 0;
      }
      operationTypeMonthlyBreakdown[exp.operationType].months[exp.month] += exp.totalAmount;
      operationTypeMonthlyBreakdown[exp.operationType].total += exp.totalAmount;
    });

    // All-time totals
    const allTimeExpenses = await Expense.find({ user: req.user._id });
    const allTimeTotal = allTimeExpenses.reduce((sum, exp) => sum + exp.totalAmount, 0);

    res.json({
      year: year || 'All',
      month: month || 'All',
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      totalGST: Math.round(totalGST * 100) / 100,
      totalTDS: Math.round(totalTDS * 100) / 100,
      allTimeTotal: Math.round(allTimeTotal * 100) / 100,
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
      operationTypeMonthlyBreakdown: Object.values(operationTypeMonthlyBreakdown).map((item) => ({
        operationType: item.operationType,
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

// @desc    Get revenue dashboard summary
// @route   GET /api/dashboard/revenue
// @access  Private
export const getRevenueDashboard = async (req, res) => {
  try {
    const { year, month } = req.query;
    const filter = { user: req.user._id };
    if (year) filter.year = parseInt(year);
    if (month) filter.month = month;

    const revenue = await Revenue.find(filter)
      .populate({
        path: 'invoiceId',
        select: 'invoiceNumber invoiceDate status receivedAmount paidAmount',
        options: { lean: true }
      })
      .lean();

    // Total revenue for the year
    const totalRevenue = revenue.reduce((sum, rev) => sum + rev.invoiceAmount, 0);
    const totalGST = revenue.reduce((sum, rev) => sum + rev.gstAmount, 0);
    const totalTDS = revenue.reduce((sum, rev) => sum + rev.tdsAmount, 0);
    const totalRemittance = revenue.reduce((sum, rev) => sum + (rev.remittanceCharges || 0), 0);

    // Revenue by geography
    const geoSummary = revenue.reduce((acc, rev) => {
      if (!acc[rev.country]) {
        acc[rev.country] = 0;
      }
      acc[rev.country] += rev.invoiceAmount;
      return acc;
    }, {});

    // Revenue by service
    const serviceSummary = revenue.reduce((acc, rev) => {
      if (!acc[rev.service]) {
        acc[rev.service] = 0;
      }
      acc[rev.service] += rev.invoiceAmount;
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
      serviceMonthlyBreakdown[rev.service].months[rev.month] += rev.invoiceAmount;
      serviceMonthlyBreakdown[rev.service].total += rev.invoiceAmount;
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
      countryMonthlyBreakdown[rev.country].months[rev.month] += rev.invoiceAmount;
      countryMonthlyBreakdown[rev.country].total += rev.invoiceAmount;
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

    const expenses = await Expense.find({ user: req.user._id, ...yearFilter });
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

