# PDF Template Setup Guide

## Overview
The invoice PDF generation now uses your template PDF (`KVPL106.pdf`) and overlays the invoice data at specific positions. You need to configure the coordinates in `backend/utils/pdfTemplateConfig.js` to match your template layout.

## How It Works
1. The system loads your template PDF
2. It overlays invoice data (invoice number, dates, client details, items, totals) at configured positions
3. Only the dynamic data is changed - the template design remains intact

## Configuration Steps

### 1. Open the Configuration File
Edit: `backend/utils/pdfTemplateConfig.js`

### 2. Understand Coordinates
- PDF coordinates use **points** (1 point = 1/72 inch)
- Origin (0,0) is at the **bottom-left** corner
- A4 page: width = 595.28 points, height = 841.89 points
- Y-axis increases upward (unlike screen coordinates)

### 3. Find Field Positions in Your Template

You can use a PDF viewer with measurement tools, or:

**Method 1: Use Adobe Acrobat**
1. Open your template PDF in Adobe Acrobat
2. Use Tools > Measure > Distance Tool
3. Measure from bottom-left corner to each field

**Method 2: Use Online Tools**
- Upload your PDF to a PDF coordinate finder tool
- Or use a PDF editor that shows coordinates

**Method 3: Trial and Error**
1. Start with approximate positions
2. Generate a test invoice
3. Check the output PDF
4. Adjust coordinates in the config file
5. Repeat until positions match

### 4. Configure Each Field

Update the coordinates in `pdfTemplateConfig.js`:

```javascript
invoiceNumber: {
  x: 400,        // Distance from left edge
  y: 750,        // Distance from bottom
  fontSize: 12,
  font: 'bold',
},
```

### 5. Common Fields to Configure

- **Invoice Number** - Usually top-right
- **Invoice Date** - Usually near invoice number
- **Due Date** - Usually below invoice date
- **Balance Due** - Usually prominent, top-right
- **Client Name** - Usually left side, below company info
- **Client Address** - Usually below client name
- **Client Country/State/GSTIN** - Usually below address
- **Items Table** - Usually middle section
  - Configure column positions (number, description, HSN/SAC, quantity, rate, amount)
- **Totals Section** - Usually bottom-right
  - Sub Total, GST (CGST/SGST or IGST), TDS, Remittance, Total, Balance Due
- **Total in Words** - Usually below totals
- **Notes** - Usually bottom-left

### 6. Test and Adjust

1. Generate a test invoice
2. Open the generated PDF
3. Check if data appears in correct positions
4. Adjust coordinates in config file
5. Regenerate and check again

## Example Configuration

```javascript
// Top Right - Invoice Details
invoiceNumber: {
  x: 400,  // Adjust based on your template
  y: 750,  // Adjust based on your template
  fontSize: 12,
  font: 'bold',
},

// Left Side - Client Details
clientName: {
  x: 50,
  y: 700,
  fontSize: 12,
  font: 'bold',
},
```

## Tips

1. **Start with one field** - Configure invoice number first, test it, then move to others
2. **Use consistent spacing** - If fields are 15 points apart, use that for similar fields
3. **Account for text width** - Some fields may need `maxWidth` to prevent overflow
4. **Test with real data** - Use actual invoice data to see how it looks
5. **Save your config** - Keep a backup of working coordinates

## Troubleshooting

**Data not appearing?**
- Check if coordinates are within page bounds (0 to 595 width, 0 to 841 height)
- Verify template path is correct
- Check console for errors

**Data in wrong position?**
- Adjust x (left-right) and y (bottom-top) coordinates
- Remember: y increases upward from bottom

**Text cut off?**
- Increase `maxWidth` for that field
- Or adjust x coordinate to give more space

**Font size too large/small?**
- Adjust `fontSize` in config

## Need Help?

If you can share:
1. A screenshot of your template with field positions marked
2. Or a list of approximate positions (e.g., "Invoice number is top-right, about 400px from left, 750px from bottom")

I can help configure the coordinates more precisely.
