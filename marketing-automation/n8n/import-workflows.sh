#!/bin/bash

echo "Importing n8n workflows..."

# Base64 encode credentials for basic auth
AUTH=$(echo -n "admin:admin123" | base64)

# Instagram workflow
echo "Importing Instagram workflow..."
curl -X POST http://localhost:5678/api/v1/workflows \
  -H "Authorization: Basic $AUTH" \
  -H "Content-Type: application/json" \
  -d @workflows/instagram-post.json

echo ""
echo "Importing Stripe workflow..."
# Stripe workflow
curl -X POST http://localhost:5678/api/v1/workflows \
  -H "Authorization: Basic $AUTH" \
  -H "Content-Type: application/json" \
  -d @workflows/stripe-discount.json

echo ""
echo "Workflows imported successfully!"
echo "Please activate them in the n8n UI at http://localhost:5678"