# Logo Setup Instructions

## Required Logo File

To display the Kology logo in PDF documents (invoices, payment receipts, etc.), you need to add the logo file to this directory.

### Steps:

1. Download the Kology logo from: `https://www.kology.co/wp-content/uploads/2025/02/logo.png`
2. Save it as `logo.png` in this directory (`backend/assets/images/logo.png`)
3. Ensure the file is a PNG format with transparent background for best results

### File Requirements:

- **Filename**: `logo.png` (exact name required)
- **Format**: PNG (recommended for transparency)
- **Location**: `backend/assets/images/logo.png`
- **Recommended size**: 300x125 pixels or similar aspect ratio

### Fallback Behavior:

If the logo file is not found, the PDF generators will automatically fall back to displaying "Kology" as text with the tagline "Connect. Communicate. Collaborate".

### Affected PDF Documents:

- Invoice PDFs
- Payment Receipt PDFs  
- Payment History PDFs
- Expense PDFs (if applicable)

Once you add the logo file, it will automatically be used in all deployed environments including Render and Vercel.