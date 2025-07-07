#!/usr/bin/env python3
import asyncio
import os
import sys
from app.services.image_generation import ImageGenerationService
from app.core.config import settings

async def test_image_generation():
    # Check for API key
    if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY == "your-openai-api-key-here":
        print("❌ Please set a valid OPENAI_API_KEY environment variable")
        print("   Example: export OPENAI_API_KEY='sk-...'")
        return
    
    print(f"✅ Found OpenAI API key: {settings.OPENAI_API_KEY[:20]}...")
    
    # Initialize the service
    service = ImageGenerationService()
    
    # Test 1: Simple prompt
    print("\n1. Testing simple prompt generation...")
    try:
        image_url = await service.generate_image(
            prompt="A professional marketing banner with blue gradient background",
            provider="openai"
        )
        if image_url:
            print(f"✅ Image generated successfully!")
            print(f"   URL: {image_url}")
        else:
            print("❌ Failed to generate image")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test 2: Split prompts
    print("\n2. Testing split prompt generation...")
    try:
        image_url = await service.generate_image_with_split_prompts(
            background_prompt="Modern office workspace with laptop",
            text_prompt="Marketing Campaign Success",
            provider="openai"
        )
        if image_url:
            print(f"✅ Image with split prompts generated successfully!")
            print(f"   URL: {image_url}")
        else:
            print("❌ Failed to generate image with split prompts")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test 3: Fallback to Replicate
    if settings.REPLICATE_API_KEY:
        print("\n3. Testing Replicate fallback...")
        try:
            image_url = await service.generate_image(
                prompt="Futuristic marketing dashboard interface",
                provider="replicate"
            )
            if image_url:
                print(f"✅ Replicate image generated successfully!")
                print(f"   URL: {image_url}")
            else:
                print("❌ Failed to generate image with Replicate")
        except Exception as e:
            print(f"❌ Error: {e}")
    else:
        print("\n3. Skipping Replicate test (no API key set)")

if __name__ == "__main__":
    asyncio.run(test_image_generation())