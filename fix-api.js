#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (!['node_modules', 'dist', '.git'].includes(file)) {
        walkDir(filePath, callback);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      callback(filePath);
    }
  });
}

const srcDir = path.join(__dirname, 'frontend/src');

walkDir(srcDir, (filePath) => {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  
  // Replace all instances of ${import.meta.env.VITE_API_URL || 'http://localhost:5000'} with getAPIEndpoint('
  content = content.replace(
    /\$\{import\.meta\.env\.VITE_API_URL \|\| 'http:\/\/localhost:5000'\}\/api\//g,
    "getAPIEndpoint('/"
  );
  
  // For Socket.io, keep the fallback pattern but ensure it works
  // io(import.meta.env.VITE_API_URL || 'http://localhost:5000')
  // This should stay as-is since io() needs different handling
  
  // Add import if file was modified and doesn't have import
  if (content !== originalContent) {
    // Check if file imports from api
    if (!content.includes("import { ") && !content.includes('import ')) {
      // No imports, skip
    } else if (!content.includes('getAPIEndpoint')) {
      // Need to add import
      const apiImportMatch = content.match(/import\s*\{\s*([^}]*?)\s*\}\s*from\s*['"]\.\.\/services\/api['"]/);
      if (apiImportMatch) {
        const currentImports = apiImportMatch[1];
        if (!currentImports.includes('getAPIEndpoint')) {
          content = content.replace(
            /import\s*\{\s*([^}]*?)\s*\}\s*from\s*['"]\.\.\/services\/api['"]/,
            `import { $1, getAPIEndpoint } from '../services/api'`
          );
        }
      }
    }
    
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ Fixed: ${filePath}`);
  }
});

console.log('Done!');
