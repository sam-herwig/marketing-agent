#!/bin/bash

echo "Setting up Marketing Automation Platform..."

# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Generate secrets
NEXTAUTH_SECRET=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)
WEBHOOK_SECRET=$(openssl rand -base64 32)

# Update .env files with generated secrets
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/your-nextauth-secret-here/$NEXTAUTH_SECRET/g" frontend/.env
    sed -i '' "s/your-secret-key-here/$JWT_SECRET/g" backend/.env
    sed -i '' "s/webhook-secret-key/$WEBHOOK_SECRET/g" backend/.env
else
    # Linux
    sed -i "s/your-nextauth-secret-here/$NEXTAUTH_SECRET/g" frontend/.env
    sed -i "s/your-secret-key-here/$JWT_SECRET/g" backend/.env
    sed -i "s/webhook-secret-key/$WEBHOOK_SECRET/g" backend/.env
fi

echo "Environment files created with secure secrets!"
echo ""
echo "To start the application:"
echo "  docker-compose up -d"
echo ""
echo "Services will be available at:"
echo "  - Frontend: http://localhost:3000"
echo "  - Backend API: http://localhost:8000"
echo "  - n8n: http://localhost:5678 (admin/admin123)"
echo ""
echo "First time setup:"
echo "  1. Visit http://localhost:3000/register to create an account"
echo "  2. Login at http://localhost:3000/login"
echo "  3. Access your dashboard at http://localhost:3000/dashboard"