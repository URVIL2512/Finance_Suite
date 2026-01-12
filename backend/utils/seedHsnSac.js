import mongoose from 'mongoose';
import dotenv from 'dotenv';
import HsnSac from '../models/HsnSac.js';

dotenv.config();

// Common HSN/SAC codes for service and IT businesses
const commonCodes = [
  // SAC Codes (Services)
  { code: '998311', description: 'Management Consulting', gstRate: 18, type: 'SAC' },
  { code: '998312', description: 'Business Consulting', gstRate: 18, type: 'SAC' },
  { code: '998313', description: 'IT Consulting / Software Services', gstRate: 18, type: 'SAC' },
  { code: '998314', description: 'Information Technology Services', gstRate: 18, type: 'SAC' },
  { code: '998315', description: 'Data Processing Services', gstRate: 18, type: 'SAC' },
  { code: '998316', description: 'Hosting / Cloud Services', gstRate: 18, type: 'SAC' },
  { code: '998319', description: 'Other IT & Consulting Services', gstRate: 18, type: 'SAC' },
  { code: '998361', description: 'Advertising Services', gstRate: 18, type: 'SAC' },
  { code: '998362', description: 'Digital Marketing Services', gstRate: 18, type: 'SAC' },
  { code: '998363', description: 'Public Relations Services', gstRate: 18, type: 'SAC' },
  { code: '998365', description: 'Market Research Services', gstRate: 18, type: 'SAC' },
  { code: '998399', description: 'Other Professional Services', gstRate: 18, type: 'SAC' },
  { code: '998431', description: 'Internet / Online Services', gstRate: 18, type: 'SAC' },
  { code: '998439', description: 'Telecom Related Services', gstRate: 18, type: 'SAC' },
  { code: '998599', description: 'Other Support Services', gstRate: 18, type: 'SAC' },
  { code: '999799', description: 'Other Miscellaneous Services', gstRate: 18, type: 'SAC' },
  
  // HSN Codes (Goods)
  { code: '847130', description: 'Computers / Laptops', gstRate: 18, type: 'HSN' },
  { code: '847150', description: 'Servers / Processing Units', gstRate: 18, type: 'HSN' },
  { code: '852380', description: 'Software on media', gstRate: 18, type: 'HSN' },
  { code: '851762', description: 'Networking Equipment', gstRate: 18, type: 'HSN' },
  { code: '940330', description: 'Office Furniture', gstRate: 18, type: 'HSN' },
  { code: '844331', description: 'Printers', gstRate: 18, type: 'HSN' },
  { code: '847160', description: 'Input/Output Devices', gstRate: 18, type: 'HSN' },
  { code: '481710', description: 'Printed Invoices / Stationery', gstRate: 12, type: 'HSN' },
  { code: '490110', description: 'Books / Printed Material', gstRate: 0, type: 'HSN' },
];

const seedHsnSac = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected for seeding');

    // Clear existing common codes (optional - comment out if you want to keep existing)
    // await HsnSac.deleteMany({ isCommon: true });
    // console.log('Cleared existing common codes');

    // Check which codes already exist
    const existingCodes = await HsnSac.find({ isCommon: true }).select('code');
    const existingCodeSet = new Set(existingCodes.map(c => c.code));

    // Insert only new codes
    let inserted = 0;
    let skipped = 0;

    for (const codeData of commonCodes) {
      if (!existingCodeSet.has(codeData.code)) {
        await HsnSac.create({
          ...codeData,
          isCommon: true,
          user: null,
        });
        inserted++;
        console.log(`✓ Inserted: ${codeData.code} - ${codeData.description}`);
      } else {
        skipped++;
        console.log(`⊘ Skipped (already exists): ${codeData.code} - ${codeData.description}`);
      }
    }

    console.log(`\n✅ Seeding completed!`);
    console.log(`   Inserted: ${inserted} codes`);
    console.log(`   Skipped: ${skipped} codes (already exist)`);
    console.log(`   Total: ${commonCodes.length} codes`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding HSN/SAC codes:', error);
    process.exit(1);
  }
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedHsnSac();
}

export default seedHsnSac;
