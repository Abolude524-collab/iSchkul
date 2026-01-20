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
let fixedCount = 0;

walkDir(srcDir, (filePath) => {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  
  // Pattern: `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/register`
  // Replace with: getAPIEndpoint('/auth/register')
  
  // Regex to match: `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/XXX`
  const pattern = /`\$\{import\.meta\.env\.VITE_API_URL \|\| 'http:\/\/localhost:5000'\}\/api\/([^`]+)`/g;
  
  content = content.replace(pattern, (match, endpoint) => {
    return `getAPIEndpoint('/${endpoint}')`;
  });
  
  if (content !== originalContent) {
    // Add import if needed
    if (content.includes('getAPIEndpoint')) {
      // Find all import statements from ../services/api
      if (content.match(/import\s*{([^}]*?)}\s*from\s*['"]\.\.\/services\/api['"]/)) {
        if (!content.includes('getAPIEndpoint')) {
          content = content.replace(
            /import\s*{([^}]*?)}\s*from\s*['"]\.\.\/services\/api['"]/,
            (match, imports) => {
              if (imports.includes('getAPIEndpoint')) {
                return match;
              }
              return `import { ${imports.trim()}, getAPIEndpoint } from '../services/api'`;
            }
          );
        }
      } else if (content.match(/import\s*{([^}]*?)}\s*from\s*['"]\.\.\/\.\.\/services\/api['"]/)) {
        if (!content.includes('getAPIEndpoint')) {
          content = content.replace(
            /import\s*{([^}]*?)}\s*from\s*['"]\.\.\/\.\.\/services\/api['"]/,
            (match, imports) => {
              if (imports.includes('getAPIEndpoint')) {
                return match;
              }
              return `import { ${imports.trim()}, getAPIEndpoint } from '../../services/api'`;
            }
          );
        }
      }
    }
    
    fs.writeFileSync(filePath, content, 'utf-8');
    fixedCount++;
    console.log(`✅ Fixed: ${path.relative(process.cwd(), filePath)}`);
  }
});

console.log(`\nTotal files fixed: ${fixedCount}`);
