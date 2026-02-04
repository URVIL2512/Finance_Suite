import { format } from 'date-fns';
import ExcelJS from 'exceljs';

// Export expenses to Excel
export const exportExpensesToExcel = async (expenses, filters = {}) => {
  try {
    // Organize expenses by month, category, and department
    const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Group by month
    const byMonth = {};
    expenses.forEach((expense) => {
      const month = expense.month || 'Unknown';
      if (!byMonth[month]) {
        byMonth[month] = [];
      }
      byMonth[month].push(expense);
    });

    // Group by category
    const byCategory = {};
    expenses.forEach((expense) => {
      const category = expense.category || 'Unknown';
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      byCategory[category].push(expense);
    });

    // Group by department
    const byDepartment = {};
    expenses.forEach((expense) => {
      const dept = expense.department || 'Unknown';
      if (!byDepartment[dept]) {
        byDepartment[dept] = [];
      }
      byDepartment[dept].push(expense);
    });

    const workbook = new ExcelJS.Workbook();

    // Define column headers
    const headers = [
      'Date', 'Category', 'Department', 'Vendor/Party', 'Description',
      'Payment Mode', 'Bank Account', 'Amount (Excl. Tax)', 'GST %', 'GST Amount',
      'TDS %', 'TDS Amount', 'Total Amount', 'Paid Amount', 'Due Amount',
      'Transaction Ref', 'Executive', 'Created By', 'Edited By',
      'User Name', 'User Email', 'User Phone'
    ];

    // Define column widths
    const columnWidths = [
      12, 15, 15, 20, 30,
      15, 15, 18, 10, 15,
      10, 15, 15, 15, 15,
      20, 15, 15, 15,
      15, 25, 15
    ];

    // Helper function to create a worksheet with styled headers
    const createWorksheet = (worksheet, expenseList, sheetName) => {
      // Set column widths
      headers.forEach((header, index) => {
        worksheet.getColumn(index + 1).width = columnWidths[index];
      });

      // Define header style
      const headerStyle = {
        font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4472C4' } // Blue background
        },
        alignment: { horizontal: 'left', vertical: 'middle' },
        border: {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        }
      };

      // Add headers
      const headerRow = worksheet.addRow(headers);
      headerRow.eachCell((cell, colNumber) => {
        cell.style = headerStyle;
      });
      headerRow.height = 20;

      // Add data rows
      expenseList.forEach((expense) => {
        const dueAmount = (expense.totalAmount || 0) - (expense.paidAmount || 0);
        const row = worksheet.addRow([
          expense.date ? format(new Date(expense.date), 'dd/MM/yyyy') : '',
          expense.category || '',
          expense.department || '',
          expense.vendor || '',
          expense.description || '',
          expense.paymentMode || '',
          expense.bankAccount || '',
          expense.amountExclTax || 0,
          expense.gstPercentage || 0,
          expense.gstAmount || 0,
          expense.tdsPercentage || 0,
          expense.tdsAmount || 0,
          expense.totalAmount || 0,
          expense.paidAmount || 0,
          dueAmount,
          expense.paidTransactionRef || '',
          expense.executive || '',
          expense.createdBy || '',
          expense.editedBy || '',
          expense.userName || '',
          expense.userEmail || '',
          expense.userPhone || '',
        ]);

        // Style data rows
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
          };
        });
      });
    };

    // Create All Expenses sheet
    const allWorksheet = workbook.addWorksheet('All Expenses');
    createWorksheet(allWorksheet, expenses, 'All Expenses');

    // Create Month-wise sheets
    monthOrder.forEach((month) => {
      if (byMonth[month] && byMonth[month].length > 0) {
        const monthWorksheet = workbook.addWorksheet(month);
        createWorksheet(monthWorksheet, byMonth[month], month);
      }
    });

    // Create Category-wise sheets
    Object.keys(byCategory).sort().forEach((category) => {
      if (byCategory[category].length > 0) {
        const sheetName = category.length > 31 ? category.substring(0, 31) : category;
        const categoryWorksheet = workbook.addWorksheet(sheetName);
        createWorksheet(categoryWorksheet, byCategory[category], sheetName);
      }
    });

    // Create Department-wise sheets
    Object.keys(byDepartment).sort().forEach((dept) => {
      if (byDepartment[dept].length > 0) {
        const sheetName = dept.length > 31 ? dept.substring(0, 31) : dept;
        const deptWorksheet = workbook.addWorksheet(sheetName);
        createWorksheet(deptWorksheet, byDepartment[dept], sheetName);
      }
    });

    // Generate Excel file buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // Download file
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const filterStr = [
      filters.month ? filters.month : '',
      filters.category ? filters.category : '',
      filters.department ? filters.department : '',
    ].filter(Boolean).join('_');
    link.download = `expenses${filterStr ? '_' + filterStr : ''}_${dateStr}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    alert('Error exporting to Excel. Please make sure the exceljs library is installed.');
  }
};

// Legacy function for backward compatibility
export const exportExpensesToExcelOld = (expenses) => {
  try {
    // Prepare data for Excel
    const excelData = expenses.map((expense) => {
      const dueAmount = (expense.totalAmount || 0) - (expense.paidAmount || 0);
      return {
        'Date': expense.date ? format(new Date(expense.date), 'dd/MM/yyyy') : '',
        'Category': expense.category || '',
        'Department': expense.department || '',
        'Vendor/Party': expense.vendor || '',
        'Description': expense.description || '',
        'Payment Mode': expense.paymentMode || '',
        'Bank Account': expense.bankAccount || '',
        'Amount (Excl. Tax)': expense.amountExclTax || 0,
        'GST %': expense.gstPercentage || 0,
        'GST Amount': expense.gstAmount || 0,
        'TDS %': expense.tdsPercentage || 0,
        'TDS Amount': expense.tdsAmount || 0,
        'Total Amount': expense.totalAmount || 0,
        'Paid Amount': expense.paidAmount || 0,
        'Due Amount': dueAmount,
        'Transaction Ref': expense.paidTransactionRef || '',
        'Executive': expense.executive || '',
        'Created By': expense.createdBy || '',
        'Edited By': expense.editedBy || '',
        'User Name': expense.userName || '',
        'User Email': expense.userEmail || '',
        'User Phone': expense.userPhone || '',
      };
    });

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');

    // Set column widths
    const columnWidths = [
      { wch: 12 }, // Date
      { wch: 15 }, // Category
      { wch: 15 }, // Department
      { wch: 20 }, // Vendor/Party
      { wch: 30 }, // Description
      { wch: 15 }, // Payment Mode
      { wch: 15 }, // Bank Account
      { wch: 18 }, // Amount (Excl. Tax)
      { wch: 10 }, // GST %
      { wch: 15 }, // GST Amount
      { wch: 10 }, // TDS %
      { wch: 15 }, // TDS Amount
      { wch: 15 }, // Total Amount
      { wch: 15 }, // Paid Amount
      { wch: 15 }, // Due Amount
      { wch: 20 }, // Transaction Ref
      { wch: 15 }, // Executive
      { wch: 15 }, // Created By
      { wch: 15 }, // Edited By
      { wch: 15 }, // User Name
      { wch: 25 }, // User Email
      { wch: 15 }, // User Phone
    ];
    worksheet['!cols'] = columnWidths;

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // Download file
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    link.download = `expenses_${dateStr}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    alert('Error exporting to Excel. Please make sure the xlsx library is installed.');
  }
};

// Export expenses to PDF (calls backend endpoint)
export const exportExpensesToPDF = async (expenses, getAuthToken, filters = {}) => {
  try {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const token = getAuthToken();
    
    const response = await fetch(`${API_URL}/expenses/export/pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ expenses, filters }),
    });

    if (response.ok) {
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      const filterStr = [
        filters.month ? filters.month : '',
        filters.category ? filters.category : '',
        filters.department ? filters.department : '',
        filters.year ? filters.year : '',
      ].filter(Boolean).join('_');
      link.download = `expenses${filterStr ? '_' + filterStr : ''}_${dateStr}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } else {
      const error = await response.json();
      throw new Error(error.message || 'Failed to generate PDF');
    }
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    alert('Error exporting to PDF: ' + (error.message || 'Unknown error'));
  }
};
