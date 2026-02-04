#!/usr/bin/env node

/**
 * Logo Setup Script
 * Downloads the Kology logo and places it in the correct location for PDF generation
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGO_URL = 'https://www.kology.co/wp-content/uploads/2025/02/logo.png';
const LOGO_PATH = path.join(__dirname, '..', 'assets', 'images', 'logo.png');

/**
 * Download file from URL
 */
const downloadFile = (url, destination) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(destination, () => {}); // Delete partial file
        reject(err);
      });
    }).on('error', reject);
  });
};

/**
 * Main setup function
 */
async function setupLogo() {
  try {
    console.log('🚀 Setting up Kology logo for PDF generation...');
    
    // Ensure assets/images directory exists
    const assetsDir = path.dirname(LOGO_PATH);
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
      console.log('📁 Created assets/images directory');
    }
    
    // Check if logo already exists
    if (fs.existsSync(LOGO_PATH)) {
      console.log('✅ Logo file already exists at:', LOGO_PATH);
      console.log('🎉 Logo setup complete!');
      return;
    }
    
    // Download logo
    console.log('⬇️  Downloading logo from:', LOGO_URL);
    await downloadFile(LOGO_URL, LOGO_PATH);
    
    // Verify file was created
    if (fs.existsSync(LOGO_PATH)) {
      const stats = fs.statSync(LOGO_PATH);
      console.log(`✅ Logo downloaded successfully! (${stats.size} bytes)`);
      console.log('📍 Saved to:', LOGO_PATH);
      console.log('🎉 Logo setup complete!');
      console.log('');
      console.log('📄 The logo will now appear in all PDF documents instead of text fallback.');
    } else {
      throw new Error('Logo file was not created');
    }
    
  } catch (error) {
    console.error('❌ Error setting up logo:', error.message);
    console.log('');
    console.log('📝 Manual setup instructions:');
    console.log('1. Download logo from:', LOGO_URL);
    console.log('2. Save as:', LOGO_PATH);
    console.log('3. Ensure the file is a PNG format');
    process.exit(1);
  }
}

// Run setup
setupLogo();