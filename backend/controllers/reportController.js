import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import Invoice from '../models/Invoice.js';
import Expense from '../models/Expense.js';
import Payment from '../models/Payment.js';
import RecurringInvoice from '../models/RecurringInvoice.js';
import RecurringExpense from '../models/RecurringExpense.js';
import Budget from '../models/Budget.js';
import Vendor from '../models/Vendor.js';

const CANCEL_STATUSES = ['Cancel', 'Cancelled', 'Canceled'];
const DEFAULT_TZ = 'Asia/Kolkata';
const ALLOWED_INVOICE_STATUSES = new Set(['Paid', 'Partial', 'Unpaid', 'Cancel']);
const ALLOWED_EXPENSE_STATUSES = new Set(['Paid', 'Partial', 'Unpaid', 'Cancel']);

const REPORT_COLORS = ['#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#64748b', '#0ea5e9', '#14b8a6'];

const fmtINR = (n) =>
  (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const setDownloadHeaders = (res, contentType, filename) => {
  res.setHeader('Content-Type', contentType);
  // RFC 5987 filename* for UTF-8 + fallback filename
  const safe = String(filename || 'download').replace(/["\r\n]/g, '');
  res.setHeader('Content-Disposition', `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`);
};

const clampNumber = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const parseISODate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const getQuarterRange = (year, quarter) => {
  const q = clampNumber(quarter, 1, 4, 1);
  const startMonth = (q - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0); // last day of quarter
  return { start: startOfDay(start), end: endOfDay(end) };
};

const getDateRangeFromQuery = (query) => {
  const view = String(query.view || 'custom').toLowerCase();
  const tz = String(query.tz || DEFAULT_TZ);

  // Custom range wins if both provided
  const startDate = parseISODate(query.startDate);
  const endDate = parseISODate(query.endDate);
  if (startDate && endDate) {
    return { start: startOfDay(startDate), end: endOfDay(endDate), view: 'custom', tz };
  }

  const year = clampNumber(query.year, 2000, 2100, new Date().getFullYear());

  if (view === 'yearly') {
    return {
      start: startOfDay(new Date(year, 0, 1)),
      end: endOfDay(new Date(year, 11, 31)),
      view,
      tz,
    };
  }

  if (view === 'quarterly') {
    const { start, end } = getQuarterRange(year, query.quarter || 1);
    return { start, end, view, tz };
  }

  if (view === 'monthly') {
    const month = clampNumber(query.month, 1, 12, new Date().getMonth() + 1);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return { start: startOfDay(start), end: endOfDay(end), view, tz };
  }

  // Default to current month if nothing specified
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: startOfDay(start), end: endOfDay(end), view: 'monthly', tz };
};

const buildInvoiceStatusMatch = (invoiceStatus) => {
  const s = String(invoiceStatus || '').trim();
  if (s && ALLOWED_INVOICE_STATUSES.has(s)) return { $eq: s };
  return { $nin: CANCEL_STATUSES };
};

const buildExpenseStatusMatch = (expenseStatus) => {
  const s = String(expenseStatus || '').trim();
  if (s && ALLOWED_EXPENSE_STATUSES.has(s)) return { $eq: s };
  return { $nin: CANCEL_STATUSES };
};

const invoiceBaseInINRExpr = () => {
  // Returns Mongo aggregation expression for invoice base amount (ex GST) in INR.
  // Uses reporting-standard totalAmount (INR) as conversion anchor when possible.
  // - baseAmount is stored in invoice currency (amountDetails.baseAmount)
  // - receivableAmount is stored in invoice currency (amountDetails.receivableAmount)
  // - totalAmount is stored in INR (receivable in INR)
  return {
    $let: {
      vars: {
        base: { $ifNull: ['$amountDetails.baseAmount', { $ifNull: ['$subTotal', 0] }] },
        receivable: { $ifNull: ['$amountDetails.receivableAmount', { $ifNull: ['$grandTotal', 0] }] },
        totalInINR: { $ifNull: ['$totalAmount', 0] },
        currency: { $ifNull: ['$currencyDetails.invoiceCurrency', { $ifNull: ['$currency', 'INR'] }] },
        exchangeRate: { $ifNull: ['$currencyDetails.exchangeRate', { $ifNull: ['$exchangeRate', 1] }] },
      },
      in: {
        $cond: [
          { $gt: ['$$base', 0] },
          {
            $cond: [
              { $eq: ['$$currency', 'INR'] },
              '$$base',
              {
                $let: {
                  vars: {
                    factor: {
                      $cond: [
                        { $and: [{ $gt: ['$$totalInINR', 0] }, { $gt: ['$$receivable', 0] }] },
                        { $divide: ['$$totalInINR', '$$receivable'] },
                        { $cond: [{ $gt: ['$$exchangeRate', 0] }, '$$exchangeRate', 1] },
                      ],
                    },
                  },
                  in: { $multiply: ['$$base', '$$factor'] },
                },
              },
            ],
          },
          0,
        ],
      },
    },
  };
};

const invoiceBaseInINRExprFromDoc = (docPath) => {
  // Same as invoiceBaseInINRExpr(), but for a nested doc (e.g. $baseInvoiceDoc)
  const basePath = `$${docPath}.amountDetails.baseAmount`;
  const subTotalPath = `$${docPath}.subTotal`;
  const receivablePath = `$${docPath}.amountDetails.receivableAmount`;
  const grandTotalPath = `$${docPath}.grandTotal`;
  const totalInINRPath = `$${docPath}.totalAmount`;
  const currencyPath = `$${docPath}.currencyDetails.invoiceCurrency`;
  const legacyCurrencyPath = `$${docPath}.currency`;
  const exchangeRatePath = `$${docPath}.currencyDetails.exchangeRate`;
  const legacyExchangeRatePath = `$${docPath}.exchangeRate`;

  return {
    $let: {
      vars: {
        base: { $ifNull: [basePath, { $ifNull: [subTotalPath, 0] }] },
        receivable: { $ifNull: [receivablePath, { $ifNull: [grandTotalPath, 0] }] },
        totalInINR: { $ifNull: [totalInINRPath, 0] },
        currency: { $ifNull: [currencyPath, { $ifNull: [legacyCurrencyPath, 'INR'] }] },
        exchangeRate: { $ifNull: [exchangeRatePath, { $ifNull: [legacyExchangeRatePath, 1] }] },
      },
      in: {
        $cond: [
          { $gt: ['$$base', 0] },
          {
            $cond: [
              { $eq: ['$$currency', 'INR'] },
              '$$base',
              {
                $let: {
                  vars: {
                    factor: {
                      $cond: [
                        { $and: [{ $gt: ['$$totalInINR', 0] }, { $gt: ['$$receivable', 0] }] },
                        { $divide: ['$$totalInINR', '$$receivable'] },
                        { $cond: [{ $gt: ['$$exchangeRate', 0] }, '$$exchangeRate', 1] },
                      ],
                    },
                  },
                  in: { $multiply: ['$$base', '$$factor'] },
                },
              },
            ],
          },
          0,
        ],
      },
    },
  };
};

const invoiceAmountInINRExpr = () => {
  // Returns Mongo aggregation expression for invoice total in INR
  // - Prefer reporting-standard `totalAmount` (already stored in INR)
  // - Fallback to legacy fields with currency conversion for older invoices
  return {
    $let: {
      vars: {
        totalAmount: { $ifNull: ['$totalAmount', 0] },
        currency: { $ifNull: ['$currencyDetails.invoiceCurrency', { $ifNull: ['$currency', 'INR'] }] },
        exchangeRate: { $ifNull: ['$currencyDetails.exchangeRate', { $ifNull: ['$exchangeRate', 1] }] },
        inrEquivalent: { $ifNull: ['$currencyDetails.inrEquivalent', 0] },
        receivable: { $ifNull: ['$amountDetails.receivableAmount', { $ifNull: ['$grandTotal', 0] }] },
      },
      in: {
        $cond: [
          { $gt: ['$$totalAmount', 0] },
          '$$totalAmount',
          {
            $cond: [
              { $ne: ['$$currency', 'INR'] },
              {
                $cond: [
                  { $gt: ['$$inrEquivalent', 0] },
                  '$$inrEquivalent',
                  {
                    $multiply: [
                      '$$receivable',
                      { $cond: [{ $gt: ['$$exchangeRate', 0] }, '$$exchangeRate', 1] },
                    ],
                  },
                ],
              },
              '$$receivable',
            ],
          },
        ],
      },
    },
  };
};

const invoiceGstInINRExpr = () => {
  return {
    $let: {
      vars: {
        gstAmount: { $ifNull: ['$gstAmount', 0] },
        currency: { $ifNull: ['$currencyDetails.invoiceCurrency', { $ifNull: ['$currency', 'INR'] }] },
        exchangeRate: { $ifNull: ['$currencyDetails.exchangeRate', { $ifNull: ['$exchangeRate', 1] }] },
        gst: {
          $add: [{ $ifNull: ['$cgst', 0] }, { $ifNull: ['$sgst', 0] }, { $ifNull: ['$igst', 0] }],
        },
      },
      in: {
        $cond: [
          { $gt: ['$$gstAmount', 0] },
          '$$gstAmount',
          {
            $cond: [
              { $ne: ['$$currency', 'INR'] },
              { $multiply: ['$$gst', { $cond: [{ $gt: ['$$exchangeRate', 0] }, '$$exchangeRate', 1] }] },
              '$$gst',
            ],
          },
        ],
      },
    },
  };
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// ============================================
// 1) Profit & Loss (P&L)
// ============================================
export const getProfitLossReport = async (req, res) => {
  try {
    const { start, end } = getDateRangeFromQuery(req.query);

    const invoiceMatch = {
      user: req.user._id,
      status: buildInvoiceStatusMatch(req.query.invoiceStatus),
      invoiceDate: { $gte: start, $lte: end },
    };

    const expenseMatch = {
      user: req.user._id,
      status: buildExpenseStatusMatch(req.query.expenseStatus),
      date: { $gte: start, $lte: end },
    };

    const [incomeAgg, expenseAgg] = await Promise.all([
      Invoice.aggregate([
        { $match: invoiceMatch },
        // Income (ex GST) = sum of base amount in INR
        { $addFields: { baseInINR: invoiceBaseInINRExpr() } },
        { $group: { _id: null, totalIncome: { $sum: '$baseInINR' } } },
      ]),
      Expense.aggregate([
        { $match: expenseMatch },
        // Expenses (ex GST) = sum of amountExclTax
        { $group: { _id: null, totalExpenses: { $sum: { $ifNull: ['$amountExclTax', 0] } } } },
      ]),
    ]);

    const totalIncome = round2(incomeAgg?.[0]?.totalIncome || 0);
    const totalExpenses = round2(expenseAgg?.[0]?.totalExpenses || 0);
    const grossProfit = round2(totalIncome - totalExpenses);
    const netProfit = grossProfit; // basic version
    const profitMarginPct = totalIncome > 0 ? round2((netProfit / totalIncome) * 100) : 0;

    res.json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      totalIncome,
      totalExpenses,
      grossProfit,
      netProfit,
      profitMarginPct,
    });
  } catch (error) {
    console.error('Error in P&L report:', error);
    res.status(500).json({ message: error.message || 'Failed to generate Profit & Loss report' });
  }
};

// ============================================
// 2) Income vs Expense (monthly trend + gap)
// ============================================
export const getIncomeVsExpenseReport = async (req, res) => {
  try {
    const { start, end, tz } = getDateRangeFromQuery(req.query);

    const invoiceMatch = {
      user: req.user._id,
      status: buildInvoiceStatusMatch(req.query.invoiceStatus),
      invoiceDate: { $gte: start, $lte: end },
    };

    const expenseMatch = {
      user: req.user._id,
      status: buildExpenseStatusMatch(req.query.expenseStatus),
      date: { $gte: start, $lte: end },
    };

    const [incomeByMonth, expenseByMonth] = await Promise.all([
      Invoice.aggregate([
        { $match: invoiceMatch },
        { $addFields: { baseInINR: invoiceBaseInINRExpr() } },
        {
          $group: {
            _id: { $dateToString: { date: '$invoiceDate', format: '%Y-%m', timezone: tz } },
            income: { $sum: '$baseInINR' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Expense.aggregate([
        { $match: expenseMatch },
        {
          $group: {
            _id: { $dateToString: { date: '$date', format: '%Y-%m', timezone: tz } },
            expense: { $sum: { $ifNull: ['$amountExclTax', 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const byKey = new Map();
    for (const row of incomeByMonth) byKey.set(row._id, { period: row._id, income: round2(row.income), expense: 0 });
    for (const row of expenseByMonth) {
      const existing = byKey.get(row._id) || { period: row._id, income: 0, expense: 0 };
      existing.expense = round2(row.expense);
      byKey.set(row._id, existing);
    }

    const trend = Array.from(byKey.values())
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((p) => ({ ...p, gap: round2(p.income - p.expense) }));

    res.json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      trend,
    });
  } catch (error) {
    console.error('Error in Income vs Expense report:', error);
    res.status(500).json({ message: error.message || 'Failed to generate Income vs Expense report' });
  }
};

// ============================================
// 2b) Income vs Expense PDF export
// ============================================
export const getIncomeVsExpensePdfReport = async (req, res) => {
  try {
    const { start, end, tz } = getDateRangeFromQuery(req.query);

    const invoiceMatch = {
      user: req.user._id,
      status: buildInvoiceStatusMatch(req.query.invoiceStatus),
      invoiceDate: { $gte: start, $lte: end },
    };

    const expenseMatch = {
      user: req.user._id,
      status: buildExpenseStatusMatch(req.query.expenseStatus),
      date: { $gte: start, $lte: end },
    };

    const [incomeByMonth, expenseByMonth] = await Promise.all([
      Invoice.aggregate([
        { $match: invoiceMatch },
        { $addFields: { baseInINR: invoiceBaseInINRExpr() } },
        {
          $group: {
            _id: { $dateToString: { date: '$invoiceDate', format: '%Y-%m', timezone: tz } },
            income: { $sum: '$baseInINR' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Expense.aggregate([
        { $match: expenseMatch },
        {
          $group: {
            _id: { $dateToString: { date: '$date', format: '%Y-%m', timezone: tz } },
            expense: { $sum: { $ifNull: ['$amountExclTax', 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const byKey = new Map();
    for (const row of incomeByMonth) byKey.set(row._id, { period: row._id, income: round2(row.income), expense: 0 });
    for (const row of expenseByMonth) {
      const existing = byKey.get(row._id) || { period: row._id, income: 0, expense: 0 };
      existing.expense = round2(row.expense);
      byKey.set(row._id, existing);
    }

    const trend = Array.from(byKey.values())
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((p) => ({ ...p, gap: round2(p.income - p.expense) }));

    const totalIncome = round2(trend.reduce((s, r) => s + (r.income || 0), 0));
    const totalExpense = round2(trend.reduce((s, r) => s + (r.expense || 0), 0));
    const netProfit = round2(totalIncome - totalExpense);

    setDownloadHeaders(res, 'application/pdf', 'income-vs-expense.pdf');

    const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 40, info: { Title: 'Income vs Expense Report' } });
    doc.pipe(res);

    // Header
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#0f172a').text('Income vs Expense Report', { align: 'center' });
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(10).fillColor('#64748b').text(
      `Period: ${start.toLocaleDateString('en-IN')} to ${end.toLocaleDateString('en-IN')}`,
      { align: 'center' }
    );
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, { align: 'center' });

    // KPI strip
    doc.moveDown(1.2);
    const kpiY = doc.y;
    const cardW = 160;
    const cardH = 54;
    const gap = 12;
    const x0 = doc.page.margins.left;
    const cards = [
      { label: 'Total Income (ex GST)', value: fmtINR(totalIncome), color: '#16a34a' },
      { label: 'Total Expense (ex GST)', value: fmtINR(totalExpense), color: '#dc2626' },
      { label: 'Net Profit (INR)', value: fmtINR(netProfit), color: netProfit >= 0 ? '#2563eb' : '#dc2626' },
    ];
    cards.forEach((c, i) => {
      const x = x0 + i * (cardW + gap);
      doc.roundedRect(x, kpiY, cardW, cardH, 10).fill('#f8fafc').stroke('#e2e8f0');
      doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(9).text(c.label, x + 12, kpiY + 10, { width: cardW - 24 });
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(14).text(c.value, x + 12, kpiY + 28, { width: cardW - 24 });
      doc.rect(x + 12, kpiY + cardH - 8, cardW - 24, 3).fill(c.color);
    });

    // Chart
    doc.y = kpiY + cardH + 18;
    const chartX = x0;
    const chartY = doc.y;
    const chartW = 515;
    const chartH = 170;

    doc.roundedRect(chartX, chartY, chartW, chartH, 12).fill('#ffffff').stroke('#e2e8f0');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11).text('Trend', chartX + 12, chartY + 10);

    // Plot area
    const plotX = chartX + 36;
    const plotY = chartY + 34;
    const plotW = chartW - 52;
    const plotH = chartH - 60;

    const maxVal = Math.max(
      1,
      ...trend.flatMap((r) => [Number(r.income) || 0, Number(r.expense) || 0])
    );

    // Grid lines
    doc.strokeColor('#e2e8f0').lineWidth(1);
    for (let i = 0; i <= 4; i++) {
      const y = plotY + (plotH * i) / 4;
      doc.moveTo(plotX, y).lineTo(plotX + plotW, y).stroke();
    }

    const toPoint = (idx, value) => {
      const x = plotX + (trend.length <= 1 ? 0 : (plotW * idx) / (trend.length - 1));
      const y = plotY + plotH - (plotH * (Number(value) || 0)) / maxVal;
      return { x, y };
    };

    const drawSeries = (key, color) => {
      if (trend.length === 0) return;
      doc.strokeColor(color).lineWidth(2);
      trend.forEach((r, idx) => {
        const p = toPoint(idx, r[key]);
        if (idx === 0) doc.moveTo(p.x, p.y);
        else doc.lineTo(p.x, p.y);
      });
      doc.stroke();
    };

    drawSeries('income', '#16a34a');
    drawSeries('expense', '#dc2626');

    // Legend
    doc.fillColor('#0f172a').font('Helvetica').fontSize(9);
    const legendY = plotY + plotH + 8;
    doc.rect(plotX, legendY + 2, 10, 3).fill('#16a34a');
    doc.fillColor('#334155').text('Income', plotX + 14, legendY);
    doc.rect(plotX + 70, legendY + 2, 10, 3).fill('#dc2626');
    doc.fillColor('#334155').text('Expense', plotX + 84, legendY);

    // Table
    doc.y = chartY + chartH + 18;
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(12).text('Summary', { align: 'left' });
    doc.moveDown(0.6);

    const startX = x0;
    const cols = [
      { label: 'Month', w: 110 },
      { label: 'Income', w: 135, align: 'right' },
      { label: 'Expense', w: 135, align: 'right' },
      { label: 'Profit', w: 135, align: 'right' },
    ];
    const rowH = 18;

    const drawHeader = () => {
      const y = doc.y;
      doc.rect(startX, y, 515, rowH).fill('#0f172a');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
      let x = startX;
      cols.forEach((c) => {
        doc.text(c.label, x + 8, y + 5, { width: c.w - 16, align: c.align || 'left' });
        x += c.w;
      });
      doc.y = y + rowH;
      doc.fillColor('#0f172a').font('Helvetica').fontSize(9);
    };

    const ensureSpace = (needed) => {
      const bottom = doc.page.height - doc.page.margins.bottom;
      if (doc.y + needed > bottom) {
        doc.addPage();
      }
    };

    drawHeader();
    trend.forEach((r, idx) => {
      ensureSpace(rowH + 6);
      const y = doc.y;
      doc.rect(startX, y, 515, rowH).fill(idx % 2 === 0 ? '#f8fafc' : '#ffffff').stroke('#e2e8f0');
      let x = startX;
      doc.fillColor('#0f172a').font('Helvetica').fontSize(9);
      doc.text(r.period, x + 8, y + 5, { width: cols[0].w - 16 });
      x += cols[0].w;
      doc.text(fmtINR(r.income), x + 8, y + 5, { width: cols[1].w - 16, align: 'right' });
      x += cols[1].w;
      doc.text(fmtINR(r.expense), x + 8, y + 5, { width: cols[2].w - 16, align: 'right' });
      x += cols[2].w;
      doc.text(fmtINR(r.gap), x + 8, y + 5, { width: cols[3].w - 16, align: 'right' });
      doc.y = y + rowH;
    });

    doc.end();
  } catch (error) {
    console.error('Error in Income vs Expense PDF report:', error);
    res.status(500).json({ message: error.message || 'Failed to export Income vs Expense PDF' });
  }
};

// ============================================
// 3) Income Summary
// ============================================
export const getIncomeSummaryReport = async (req, res) => {
  try {
    const { start, end, tz } = getDateRangeFromQuery(req.query);

    const invoiceMatch = {
      user: req.user._id,
      status: buildInvoiceStatusMatch(req.query.invoiceStatus),
      invoiceDate: { $gte: start, $lte: end },
    };

    const [totalAgg, byMonth, byClient, byService, byDepartment] = await Promise.all([
      Invoice.aggregate([
        { $match: invoiceMatch },
        { $addFields: { baseInINR: invoiceBaseInINRExpr() } },
        { $group: { _id: null, totalIncome: { $sum: '$baseInINR' } } },
      ]),
      Invoice.aggregate([
        { $match: invoiceMatch },
        { $addFields: { baseInINR: invoiceBaseInINRExpr() } },
        {
          $group: {
            _id: { $dateToString: { date: '$invoiceDate', format: '%Y-%m', timezone: tz } },
            total: { $sum: '$baseInINR' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Invoice.aggregate([
        { $match: invoiceMatch },
        { $addFields: { baseInINR: invoiceBaseInINRExpr() } },
        {
          $group: {
            _id: { $ifNull: ['$clientDetails.name', 'Unknown'] },
            total: { $sum: '$baseInINR' },
          },
        },
        { $sort: { total: -1 } },
      ]),
      Invoice.aggregate([
        { $match: invoiceMatch },
        { $addFields: { baseInINR: invoiceBaseInINRExpr() } },
        {
          $group: {
            _id: {
              $ifNull: [
                '$service',
                { $ifNull: ['$serviceDetails.serviceType', { $ifNull: ['$serviceDetails.description', 'Unspecified'] }] },
              ],
            },
            total: { $sum: '$baseInINR' },
          },
        },
        { $sort: { total: -1 } },
      ]),
      Invoice.aggregate([
        { $match: invoiceMatch },
        { $addFields: { baseInINR: invoiceBaseInINRExpr() } },
        {
          $group: {
            _id: { $ifNull: ['$department', 'Unassigned'] },
            total: { $sum: '$baseInINR' },
          },
        },
        { $sort: { total: -1 } },
      ]),
    ]);

    res.json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      totalIncome: round2(totalAgg?.[0]?.totalIncome || 0),
      byMonth: byMonth.map((r) => ({ period: r._id, total: round2(r.total) })),
      byClient: byClient.map((r) => ({ client: r._id, total: round2(r.total) })),
      byService: byService.map((r) => ({ service: r._id, total: round2(r.total) })),
      byDepartment: byDepartment.map((r) => ({ department: r._id, total: round2(r.total) })),
    });
  } catch (error) {
    console.error('Error in Income Summary report:', error);
    res.status(500).json({ message: error.message || 'Failed to generate Income Summary report' });
  }
};

// ============================================
// 4) Recurring vs One-time Income
// ============================================
export const getRecurringIncomeReport = async (req, res) => {
  try {
    const { start, end } = getDateRangeFromQuery(req.query);

    const invoiceMatch = {
      user: req.user._id,
      status: buildInvoiceStatusMatch(req.query.invoiceStatus),
      invoiceDate: { $gte: start, $lte: end },
    };

    const agg = await Invoice.aggregate([
      { $match: invoiceMatch },
      {
        $addFields: {
          baseInINR: invoiceBaseInINRExpr(),
          isRecurringComputed: {
            $cond: [{ $eq: ['$serviceDetails.engagementType', 'Recurring'] }, true, { $ifNull: ['$isRecurring', false] }],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalIncome: { $sum: '$baseInINR' },
          recurringIncome: { $sum: { $cond: ['$isRecurringComputed', '$baseInINR', 0] } },
          oneTimeIncome: { $sum: { $cond: ['$isRecurringComputed', 0, '$baseInINR'] } },
        },
      },
    ]);

    const totalIncome = round2(agg?.[0]?.totalIncome || 0);
    const recurringRevenue = round2(agg?.[0]?.recurringIncome || 0);
    const oneTimeRevenue = round2(agg?.[0]?.oneTimeIncome || 0);

    // MRR = sum of active recurring schedules normalized to monthly base amount (ex GST) in INR (as-of endDate)
    const mrrAgg = await RecurringInvoice.aggregate([
      {
        $match: {
          user: req.user._id,
          isActive: true,
          startOn: { $lte: end },
          $or: [{ neverExpires: true }, { endsOn: null }, { endsOn: { $gte: end } }],
        },
      },
      {
        $lookup: {
          from: 'invoices',
          localField: 'baseInvoice',
          foreignField: '_id',
          as: 'baseInvoiceDoc',
        },
      },
      { $unwind: '$baseInvoiceDoc' },
      {
        $addFields: {
          baseInINR: invoiceBaseInINRExprFromDoc('baseInvoiceDoc'),
        },
      },
      {
        $addFields: {
          monthlyBase: {
            $switch: {
              branches: [
                { case: { $eq: ['$repeatEvery', 'Week'] }, then: { $multiply: ['$baseInINR', 4.33] } },
                { case: { $eq: ['$repeatEvery', 'Month'] }, then: '$baseInINR' },
                { case: { $eq: ['$repeatEvery', 'Quarter'] }, then: { $divide: ['$baseInINR', 3] } },
                { case: { $eq: ['$repeatEvery', 'Half Yearly'] }, then: { $divide: ['$baseInINR', 6] } },
                { case: { $eq: ['$repeatEvery', 'Six Month'] }, then: { $divide: ['$baseInINR', 6] } },
                { case: { $eq: ['$repeatEvery', 'Year'] }, then: { $divide: ['$baseInINR', 12] } },
              ],
              default: '$baseInINR',
            },
          },
        },
      },
      { $group: { _id: null, expectedMRR: { $sum: '$monthlyBase' } } },
    ]);
    const mrr = round2(mrrAgg?.[0]?.expectedMRR || 0);

    // Stability % = share of recurring revenue in the selected period
    const stabilityPct = totalIncome > 0 ? round2((recurringRevenue / totalIncome) * 100) : 0;

    res.json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      totalIncome,
      mrr,
      oneTimeRevenue,
      stabilityPct,
      recurringRevenue,
    });
  } catch (error) {
    console.error('Error in Recurring vs One-time Income report:', error);
    res.status(500).json({ message: error.message || 'Failed to generate Recurring vs One-time Income report' });
  }
};

// ============================================
// 5) Invoice Aging / Pending Collection
// ============================================
export const getInvoiceAgingReport = async (req, res) => {
  try {
    const today = startOfDay(new Date());
    const { start, end } = getDateRangeFromQuery(req.query);

    const match = {
      user: req.user._id,
      status: { $in: ['Unpaid', 'Partial'] },
      invoiceDate: { $gte: start, $lte: end },
    };

    const aging = await Invoice.aggregate([
      { $match: match },
      {
        $addFields: {
          totalInINR: invoiceAmountInINRExpr(),
          paidInINR: { $ifNull: ['$paidAmount', 0] }, // stored in INR by payment flow
          dueInINRStored: { $ifNull: ['$dueAmount', 0] }, // reporting-standard (INR)
        },
      },
      {
        $addFields: {
          dueInINR: {
            $cond: [
              { $gt: ['$dueInINRStored', 0] },
              '$dueInINRStored',
              { $max: [0, { $subtract: ['$totalInINR', '$paidInINR'] }] },
            ],
          },
          daysPastDueRaw: {
            $dateDiff: {
              startDate: '$dueDate',
              endDate: today,
              unit: 'day',
            },
          },
        },
      },
      { $match: { dueInINR: { $gt: 0 } } },
      {
        $addFields: {
          daysPastDue: { $max: [0, '$daysPastDueRaw'] },
          bucket: {
            $switch: {
              branches: [
                { case: { $lte: ['$daysPastDue', 30] }, then: '0-30' },
                { case: { $lte: ['$daysPastDue', 60] }, then: '31-60' },
                { case: { $lte: ['$daysPastDue', 90] }, then: '61-90' },
              ],
              default: '90+',
            },
          },
        },
      },
      {
        $group: {
          _id: '$bucket',
          outstanding: { $sum: '$dueInINR' },
          count: { $sum: 1 },
          overdue: {
            $sum: {
              $cond: [{ $gt: ['$daysPastDueRaw', 0] }, '$dueInINR', 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const paidAgg = await Invoice.aggregate([
      {
        $match: {
          user: req.user._id,
          status: 'Paid',
          invoiceDate: { $gte: start, $lte: end },
        },
      },
      { $addFields: { totalInINR: invoiceAmountInINRExpr() } },
      { $group: { _id: null, paidInvoicesTotal: { $sum: '$totalInINR' }, paidInvoicesCount: { $sum: 1 } } },
    ]);

    const outstandingTotal = round2(aging.reduce((s, r) => s + (r.outstanding || 0), 0));
    const overdueTotal = round2(aging.reduce((s, r) => s + (r.overdue || 0), 0));

    const bucketOrder = ['0-30', '31-60', '61-90', '90+'];
    const bucketMap = new Map(aging.map((r) => [r._id, r]));
    const buckets = bucketOrder.map((label) => {
      const row = bucketMap.get(label);
      return {
        bucket: label,
        count: row ? row.count : 0,
        total: round2(row ? row.outstanding : 0),
      };
    });

    res.json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      asOfDate: today.toISOString(),
      paidInvoices: {
        total: round2(paidAgg?.[0]?.paidInvoicesTotal || 0),
        count: paidAgg?.[0]?.paidInvoicesCount || 0,
      },
      outstanding: {
        total: outstandingTotal,
        overdueTotal,
        buckets,
      },
    });
  } catch (error) {
    console.error('Error in Invoice Aging report:', error);
    res.status(500).json({ message: error.message || 'Failed to generate Invoice Aging report' });
  }
};

// ============================================
// 6) Fixed vs Variable Expense (+ break-even)
// ============================================
export const getFixedVsVariableExpenseReport = async (req, res) => {
  try {
    const { start, end } = getDateRangeFromQuery(req.query);
    const explicitContributionMargin = req.query.contributionMargin;

    const match = {
      user: req.user._id,
      status: buildExpenseStatusMatch(req.query.expenseStatus),
      date: { $gte: start, $lte: end },
    };

    const agg = await Expense.aggregate([
      { $match: match },
      {
        $addFields: {
          typeComputed: { $ifNull: ['$type', 'Variable'] },
          total: { $ifNull: ['$amountExclTax', 0] }, // ex GST
        },
      },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: '$total' },
          fixedCost: { $sum: { $cond: [{ $eq: ['$typeComputed', 'Fixed'] }, '$total', 0] } },
          variableCost: { $sum: { $cond: [{ $eq: ['$typeComputed', 'Variable'] }, '$total', 0] } },
        },
      },
    ]);

    const totalExpenses = round2(agg?.[0]?.totalExpenses || 0);
    const fixedCost = round2(agg?.[0]?.fixedCost || 0);
    const variableCost = round2(agg?.[0]?.variableCost || 0);
    const fixedPct = totalExpenses > 0 ? round2((fixedCost / totalExpenses) * 100) : 0;
    const variablePct = totalExpenses > 0 ? round2((variableCost / totalExpenses) * 100) : 0;

    const incomeAgg = await Invoice.aggregate([
      {
        $match: {
          user: req.user._id,
          status: buildInvoiceStatusMatch(req.query.invoiceStatus),
          invoiceDate: { $gte: start, $lte: end },
        },
      },
      { $addFields: { baseInINR: invoiceBaseInINRExpr() } },
      { $group: { _id: null, totalIncome: { $sum: '$baseInINR' } } },
    ]);
    const totalIncome = round2(incomeAgg?.[0]?.totalIncome || 0);

    // Contribution margin ratio:
    // If explicitly provided, use it. Otherwise compute from real revenue and variable cost.
    // marginRatio = (Revenue - VariableCost) / Revenue
    const computedMarginRatio =
      totalIncome > 0 ? clampNumber((totalIncome - variableCost) / totalIncome, 0, 0.99, 0) : 0;
    const contributionMargin = explicitContributionMargin !== undefined
      ? clampNumber(explicitContributionMargin, 0.01, 0.99, 0.4)
      : computedMarginRatio;

    const breakEvenRevenue = contributionMargin > 0 ? round2(fixedCost / contributionMargin) : 0;

    let breakEvenStatus = 'break_even';
    if (totalIncome > fixedCost) breakEvenStatus = 'profit_zone';
    else if (totalIncome < fixedCost) breakEvenStatus = 'loss_zone';

    res.json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      totalExpenses,
      fixedCost,
      variableCost,
      fixedPct,
      variablePct,
      totalIncome,
      breakEvenStatus,
      breakEvenGap: round2(totalIncome - fixedCost),
      contributionMargin,
      contributionMarginComputed: round2(computedMarginRatio),
      breakEvenRevenue,
    });
  } catch (error) {
    console.error('Error in Fixed vs Variable Expense report:', error);
    res.status(500).json({ message: error.message || 'Failed to generate Fixed vs Variable Expense report' });
  }
};

// ============================================
// 7) Department-wise Expense
// ============================================
export const getDepartmentExpenseReport = async (req, res) => {
  try {
    const { start, end } = getDateRangeFromQuery(req.query);

    const match = {
      user: req.user._id,
      status: buildExpenseStatusMatch(req.query.expenseStatus),
      date: { $gte: start, $lte: end },
    };

    const rows = await Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ['$department', 'Unassigned'] },
          total: { $sum: { $ifNull: ['$amountExclTax', 0] } },
        },
      },
      { $sort: { total: -1 } },
    ]);

    const totalExpenses = round2(rows.reduce((s, r) => s + (r.total || 0), 0));
    res.json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      totalExpenses,
      byDepartment: rows.map((r) => ({
        department: r._id,
        total: round2(r.total),
        pct: totalExpenses > 0 ? round2((r.total / totalExpenses) * 100) : 0,
      })),
    });
  } catch (error) {
    console.error('Error in Department Expense report:', error);
    res.status(500).json({ message: error.message || 'Failed to generate Department Expense report' });
  }
};

// ============================================
// 8) Vendor / Tool-wise Expense (with monthly trend)
// ============================================
export const getVendorExpenseReport = async (req, res) => {
  try {
    const { start, end, tz } = getDateRangeFromQuery(req.query);
    const topN = clampNumber(req.query.top ?? 20, 1, 200, 20);

    const match = {
      user: req.user._id,
      status: buildExpenseStatusMatch(req.query.expenseStatus),
      date: { $gte: start, $lte: end },
    };

    const [byVendor, trend] = await Promise.all([
      Expense.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              $ifNull: [
                '$vendorId',
                {
                  $cond: [
                    { $gt: [{ $strLenCP: { $ifNull: ['$vendor', ''] } }, 0] },
                    '$vendor',
                    'Unknown',
                  ],
                },
              ],
            },
            total: { $sum: { $ifNull: ['$amountExclTax', 0] } },
          },
        },
        { $sort: { total: -1 } },
        { $limit: topN },
      ]),
      Expense.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              vendor: {
                $ifNull: [
                  '$vendorId',
                  {
                    $cond: [
                      { $gt: [{ $strLenCP: { $ifNull: ['$vendor', ''] } }, 0] },
                      '$vendor',
                      'Unknown',
                    ],
                  },
                ],
              },
              period: { $dateToString: { date: '$date', format: '%Y-%m', timezone: tz } },
            },
            total: { $sum: { $ifNull: ['$amountExclTax', 0] } },
          },
        },
        { $sort: { '_id.period': 1 } },
      ]),
    ]);

    // Resolve vendor names for vendorId entries
    const vendorIds = byVendor
      .map((r) => (mongoose.Types.ObjectId.isValid(r._id) ? new mongoose.Types.ObjectId(r._id) : null))
      .filter(Boolean);
    const vendorDocs = vendorIds.length
      ? await Vendor.find({ _id: { $in: vendorIds }, user: req.user._id }).select('name').lean()
      : [];
    const vendorNameMap = new Map(vendorDocs.map((v) => [String(v._id), v.name]));

    res.json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      byVendor: byVendor.map((r) => ({
        vendorId: mongoose.Types.ObjectId.isValid(r._id) ? String(r._id) : null,
        vendor: mongoose.Types.ObjectId.isValid(r._id) ? vendorNameMap.get(String(r._id)) || 'Vendor' : r._id,
        total: round2(r.total),
      })),
      trend: trend.map((r) => ({
        vendorId: mongoose.Types.ObjectId.isValid(r._id.vendor) ? String(r._id.vendor) : null,
        vendor: mongoose.Types.ObjectId.isValid(r._id.vendor)
          ? vendorNameMap.get(String(r._id.vendor)) || 'Vendor'
          : r._id.vendor,
        period: r._id.period,
        total: round2(r.total),
      })),
    });
  } catch (error) {
    console.error('Error in Vendor Expense report:', error);
    res.status(500).json({ message: error.message || 'Failed to generate Vendor Expense report' });
  }
};

// ============================================
// 9) Client Profitability (revenue-share allocation)
// ============================================
export const getClientProfitabilityReport = async (req, res) => {
  try {
    const { start, end } = getDateRangeFromQuery(req.query);

    // Revenue per client (ex GST) in INR
    const revenueRows = await Invoice.aggregate([
      {
        $match: {
          user: req.user._id,
          status: buildInvoiceStatusMatch(req.query.invoiceStatus),
          invoiceDate: { $gte: start, $lte: end },
        },
      },
      {
        $addFields: {
          baseInINR: invoiceBaseInINRExpr(),
          clientKey: { $ifNull: ['$clientDetails.name', 'Unknown'] },
        },
      },
      {
        $group: {
          _id: { client: '$clientKey' },
          revenue: { $sum: '$baseInINR' },
        },
      },
    ]);

    // Total expenses in the period (ex GST) in INR
    const expenseAgg = await Expense.aggregate([
      {
        $match: {
          user: req.user._id,
          status: buildExpenseStatusMatch(req.query.expenseStatus),
          date: { $gte: start, $lte: end },
        },
      },
      {
        $group: { _id: null, totalExpense: { $sum: { $ifNull: ['$amountExclTax', 0] } } },
      },
    ]);
    const totalExpense = Number(expenseAgg?.[0]?.totalExpense) || 0;

    // Allocate total expenses to clients proportionally by revenue share
    const totalRevenue = revenueRows.reduce((s, r) => s + (r.revenue || 0), 0);
    const clients = revenueRows.map((row) => {
      const client = row._id.client;
      const revenue = Number(row.revenue) || 0;
      const share = totalRevenue > 0 ? revenue / totalRevenue : 0;
      const allocatedExpense = totalExpense * share;
      const profit = revenue - allocatedExpense;
      const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
      return {
        client,
        revenue: round2(revenue),
        allocatedExpense: round2(allocatedExpense),
        profit: round2(profit),
        marginPct: round2(marginPct),
        flags: {
          lossMaking: profit < 0,
          lowMargin: marginPct > 0 && marginPct < 10,
        },
      };
    });

    clients.sort((a, b) => b.profit - a.profit);

    res.json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      clients,
      totals: {
        totalRevenue: round2(totalRevenue),
        totalExpense: round2(totalExpense),
      },
      allocationMethod: 'revenue_share',
    });
  } catch (error) {
    console.error('Error in Client Profitability report:', error);
    res.status(500).json({ message: error.message || 'Failed to generate Client Profitability report' });
  }
};

// ============================================
// 10) Budget vs Actual
// ============================================
export const getBudgetVsActualReport = async (req, res) => {
  try {
    const { start, end } = getDateRangeFromQuery(req.query);

    // Budget rows overlapping range
    const budgetRows = await Budget.aggregate([
      {
        $match: {
          user: req.user._id,
          periodStart: { $lte: end },
          periodEnd: { $gte: start },
        },
      },
      {
        $group: {
          _id: { department: { $ifNull: ['$department', 'Unassigned'] }, category: { $ifNull: ['$category', 'All'] } },
          budgeted: { $sum: { $ifNull: ['$amount', 0] } },
          reasons: { $addToSet: { $ifNull: ['$reason', ''] } },
        },
      },
    ]);

    // Actual expenses in range
    const actualRows = await Expense.aggregate([
      {
        $match: {
          user: req.user._id,
          status: buildExpenseStatusMatch(req.query.expenseStatus),
          date: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: { department: { $ifNull: ['$department', 'Unassigned'] }, category: { $ifNull: ['$category', 'All'] } },
          actual: { $sum: { $ifNull: ['$amountExclTax', 0] } },
        },
      },
    ]);

    const key = (d, c) => `${d}__${c}`;
    const map = new Map();
    for (const b of budgetRows) {
      map.set(key(b._id.department, b._id.category), {
        department: b._id.department,
        category: b._id.category,
        budgeted: b.budgeted || 0,
        actual: 0,
        reasons: (b.reasons || []).filter((x) => String(x).trim() !== ''),
      });
    }
    for (const a of actualRows) {
      const k = key(a._id.department, a._id.category);
      const existing = map.get(k) || {
        department: a._id.department,
        category: a._id.category,
        budgeted: 0,
        actual: 0,
        reasons: [],
      };
      existing.actual = a.actual || 0;
      map.set(k, existing);
    }

    const rows = Array.from(map.values()).map((r) => {
      const budgeted = round2(r.budgeted);
      const actual = round2(r.actual);
      const variance = round2(actual - budgeted);
      // If budget is zero, percentage variance is mathematically undefined.
      // Return null so the UI can display "N/A" instead of 0%.
      const variancePct = budgeted > 0 ? round2((variance / budgeted) * 100) : null;
      return { ...r, budgeted, actual, variance, variancePct };
    });

    rows.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

    res.json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      rows,
      totals: {
        budgeted: round2(rows.reduce((s, r) => s + (r.budgeted || 0), 0)),
        actual: round2(rows.reduce((s, r) => s + (r.actual || 0), 0)),
      },
    });
  } catch (error) {
    console.error('Error in Budget vs Actual report:', error);
    res.status(500).json({ message: error.message || 'Failed to generate Budget vs Actual report' });
  }
};

// ============================================
// 11) Expense Forecast
// ============================================
export const getExpenseForecastReport = async (req, res) => {
  try {
    // Forecast engine (industry standard baseline):
    // Use last up-to-3 months average of actual expenses (ex GST).
    // If only 1 month of data exists, base = last month expense.
    const { end } = getDateRangeFromQuery(req.query);

    const endMonthStart = startOfDay(new Date(end.getFullYear(), end.getMonth(), 1));
    const endMonthEnd = endOfDay(new Date(end.getFullYear(), end.getMonth() + 1, 0));

    const rangeStart = startOfDay(new Date(end.getFullYear(), end.getMonth() - 2, 1)); // last 3 months window
    const rangeEnd = endMonthEnd;

    const rows = await Expense.aggregate([
      {
        $match: {
          user: req.user._id,
          status: buildExpenseStatusMatch(req.query.expenseStatus),
          date: { $gte: rangeStart, $lte: rangeEnd },
        },
      },
      {
        $group: {
          _id: { year: { $year: '$date' }, month: { $month: '$date' } },
          total: { $sum: { $ifNull: ['$amountExclTax', 0] } }, // ex GST
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 3 },
    ]);

    // Total for the selected (end) month
    const lastMonthAgg = await Expense.aggregate([
      {
        $match: {
          user: req.user._id,
          status: buildExpenseStatusMatch(req.query.expenseStatus),
          date: { $gte: endMonthStart, $lte: endMonthEnd },
        },
      },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$amountExclTax', 0] } } } },
    ]);
    const lastMonthTotal = round2(lastMonthAgg?.[0]?.total || 0);

    const monthsWithData = rows.filter((r) => (Number(r?.total) || 0) > 0);
    const monthsUsed = monthsWithData.length > 0 ? monthsWithData.length : (lastMonthTotal > 0 ? 1 : 0);
    const avg3 =
      monthsWithData.length > 0
        ? round2(monthsWithData.reduce((s, r) => s + (Number(r.total) || 0), 0) / monthsWithData.length)
        : lastMonthTotal;

    const base = round2(avg3);
    const nextQuarterForecast = round2(base * 3);
    const aggressive = round2(base * 1.2);
    const conservative = round2(base * 0.9);

    res.json({
      windowStart: rangeStart.toISOString(),
      windowEnd: rangeEnd.toISOString(),
      lastMonthTotal,
      monthsUsed,
      nextMonthForecast: base,
      nextQuarterForecast,
      scenarios: { base, aggressive, conservative },
      method: 'last_3_month_avg_ex_gst',
    });
  } catch (error) {
    console.error('Error in Expense Forecast report:', error);
    res.status(500).json({ message: error.message || 'Failed to generate Expense Forecast report' });
  }
};

// ============================================
// 12) Revenue Forecast (expected MRR + churn + new sales)
// ============================================
export const getRevenueForecastReport = async (req, res) => {
  try {
    const { end } = getDateRangeFromQuery(req.query);
    const now = new Date();
    const churnRate = clampNumber(req.query.churnRate ?? 0.05, 0, 1, 0.05);
    const newSalesTarget = clampNumber(req.query.newSalesTarget ?? 0, 0, 1e12, 0);
    const growthRate = clampNumber(req.query.growthRate ?? 0.1, -0.9, 5, 0.1); // one-time growth scenario

    const rows = await RecurringInvoice.aggregate([
      {
        $match: {
          user: req.user._id,
          isActive: true,
          startOn: { $lte: now },
          $or: [{ neverExpires: true }, { endsOn: null }, { endsOn: { $gte: now } }],
        },
      },
      {
        $lookup: {
          from: 'invoices',
          localField: 'baseInvoice',
          foreignField: '_id',
          as: 'baseInvoiceDoc',
        },
      },
      { $unwind: '$baseInvoiceDoc' },
      {
        $addFields: {
          // Expected recurring revenue per month (ex GST) in INR
          baseInvoiceBaseInINR: invoiceBaseInINRExprFromDoc('baseInvoiceDoc'),
        },
      },
      {
        $addFields: {
          baseMonthlyInINR: {
            $switch: {
              branches: [
                { case: { $eq: ['$repeatEvery', 'Week'] }, then: { $multiply: ['$baseInvoiceBaseInINR', 4.33] } },
                { case: { $eq: ['$repeatEvery', 'Month'] }, then: '$baseInvoiceBaseInINR' },
                { case: { $eq: ['$repeatEvery', 'Quarter'] }, then: { $divide: ['$baseInvoiceBaseInINR', 3] } },
                { case: { $eq: ['$repeatEvery', 'Half Yearly'] }, then: { $divide: ['$baseInvoiceBaseInINR', 6] } },
                { case: { $eq: ['$repeatEvery', 'Six Month'] }, then: { $divide: ['$baseInvoiceBaseInINR', 6] } },
                { case: { $eq: ['$repeatEvery', 'Year'] }, then: { $divide: ['$baseInvoiceBaseInINR', 12] } },
              ],
              default: '$baseInvoiceBaseInINR',
            },
          },
        },
      },
      { $group: { _id: null, expectedMRR: { $sum: '$baseMonthlyInINR' } } },
    ]);

    const expectedMRR = round2(rows?.[0]?.expectedMRR || 0);
    const churnLoss = round2(expectedMRR * churnRate);
    const recurringExpected = round2(expectedMRR - churnLoss + newSalesTarget);

    // One-time fallback: if no recurring invoices exist, forecast from last month's actual revenue (ex GST).
    const endMonthStart = startOfDay(new Date(end.getFullYear(), end.getMonth(), 1));
    const endMonthEnd = endOfDay(new Date(end.getFullYear(), end.getMonth() + 1, 0));

    const lastMonthIncomeAgg = await Invoice.aggregate([
      {
        $match: {
          user: req.user._id,
          status: buildInvoiceStatusMatch(req.query.invoiceStatus),
          invoiceDate: { $gte: endMonthStart, $lte: endMonthEnd },
        },
      },
      { $addFields: { baseInINR: invoiceBaseInINRExpr() } },
      { $group: { _id: null, totalIncome: { $sum: '$baseInINR' } } },
    ]);
    const lastMonthRevenue = round2(lastMonthIncomeAgg?.[0]?.totalIncome || 0);
    const oneTimeForecast = round2(lastMonthRevenue * (1 + growthRate));

    // Merge recurring + one-time forecast (both can exist)
    const expectedRevenue = round2(recurringExpected + oneTimeForecast);

    res.json({
      expectedMRR,
      churnRate,
      churnLoss,
      newSalesTarget,
      growthRate,
      lastMonthRevenue,
      oneTimeForecast,
      expectedRevenue,
    });
  } catch (error) {
    console.error('Error in Revenue Forecast report:', error);
    res.status(500).json({ message: error.message || 'Failed to generate Revenue Forecast report' });
  }
};

// ============================================
// 13) GST / Tax Report (India)
// ============================================
export const getGstReport = async (req, res) => {
  try {
    const { start, end } = getDateRangeFromQuery(req.query);

    const [invoiceAgg, expenseAgg] = await Promise.all([
      Invoice.aggregate([
        {
          $match: {
            user: req.user._id,
            status: buildInvoiceStatusMatch(req.query.invoiceStatus),
            invoiceDate: { $gte: start, $lte: end },
          },
        },
        { $addFields: { gstInINR: invoiceGstInINRExpr() } },
        { $group: { _id: null, gstCollected: { $sum: '$gstInINR' } } },
      ]),
      Expense.aggregate([
        {
          $match: {
            user: req.user._id,
            status: buildExpenseStatusMatch(req.query.expenseStatus),
            date: { $gte: start, $lte: end },
          },
        },
        { $group: { _id: null, gstPaid: { $sum: { $ifNull: ['$gstAmount', 0] } } } },
      ]),
    ]);

    const gstCollected = round2(invoiceAgg?.[0]?.gstCollected || 0);
    const gstPaid = round2(expenseAgg?.[0]?.gstPaid || 0);
    const netGstPayable = round2(gstCollected - gstPaid);

    res.json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      gstCollected,
      gstPaid,
      netGstPayable,
    });
  } catch (error) {
    console.error('Error in GST report:', error);
    res.status(500).json({ message: error.message || 'Failed to generate GST report' });
  }
};

// ============================================
// 14) Payment Mode Report (Income)
// ============================================
export const getPaymentModeIncomeReport = async (req, res) => {
  try {
    const { start, end } = getDateRangeFromQuery(req.query);
    const rows = await Payment.aggregate([
      {
        $match: {
          user: req.user._id,
          status: 'Paid',
          paymentDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: { $ifNull: ['$paymentMode', 'Unknown'] },
          total: { $sum: { $ifNull: ['$amountReceived', 0] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    res.json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      byMode: rows.map((r) => ({ mode: r._id, total: round2(r.total), count: r.count })),
    });
  } catch (error) {
    console.error('Error in Payment Mode (Income) report:', error);
    res.status(500).json({ message: error.message || 'Failed to generate Payment Mode (Income) report' });
  }
};

// ============================================
// 15) Payment Mode Report (Expense)
// ============================================
export const getPaymentModeExpenseReport = async (req, res) => {
  try {
    const { start, end } = getDateRangeFromQuery(req.query);
    // Prefer paymentHistory (actual cash out dates). Fallback to paidAmount for paid expenses without history.
    const [historyRows, fallbackRows] = await Promise.all([
      Expense.aggregate([
        {
          $match: {
            user: req.user._id,
            status: buildExpenseStatusMatch(req.query.expenseStatus),
          },
        },
        { $unwind: '$paymentHistory' },
        {
          $match: {
            'paymentHistory.paymentDate': { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: { $ifNull: ['$paymentMode', 'Unknown'] },
            total: { $sum: { $ifNull: ['$paymentHistory.amountPaid', 0] } },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
      ]),
      Expense.aggregate([
        {
          $match: {
            user: req.user._id,
            status: 'Paid',
            date: { $gte: start, $lte: end },
            $or: [{ paymentHistory: { $exists: false } }, { paymentHistory: { $size: 0 } }],
          },
        },
        {
          $group: {
            _id: { $ifNull: ['$paymentMode', 'Unknown'] },
            total: { $sum: { $ifNull: ['$paidAmount', 0] } },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
      ]),
    ]);

    const merged = new Map();
    for (const r of historyRows) merged.set(r._id, { mode: r._id, total: round2(r.total), count: r.count });
    for (const r of fallbackRows) {
      const prev = merged.get(r._id) || { mode: r._id, total: 0, count: 0 };
      prev.total = round2((prev.total || 0) + (r.total || 0));
      prev.count = (prev.count || 0) + (r.count || 0);
      merged.set(r._id, prev);
    }
    const byMode = Array.from(merged.values()).sort((a, b) => (b.total || 0) - (a.total || 0));

    res.json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      byMode,
    });
  } catch (error) {
    console.error('Error in Payment Mode (Expense) report:', error);
    res.status(500).json({ message: error.message || 'Failed to generate Payment Mode (Expense) report' });
  }
};

// ============================================
// Extra: Expense Category Report (requested)
// ============================================
export const getExpenseCategoryReport = async (req, res) => {
  try {
    const { start, end } = getDateRangeFromQuery(req.query);
    const rows = await Expense.aggregate([
      {
        $match: {
          user: req.user._id,
          status: buildExpenseStatusMatch(req.query.expenseStatus),
          date: { $gte: start, $lte: end },
        },
      },
      { $group: { _id: { $ifNull: ['$category', 'Uncategorized'] }, total: { $sum: { $ifNull: ['$amountExclTax', 0] } } } },
      { $sort: { total: -1 } },
    ]);

    res.json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      byCategory: rows.map((r) => ({ category: r._id, total: round2(r.total) })),
    });
  } catch (error) {
    console.error('Error in Expense Category report:', error);
    res.status(500).json({ message: error.message || 'Failed to generate Expense Category report' });
  }
};

// ============================================
// Extra: Expense Category Excel export
// ============================================
export const getExpenseCategoryExcelReport = async (req, res) => {
  try {
    const { start, end } = getDateRangeFromQuery(req.query);

    const rows = await Expense.aggregate([
      {
        $match: {
          user: req.user._id,
          status: buildExpenseStatusMatch(req.query.expenseStatus),
          date: { $gte: start, $lte: end },
        },
      },
      { $group: { _id: { $ifNull: ['$category', 'Uncategorized'] }, total: { $sum: { $ifNull: ['$amountExclTax', 0] } } } },
      { $sort: { total: -1 } },
    ]);

    const totalExpense = rows.reduce((s, r) => s + (r.total || 0), 0);
    const exportRows = rows.map((r) => ({
      Category: r._id,
      'Total Expense (INR)': round2(r.total),
      'Share %': totalExpense > 0 ? round2(((r.total || 0) / totalExpense) * 100) : 0,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Expense Category');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    setDownloadHeaders(
      res,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'expense-category.xlsx'
    );
    res.send(buffer);
  } catch (error) {
    console.error('Error in Expense Category Excel export:', error);
    res.status(500).json({ message: error.message || 'Failed to export Expense Category Excel' });
  }
};

// ============================================
// Extra: Expense Category PDF export
// ============================================
export const getExpenseCategoryPdfReport = async (req, res) => {
  try {
    const { start, end } = getDateRangeFromQuery(req.query);

    const rows = await Expense.aggregate([
      {
        $match: {
          user: req.user._id,
          status: buildExpenseStatusMatch(req.query.expenseStatus),
          date: { $gte: start, $lte: end },
        },
      },
      { $group: { _id: { $ifNull: ['$category', 'Uncategorized'] }, total: { $sum: { $ifNull: ['$amountExclTax', 0] } } } },
      { $sort: { total: -1 } },
    ]);

    const totalExpense = rows.reduce((s, r) => s + (r.total || 0), 0);
    const sorted = rows.map((r) => ({ category: r._id, total: round2(r.total) })).sort((a, b) => b.total - a.total);

    // Keep pie readable: top 10 + Other
    const topN = 10;
    const top = sorted.slice(0, topN);
    const otherTotal = round2(sorted.slice(topN).reduce((s, r) => s + (r.total || 0), 0));
    const pieData = otherTotal > 0 ? [...top, { category: 'Other', total: otherTotal }] : top;

    const tableData = sorted.map((r) => ({
      ...r,
      pct: totalExpense > 0 ? round2((r.total / totalExpense) * 100) : 0,
    }));

    setDownloadHeaders(res, 'application/pdf', 'expense-category.pdf');
    const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 40, info: { Title: 'Expense Category Report' } });
    doc.pipe(res);

    // Header
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#0f172a').text('Expense Category Report', { align: 'center' });
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(10).fillColor('#64748b').text(
      `Period: ${start.toLocaleDateString('en-IN')} to ${end.toLocaleDateString('en-IN')}`,
      { align: 'center' }
    );
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, { align: 'center' });

    doc.moveDown(1.2);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text(`Total Expense (ex GST): ${fmtINR(totalExpense)}`);

    // Pie chart
    const chartX = 360;
    const chartY = 170;
    const r = 85;
    const cx = chartX + r;
    const cy = chartY + r;

    doc.roundedRect(335, 150, 220, 220, 12).fill('#ffffff').stroke('#e2e8f0');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('Distribution', 347, 162);

    let startAngle = -Math.PI / 2;
    pieData.forEach((d, idx) => {
      const share = totalExpense > 0 ? d.total / totalExpense : 0;
      const angle = share * Math.PI * 2;
      const endAngle = startAngle + angle;
      const color = REPORT_COLORS[idx % REPORT_COLORS.length];

      doc
        .moveTo(cx, cy)
        .lineTo(cx + r * Math.cos(startAngle), cy + r * Math.sin(startAngle))
        .arc(cx, cy, r, (startAngle * 180) / Math.PI, (endAngle * 180) / Math.PI)
        .lineTo(cx, cy)
        .fill(color);

      startAngle = endAngle;
    });
    doc.circle(cx, cy, r).stroke('#e2e8f0');

    // Legend
    let legY = 150 + 40;
    pieData.slice(0, 8).forEach((d, idx) => {
      const color = REPORT_COLORS[idx % REPORT_COLORS.length];
      const pct = totalExpense > 0 ? round2((d.total / totalExpense) * 100) : 0;
      doc.rect(347, legY + 3, 10, 10).fill(color);
      doc.fillColor('#334155').font('Helvetica').fontSize(9).text(
        `${String(d.category).slice(0, 18)}  (${pct}%)`,
        363,
        legY + 2,
        { width: 180 }
      );
      legY += 16;
    });

    // Table
    doc.y = 400;
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(12).text('Category Summary');
    doc.moveDown(0.6);

    const startX = doc.page.margins.left;
    const rowH = 18;
    const cols = [
      { label: 'Category', w: 255, align: 'left' },
      { label: 'Amount (INR)', w: 130, align: 'right' },
      { label: 'Share %', w: 130, align: 'right' },
    ];

    const drawHeader = () => {
      const y = doc.y;
      doc.rect(startX, y, 515, rowH).fill('#0f172a');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
      let x = startX;
      cols.forEach((c) => {
        doc.text(c.label, x + 8, y + 5, { width: c.w - 16, align: c.align });
        x += c.w;
      });
      doc.y = y + rowH;
      doc.fillColor('#0f172a').font('Helvetica').fontSize(9);
    };

    const ensureSpace = (needed) => {
      const bottom = doc.page.height - doc.page.margins.bottom;
      if (doc.y + needed > bottom) {
        doc.addPage();
        drawHeader();
      }
    };

    drawHeader();
    tableData.forEach((r, idx) => {
      ensureSpace(rowH + 6);
      const y = doc.y;
      doc.rect(startX, y, 515, rowH).fill(idx % 2 === 0 ? '#f8fafc' : '#ffffff').stroke('#e2e8f0');
      let x = startX;
      doc.fillColor('#0f172a').text(String(r.category), x + 8, y + 5, { width: cols[0].w - 16 });
      x += cols[0].w;
      doc.text(fmtINR(r.total), x + 8, y + 5, { width: cols[1].w - 16, align: 'right' });
      x += cols[1].w;
      doc.text(`${fmtINR(r.pct)}%`, x + 8, y + 5, { width: cols[2].w - 16, align: 'right' });
      doc.y = y + rowH;
    });

    doc.end();
  } catch (error) {
    console.error('Error in Expense Category PDF export:', error);
    res.status(500).json({ message: error.message || 'Failed to export Expense Category PDF' });
  }
};

// ============================================
// 16) Outstanding Summary (Receivable / Payable)
// ============================================
export const getOutstandingSummaryReport = async (req, res) => {
  try {
    const { start, end } = getDateRangeFromQuery(req.query);

    const receivableAgg = await Invoice.aggregate([
      {
        $match: {
          user: req.user._id,
          status: { $in: ['Unpaid', 'Partial'] },
          invoiceDate: { $gte: start, $lte: end },
        },
      },
      {
        $addFields: {
          totalInINR: invoiceAmountInINRExpr(),
          paidInINR: { $ifNull: ['$paidAmount', 0] }, // stored in INR by payment flow
          dueInINRStored: { $ifNull: ['$dueAmount', 0] }, // reporting-standard (INR)
        },
      },
      {
        $addFields: {
          dueInINR: {
            $cond: [
              { $gt: ['$dueInINRStored', 0] },
              '$dueInINRStored',
              { $max: [0, { $subtract: ['$totalInINR', '$paidInINR'] }] },
            ],
          },
        },
      },
      { $group: { _id: null, totalReceivable: { $sum: '$dueInINR' }, count: { $sum: 1 } } },
    ]);

    const payableAgg = await Expense.aggregate([
      {
        $match: {
          user: req.user._id,
          status: { $in: ['Unpaid', 'Partial'] },
          date: { $gte: start, $lte: end },
        },
      },
      {
        $addFields: {
          total: { $ifNull: ['$totalAmount', 0] },
          paid: { $ifNull: ['$paidAmount', 0] },
          due: { $max: [0, { $subtract: [{ $ifNull: ['$totalAmount', 0] }, { $ifNull: ['$paidAmount', 0] }] }] },
        },
      },
      { $group: { _id: null, totalPayable: { $sum: '$due' }, count: { $sum: 1 } } },
    ]);

    res.json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      receivable: {
        total: round2(receivableAgg?.[0]?.totalReceivable || 0),
        count: receivableAgg?.[0]?.count || 0,
      },
      payable: {
        total: round2(payableAgg?.[0]?.totalPayable || 0),
        count: payableAgg?.[0]?.count || 0,
      },
    });
  } catch (error) {
    console.error('Error in Outstanding Summary report:', error);
    res.status(500).json({ message: error.message || 'Failed to generate Outstanding Summary report' });
  }
};

// ============================================
// 17) Top Clients (by revenue)
// ============================================
export const getTopClientsReport = async (req, res) => {
  try {
    const { start, end } = getDateRangeFromQuery(req.query);
    const topN = clampNumber(req.query.top ?? 5, 1, 50, 5);

    const rows = await Invoice.aggregate([
      {
        $match: {
          user: req.user._id,
          status: buildInvoiceStatusMatch(req.query.invoiceStatus),
          invoiceDate: { $gte: start, $lte: end },
        },
      },
      { $addFields: { baseInINR: invoiceBaseInINRExpr(), client: { $ifNull: ['$clientDetails.name', 'Unknown'] } } },
      { $group: { _id: '$client', total: { $sum: '$baseInINR' } } },
      { $sort: { total: -1 } },
    ]);

    const totalAll = rows.reduce((s, r) => s + (r.total || 0), 0);
    const top = rows.slice(0, topN).map((r) => ({
      client: r._id,
      total: round2(r.total),
      contributionPct: totalAll > 0 ? round2((r.total / totalAll) * 100) : 0,
    }));

    res.json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      totalRevenue: round2(totalAll),
      top,
    });
  } catch (error) {
    console.error('Error in Top Clients report:', error);
    res.status(500).json({ message: error.message || 'Failed to generate Top Clients report' });
  }
};

// ============================================
// 18) Top Expense Categories
// ============================================
export const getTopExpenseCategoriesReport = async (req, res) => {
  try {
    const { start, end } = getDateRangeFromQuery(req.query);
    const topN = clampNumber(req.query.top ?? 5, 1, 50, 5);

    const rows = await Expense.aggregate([
      {
        $match: {
          user: req.user._id,
          status: buildExpenseStatusMatch(req.query.expenseStatus),
          date: { $gte: start, $lte: end },
        },
      },
      { $group: { _id: { $ifNull: ['$category', 'Uncategorized'] }, total: { $sum: { $ifNull: ['$amountExclTax', 0] } } } },
      { $sort: { total: -1 } },
    ]);

    const totalAll = rows.reduce((s, r) => s + (r.total || 0), 0);
    const top = rows.slice(0, topN).map((r) => ({
      category: r._id,
      total: round2(r.total),
      contributionPct: totalAll > 0 ? round2((r.total / totalAll) * 100) : 0,
    }));

    res.json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      totalExpenses: round2(totalAll),
      top,
    });
  } catch (error) {
    console.error('Error in Top Expense Categories report:', error);
    res.status(500).json({ message: error.message || 'Failed to generate Top Expense Categories report' });
  }
};

