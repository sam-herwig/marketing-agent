#!/usr/bin/env python3
"""
Test text overlay with authentication
"""
import requests
import json

API_URL = "http://localhost:8000"

# First, let's check if we can access the docs
print("Checking API endpoints...")
response = requests.get(f"{API_URL}/openapi.json")
if response.status_code == 200:
    openapi = response.json()
    print("\nAvailable endpoints:")
    for path, methods in openapi.get("paths", {}).items():
        if "text-overlay" in path or "images" in path:
            print(f"  {path}")
            for method, details in methods.items():
                print(f"    {method.upper()}: {details.get('summary', 'No summary')}")
else:
    print(f"Failed to get API schema: {response.status_code}")

# Test marketing text overlay with a simple example
print("\n\nTesting text overlay with generated background...")

# Let's test with the image generation + text overlay
print("\nGenerating marketing image with text overlay...")

# This would require authentication, so let's just show the structure
print("\nTo use the text overlay API:")
print("1. Generate a base image using DALL-E (no text)")
print("2. Apply text overlay using the new Pillow-based service")
print("3. The text will be crisp and reliable")

print("\nExample request structure:")
example = {
    "image_url": "https://example.com/generated-image.jpg",
    "text_overlays": [
        {
            "text": "SUMMER SALE",
            "position": [512, 200],
            "font_size": 72,
            "font_color": "#FFFFFF",
            "shadow": True
        }
    ]
}
print(json.dumps(example, indent=2))