/**
 * Excel Export Utilities
 * 
 * Provides functionality to export data to Excel format
 * Uses SheetJS (xlsx) library for Excel generation
 */

/**
 * Convert JSON data to Excel and trigger download
 * @param {Array} data - Array of objects to export
 * @param {string} filename - Name of the file (without extension)
 * @param {string} sheetName - Name of the Excel sheet
 */
export const exportToExcel = (data, filename = 'export', sheetName = 'Sheet1') => {
  try {
    // Dynamically import xlsx to avoid bundle size issues
    import('xlsx').then((XLSX) => {
      // Create a new workbook
      const workbook = XLSX.utils.book_new();
      
      // Convert JSON to worksheet
      const worksheet = XLSX.utils.json_to_sheet(data);
      
      // Auto-size columns based on content
      const columnWidths = [];
      if (data.length > 0) {
        // Get all column names
        const columns = Object.keys(data[0]);
        
        columns.forEach((col, index) => {
          // Find the maximum width for this column
          let maxWidth = col.length; // Start with header length
          
          data.forEach(row => {
            const cellValue = String(row[col] || '');
            maxWidth = Math.max(maxWidth, cellValue.length);
          });
          
          // Set reasonable limits (min 10, max 50 characters)
          columnWidths[index] = { wch: Math.min(Math.max(maxWidth, 10), 50) };
        });
        
        worksheet['!cols'] = columnWidths;
      }
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      
      // Generate Excel file and trigger download
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log(`✅ Excel export completed: ${filename}.xlsx`);
    }).catch((error) => {
      console.error('❌ Error loading xlsx library:', error);
      throw new Error('Failed to load Excel export library');
    });
  } catch (error) {
    console.error('❌ Error exporting to Excel:', error);
    throw error;
  }
};

/**
 * Export customers data to Excel with proper formatting
 * @param {Array} customers - Array of customer objects
 * @param {string} filename - Optional filename
 */
export const exportCustomersToExcel = (customers, filename) => {
  const timestamp = new Date().toISOString().split('T')[0];
  const defaultFilename = filename || `customers_export_${timestamp}`;
  
  exportToExcel(customers, defaultFilename, 'Customers');
};

/**
 * Format data for Excel export by cleaning and structuring it
 * @param {Array} rawData - Raw data array
 * @param {Object} columnMapping - Optional column name mapping
 * @returns {Array} Formatted data ready for Excel export
 */
export const formatDataForExcel = (rawData, columnMapping = {}) => {
  if (!Array.isArray(rawData) || rawData.length === 0) {
    return [];
  }
  
  return rawData.map((item, index) => {
    const formattedItem = {};
    
    Object.keys(item).forEach(key => {
      // Use mapped column name if available, otherwise use original key
      const columnName = columnMapping[key] || key;
      let value = item[key];
      
      // Handle different data types
      if (value === null || value === undefined) {
        value = '';
      } else if (typeof value === 'object') {
        // Convert objects to string representation
        if (value instanceof Date) {
          value = value.toLocaleDateString('en-IN');
        } else {
          value = JSON.stringify(value);
        }
      } else if (typeof value === 'boolean') {
        value = value ? 'Yes' : 'No';
      }
      
      formattedItem[columnName] = value;
    });
    
    return formattedItem;
  });
};

/**
 * Check if xlsx library is available
 * @returns {Promise<boolean>} True if xlsx is available
 */
export const isExcelExportAvailable = async () => {
  try {
    await import('xlsx');
    return true;
  } catch (error) {
    console.warn('xlsx library not available for Excel export');
    return false;
  }
};

/**
 * Install xlsx library instructions
 */
export const getExcelLibraryInstallInstructions = () => {
  return {
    message: 'Excel export requires the xlsx library',
    instructions: 'Run: npm install xlsx',
    fallback: 'You can copy the data and paste it into Excel manually'
  };
};