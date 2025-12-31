#!/bin/bash

# Quick Start Guide for ischkul-azure
# Run this to get up and running locally in 5 minutes

set -e

echo "=========================================="
echo "ischkul-azure: Quick Start Setup"
echo "=========================================="
echo ""

# Check prerequisites
echo "Checking prerequisites..."
command -v node >/dev/null 2>&1 || { echo "❌ Node.js required. Install from nodejs.org"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm required"; exit 1; }
command -v git >/dev/null 2>&1 || { echo "❌ git required"; exit 1; }
echo "✓ Prerequisites OK"
echo ""

# Install backend
echo "Installing backend dependencies..."
cd backend
npm install
cd ..
echo "✓ Backend dependencies installed"
echo ""

# Install frontend
echo "Installing frontend dependencies..."
cd frontend
npm install
cd ..
echo "✓ Frontend dependencies installed"
echo ""

# Setup environment files
echo "Setting up environment files..."
if [ ! -f "backend/.env" ]; then
  cp backend/.env.example backend/.env
  echo "⚠️  Created backend/.env - fill in Azure credentials"
else
  echo "✓ backend/.env exists"
fi
echo ""

# Summary
echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""
echo "Next Steps:"
echo ""
echo "1. Fill in Azure credentials:"
echo "   nano backend/.env"
echo ""
echo "2. Start backend (Terminal 1):"
echo "   cd backend && npm run dev:functions"
echo ""
echo "3. Start frontend (Terminal 2):"
echo "   cd frontend && npm run dev"
echo ""
echo "4. Open browser:"
echo "   http://localhost:5173"
echo ""
echo "5. Test API endpoints:"
echo "   See docs/API_TESTING.md for curl/Postman examples"
echo ""
echo "Documentation:"
echo "  - ARCHITECTURE.md:     System design & features"
echo "  - SCHEMAS.md:          Database schema & queries"
echo "  - IMAGINECUP_CHECKLIST.md: Competition compliance"
echo "  - SECURITY.md:         Security implementation"
echo "  - API_TESTING.md:      API endpoint examples"
echo ""
