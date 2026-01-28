/**
 * One-time script to promote a user to admin by email.
 * Run from backend folder: node scripts/promoteAdmin.js <email>
 * Example: node scripts/promoteAdmin.js your@email.com
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';

dotenv.config();

const email = process.argv[2];
if (!email || !email.includes('@')) {
  console.error('Usage: node scripts/promoteAdmin.js <email>');
  console.error('Example: node scripts/promoteAdmin.js your@email.com');
  process.exit(1);
}

async function run() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not set in .env');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    const u = await User.findOneAndUpdate(
      { email: email.trim().toLowerCase() },
      { $set: { role: 'admin', status: 'active' } },
      { new: true }
    );
    if (!u) {
      console.error('No user found with email:', email);
      process.exit(1);
    }
    console.log('Done. User promoted to admin:', u.email || u.name);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

run();
