# HSN/SAC Code Setup Guide

This guide explains how to set up and use the HSN/SAC code feature in the Invoice Expense system.

## Features

- ✅ Preloaded common HSN/SAC codes for service and IT businesses
- ✅ Searchable dropdown in invoice items
- ✅ Auto-apply GST rate when HSN/SAC is selected
- ✅ Admin can add custom HSN/SAC codes
- ✅ Search functionality to find codes quickly

## Initial Setup

### 1. Seed Common HSN/SAC Codes

Run the seed script to populate the database with common codes:

```bash
cd backend
npm run seed:hsn-sac
```

This will add 25 common codes including:
- **SAC Codes (Services)**: Management Consulting, IT Services, Digital Marketing, etc. (18% GST)
- **HSN Codes (Goods)**: Computers, Software, Office Furniture, etc. (0-18% GST)

### 2. Verify Codes are Loaded

After running the seed script, you should see:
```
✅ Seeding completed!
   Inserted: 25 codes
   Skipped: 0 codes (already exist)
   Total: 25 codes
```

## Using HSN/SAC Codes in Invoices

### In Invoice Form

1. **Create or Edit an Invoice**
2. **In the Item Table**, find the HSN/SAC field below each item description
3. **Type or select** an HSN/SAC code:
   - Start typing the code (e.g., "9983") or description (e.g., "IT Consulting")
   - A dropdown will show matching codes
   - Select a code from the dropdown
4. **GST Rate Auto-Applied**: When you select an HSN/SAC code, the GST percentage will automatically be applied to the invoice

### Example Codes

**Common SAC Codes (Services):**
- `998311` - Management Consulting (18% GST)
- `998313` - IT Consulting / Software Services (18% GST)
- `998362` - Digital Marketing Services (18% GST)

**Common HSN Codes (Goods):**
- `847130` - Computers / Laptops (18% GST)
- `852380` - Software on media (18% GST)
- `490110` - Books / Printed Material (0% GST)

## Adding Custom HSN/SAC Codes

### Via API (For Admins)

You can add custom HSN/SAC codes via the API:

```javascript
POST /api/hsn-sac
{
  "code": "998399",
  "description": "Custom Service Description",
  "gstRate": 18,
  "type": "SAC"  // or "HSN"
}
```

### Features of Custom Codes

- Custom codes are user-specific (only visible to the user who created them)
- Common codes are visible to all users
- Custom codes can be edited or deleted by the creator
- Common codes cannot be modified or deleted

## API Endpoints

- `GET /api/hsn-sac` - Get all codes (common + user's custom)
- `GET /api/hsn-sac?search=it` - Search codes
- `GET /api/hsn-sac?type=SAC` - Filter by type
- `POST /api/hsn-sac` - Create custom code
- `PUT /api/hsn-sac/:id` - Update custom code
- `DELETE /api/hsn-sac/:id` - Delete custom code

## Notes

- The system preloads only common codes used by service and IT businesses
- All codes are stored in the database (not preloaded on every request)
- Search is performed on both code and description fields
- GST rate is automatically applied when a code is selected in the invoice form
