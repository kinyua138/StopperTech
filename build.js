const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
const frontendDir = path.join(__dirname, 'frontend');

// 1. Create dist directory, removing old one if it exists
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// 2. Copy all files from frontend to dist
const copyRecursiveSync = (src, dest) => {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
};

copyRecursiveSync(frontendDir, distDir);

// 3. Rename stopper.html to index.html
const oldPath = path.join(distDir, 'stopper.html');
const newPath = path.join(distDir, 'index.html');
if (fs.existsSync(oldPath)) {
  fs.renameSync(oldPath, newPath);
}

console.log('Frontend build successful. Files are in the dist directory.');