// ============================================
// 19) Collection Efficiency (Avg days, on-time%, late%)
// ============================================
export const getCollectionEfficiencyReport = async (req, res) => {
  try {
    const { start, end } = getDateRangeFromQuery(req.query);

    // Paid invoices in period (by invoiceDate), excluding cancellations
    const invoices = await Invoice.find({
      user: req.user._id,
      status: 'Paid',
      invoiceDate: { $gte: start, $lte: end },
    })
      .select('_id invoiceDate dueDate')
      .lean();

    if (invoices.length === 0) {
      return res.json({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        paidInvoiceCount: 0,
        avgCollectionDays: 0,
        paidOnTimePct: 0,
        latePaymentPct: 0,
      });
    }

    const ids = invoices.map((i) => i._id);
    const paymentAgg = await Payment.aggregate([
      { $match: { user: req.user._id, invoice: { $in: ids }, status: 'Paid' } },
      { $group: { _id: '$invoice', lastPaymentDate: { $max: '$paymentDate' } } },
    ]);
    const lastPayMap = new Map(paymentAgg.map((p) => [String(p._id), p.lastPaymentDate]));

    let sumDays = 0;
    let counted = 0;
    let onTime = 0;
    let late = 0;

    for (const inv of invoices) {
      const lastPay = lastPayMap.get(String(inv._id));
      if (!lastPay) continue;
      const invDate = new Date(inv.invoiceDate);
      const lastPayDate = new Date(lastPay);
      const days = Math.max(0, Math.round((lastPayDate - invDate) / (1000 * 60 * 60 * 24)));
      sumDays += days;
      counted += 1;

      const due = inv.dueDate ? new Date(inv.dueDate) : null;
      if (due && lastPayDate <= due) onTime += 1;
      else late += 1;
    }

    const avgCollectionDays = counted > 0 ? round2(sumDays / counted) : 0;
    const paidOnTimePct = counted > 0 ? round2((onTime / counted) * 100) : 0;
    const latePaymentPct = counted > 0 ? round2((late / counted) * 100) : 0;

    res.json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      paidInvoiceCount: counted,
      avgCollectionDays,
      paidOnTimePct,
      latePaymentPct,
    });
  } catch (error) {
    console.error('Error in Collection Efficiency report:', error);
    res.status(500).json({ message: error.message || 'Failed to generate Collection Efficiency report' });
  }
};

