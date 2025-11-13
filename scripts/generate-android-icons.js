const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Android icon sizes for different densities
const iconSizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

const sourceImage = path.join(__dirname, '../AppIcon.jpg');
const androidResPath = path.join(__dirname, '../android/app/src/main/res');

async function generateIcons() {
  try {
    // Check if source image exists
    if (!fs.existsSync(sourceImage)) {
      console.error(`Error: Source image not found at ${sourceImage}`);
      process.exit(1);
    }

    console.log('Generating Android app icons from AppIcon.jpg...\n');
    console.log('Generating WebP versions (Android prefers WebP for smaller file sizes)...\n');

    // Generate WebP icons for each density (Android supports WebP and it's more efficient)
    for (const [folder, size] of Object.entries(iconSizes)) {
      const folderPath = path.join(androidResPath, folder);
      
      // Ensure folder exists
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      // Remove any existing PNG files to avoid conflicts
      const existingPng = path.join(folderPath, 'ic_launcher.png');
      const existingRoundPng = path.join(folderPath, 'ic_launcher_round.png');
      if (fs.existsSync(existingPng)) {
        fs.unlinkSync(existingPng);
      }
      if (fs.existsSync(existingRoundPng)) {
        fs.unlinkSync(existingRoundPng);
      }

      // Generate regular WebP icon
      const regularWebPPath = path.join(folderPath, 'ic_launcher.webp');
      await sharp(sourceImage)
        .resize(size, size, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 100 })
        .toFile(regularWebPPath);
      console.log(`✓ Generated ${folder}/ic_launcher.webp (${size}x${size})`);

      // Generate round WebP icon
      const roundWebPPath = path.join(folderPath, 'ic_launcher_round.webp');
      await sharp(sourceImage)
        .resize(size, size, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 100 })
        .toFile(roundWebPPath);
      console.log(`✓ Generated ${folder}/ic_launcher_round.webp (${size}x${size})`);
    }

    console.log('\n✅ All Android app icons generated successfully!');
    console.log('\nNote: The AndroidManifest.xml is already configured to use these icons.');
    console.log('You may need to rebuild your Android app for the changes to take effect.');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();

