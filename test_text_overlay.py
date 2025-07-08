#!/usr/bin/env python3
"""Test script for text overlay functionality"""

import requests
import json
import base64
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000"
USERNAME = "testuser"
PASSWORD = "testpass123"

def login():
    """Login and get access token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login/username",
        json={"username": USERNAME, "password": PASSWORD}
    )
    if response.status_code == 200:
        data = response.json()
        return data["access_token"]
    else:
        print(f"Login failed: {response.status_code} - {response.text}")
        return None

def test_text_overlay(token):
    """Test text overlay API"""
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test with a placeholder image
    test_data = {
        "image_url": "https://via.placeholder.com/1024x1024/7C3AED/FFFFFF?text=Test",
        "text_overlays": [
            {
                "text": "SUMMER SALE",
                "position": [512, 200],
                "font_size": 72,
                "font_color": "#FFFFFF",
                "font_style": "bold",
                "alignment": "center",
                "shadow": True,
                "shadow_color": "#000000",
                "shadow_offset": [3, 3],
                "outline": False,
                "outline_color": "#000000",
                "outline_width": 2,
                "background_box": False,
                "background_color": "#000000",
                "background_opacity": 128
            },
            {
                "text": "Up to 50% off everything",
                "position": [512, 350],
                "font_size": 36,
                "font_color": "#EEEEEE",
                "font_style": "regular",
                "alignment": "center",
                "shadow": False,
                "shadow_color": "#000000",
                "shadow_offset": [2, 2],
                "outline": False,
                "outline_color": "#000000",
                "outline_width": 2,
                "background_box": False,
                "background_color": "#000000",
                "background_opacity": 128
            },
            {
                "text": "SHOP NOW",
                "position": [512, 850],
                "font_size": 48,
                "font_color": "#FFFFFF",
                "font_style": "bold",
                "alignment": "center",
                "shadow": False,
                "shadow_color": "#000000",
                "shadow_offset": [2, 2],
                "outline": False,
                "outline_color": "#000000",
                "outline_width": 2,
                "background_box": True,
                "background_color": "#FF0000",
                "background_opacity": 200
            }
        ]
    }
    
    print("Testing text overlay API...")
    response = requests.post(
        f"{BASE_URL}/api/images/text-overlay",
        headers=headers,
        json=test_data
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✓ Text overlay API successful!")
        
        # Save the image
        if "image_data" in data:
            # Remove data:image/png;base64, prefix
            image_data = data["image_data"].split(",")[1]
            image_bytes = base64.b64decode(image_data)
            
            filename = f"text_overlay_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            with open(filename, "wb") as f:
                f.write(image_bytes)
            print(f"✓ Image saved as {filename}")
        
        return True
    else:
        print(f"✗ Text overlay API failed: {response.status_code}")
        print(f"Response: {response.text}")
        return False

def test_marketing_text(token):
    """Test marketing text overlay API"""
    headers = {"Authorization": f"Bearer {token}"}
    
    test_data = {
        "image_url": "https://via.placeholder.com/1024x1024/4B5563/FFFFFF?text=Product",
        "headline": "NEW ARRIVAL",
        "subtext": "Limited Edition Collection",
        "cta": "BUY NOW"
    }
    
    print("\nTesting marketing text overlay API...")
    response = requests.post(
        f"{BASE_URL}/api/images/text-overlay/marketing",
        headers=headers,
        json=test_data
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✓ Marketing text overlay API successful!")
        
        # Save the image
        if "image_data" in data:
            image_data = data["image_data"].split(",")[1]
            image_bytes = base64.b64decode(image_data)
            
            filename = f"marketing_text_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            with open(filename, "wb") as f:
                f.write(image_bytes)
            print(f"✓ Image saved as {filename}")
        
        return True
    else:
        print(f"✗ Marketing text overlay API failed: {response.status_code}")
        print(f"Response: {response.text}")
        return False

def main():
    """Run all tests"""
    print("Text Overlay API Test")
    print("=" * 50)
    
    # Login
    print("Logging in...")
    token = login()
    if not token:
        print("✗ Failed to login")
        return
    
    print("✓ Login successful")
    
    # Test text overlay
    if test_text_overlay(token):
        print("\n✓ Text overlay test passed!")
    else:
        print("\n✗ Text overlay test failed!")
    
    # Test marketing text
    if test_marketing_text(token):
        print("\n✓ Marketing text test passed!")
    else:
        print("\n✗ Marketing text test failed!")

if __name__ == "__main__":
    main()