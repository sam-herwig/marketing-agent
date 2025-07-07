#!/usr/bin/env python3
import asyncio
import httpx
import os

async def test_openai_api():
    # Get API key from environment
    api_key = os.getenv('OPENAI_API_KEY', '').strip('"')
    
    if not api_key:
        print("❌ No API key found in environment")
        return
    
    print(f"Testing API key: {api_key[:20]}...")
    
    async with httpx.AsyncClient() as client:
        # Test 1: Check if API key is valid
        print("\n1. Testing API key validity...")
        try:
            response = await client.get(
                'https://api.openai.com/v1/models',
                headers={'Authorization': f'Bearer {api_key}'}
            )
            
            if response.status_code == 401:
                print("❌ API key is invalid or expired")
                print(f"Error: {response.text}")
                return
            elif response.status_code == 200:
                print("✅ API key is valid")
            else:
                print(f"Unexpected status: {response.status_code}")
                print(response.text)
        except Exception as e:
            print(f"Error testing API key: {e}")
            return
        
        # Test 2: Try DALL-E 2
        print("\n2. Testing DALL-E 2 image generation...")
        try:
            response = await client.post(
                'https://api.openai.com/v1/images/generations',
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json'
                },
                json={
                    'model': 'dall-e-2',
                    'prompt': 'A simple red circle on white background',
                    'n': 1,
                    'size': '256x256'
                },
                timeout=30.0
            )
            
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                image_url = data['data'][0]['url']
                print(f"✅ Success! Image generated")
                print(f"Image URL: {image_url[:50]}...")
            else:
                print("❌ Failed to generate image")
                print(f"Response: {response.text}")
                
        except Exception as e:
            print(f"Error generating image: {e}")

if __name__ == "__main__":
    asyncio.run(test_openai_api())