// ============================================
// 20) Cash Flow (collections vs expense payments)
// Note: opening balance not available in current schema; allow override.
// ============================================
export const getCashFlowReport = async (req, res) => {
  try {
    const { start, end } = getDateRangeFromQuery(req.query);
    const openingBalance = clampNumber(req.query.openingBalance ?? 0, -1e15, 1e15, 0);

    const cashInAgg = await Payment.aggregate([
      { $match: { user: req.user._id, status: 'Paid', paymentDate: { $gte: start, $lte: end } } },
      { $group: { _id: null, cashIn: { $sum: { $ifNull: ['$amountReceived', 0] } } } },
    ]);
    const cashIn = round2(cashInAgg?.[0]?.cashIn || 0);

    // Cash out from expense payment history (accurate). Fallback: if no history, use paidAmount on Paid expenses.
    const cashOutFromHistory = await Expense.aggregate([
      {
        $match: {
          user: req.user._id,
          status: buildExpenseStatusMatch(req.query.expenseStatus),
        },
      },
      { $unwind: { path: '$paymentHistory', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          $or: [
            { 'paymentHistory.paymentDate': { $gte: start, $lte: end } },
            { paymentHistory: null },
          ],
        },
      },
      {
        $group: {
          _id: null,
          cashOutHistory: { $sum: { $ifNull: ['$paymentHistory.amountPaid', 0] } },
        },
      },
    ]);
    const cashOutHistory = round2(cashOutFromHistory?.[0]?.cashOutHistory || 0);

    const cashOutFallbackAgg = await Expense.aggregate([
      {
        $match: {
          user: req.user._id,
          status: 'Paid',
          date: { $gte: start, $lte: end },
        },
      },
      { $group: { _id: null, cashOutFallback: { $sum: { $ifNull: ['$paidAmount', 0] } } } },
    ]);
    const cashOutFallback = round2(cashOutFallbackAgg?.[0]?.cashOutFallback || 0);

    // Prefer history; if zero and fallback has value, use fallback.
    const cashOut = cashOutHistory > 0 ? cashOutHistory : cashOutFallback;
    const netCashFlow = round2(cashIn - cashOut);
    const closingBalance = round2(openingBalance + netCashFlow);

    res.json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      openingBalance,
      cashIn,
      cashOut,
      netCashFlow,
      closingBalance,
      note:
        'Opening balance is not stored in BankAccount yet. Pass ?openingBalance=... to set the opening balance for this report.',
    });
  } catch (error) {
    console.error('Error in Cash Flow report:', error);
    res.status(500).json({ message: error.message || 'Failed to generate Cash Flow report' });
  }
};

