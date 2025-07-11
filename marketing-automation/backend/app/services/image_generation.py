import httpx
import base64
from typing import Optional, Dict, Tuple, List
from app.core.config import settings
from app.services.text_overlay import text_overlay_service, TextConfig

class ImageGenerationService:
    def __init__(self):
        self.openai_api_key = settings.OPENAI_API_KEY or ""
        self.replicate_api_key = settings.REPLICATE_API_KEY or ""
    
    def split_prompt(self, input_text: str) -> Tuple[str, str]:
        """Split input into background and text prompts"""
        # Default text styling to append
        text_style = "Bold white sans-serif font, centered"
        
        # Simple heuristic: if input is short (< 50 chars), it's likely just text
        if len(input_text.strip()) < 50 and not any(word in input_text.lower() for word in ['background', 'scene', 'with', 'featuring', 'showing']):
            # Generate a contextual background based on the text
            text_content = input_text.strip()
            
            # Smart background generation based on keywords
            if any(word in text_content.lower() for word in ['summer', 'beach', 'vacation', 'sun']):
                background = "Vibrant summer beach scene with golden sand, clear blue ocean, and tropical atmosphere"
            elif any(word in text_content.lower() for word in ['winter', 'snow', 'cold', 'christmas', 'holiday']):
                background = "Cozy winter scene with snow-covered landscape and warm lighting"
            elif any(word in text_content.lower() for word in ['sale', 'discount', 'offer', 'deal']):
                background = "Modern retail environment with dynamic geometric shapes and bright colors"
            elif any(word in text_content.lower() for word in ['new', 'launch', 'coming soon', 'announcement']):
                background = "Futuristic abstract background with light streaks and innovative feel"
            else:
                background = "Professional gradient background with subtle geometric patterns"
            
            text_prompt = f"{text_content}. {text_style}"
            return (background, text_prompt)
        else:
            # For longer inputs, assume it already contains both background and text description
            # Try to intelligently split it
            return (input_text, text_style)
    
    def combine_prompts(self, background_prompt: str, text_prompt: str) -> str:
        """Combine background and text prompts into a single prompt"""
        return f"{background_prompt}. Text overlay: {text_prompt}"
        
    async def generate_image(self, prompt: str, provider: str = "openai") -> Optional[str]:
        """Generate an image from a text prompt"""
        
        if provider == "openai" and self.openai_api_key:
            result = await self._generate_openai(prompt)
            if result:
                return result
            # If OpenAI fails, fallback to placeholder
            print("OpenAI generation failed, using placeholder")
            return await self._generate_placeholder(prompt)
        elif provider == "replicate" and self.replicate_api_key:
            result = await self._generate_replicate(prompt)
            if result:
                return result
            return await self._generate_placeholder(prompt)
        else:
            # Fallback to placeholder service
            return await self._generate_placeholder(prompt)
    
    async def generate_image_with_split_prompts(self, background_prompt: str, text_prompt: str, provider: str = "openai") -> Optional[str]:
        """Generate an image using split prompts for background and text"""
        # Combine the prompts
        combined_prompt = self.combine_prompts(background_prompt, text_prompt)
        
        # Generate using the combined prompt
        return await self.generate_image(combined_prompt, provider)
    
    async def _generate_openai(self, prompt: str) -> Optional[str]:
        """Generate image using OpenAI DALL-E 2"""
        async with httpx.AsyncClient() as client:
            try:
                # First try DALL-E 2 which is more stable
                response = await client.post(
                    "https://api.openai.com/v1/images/generations",
                    headers={
                        "Authorization": f"Bearer {self.openai_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "prompt": prompt,
                        "n": 1,
                        "size": "1024x1024"
                    },
                    timeout=60.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return data["data"][0]["url"]
                else:
                    try:
                        error_data = response.json()
                        error_obj = error_data.get("error", {})
                        error_msg = error_obj.get("message", "Unknown error")
                        error_type = error_obj.get("type", "")
                        error_code = error_obj.get("code", "")
                        
                        if error_type == "image_generation_user_error" and not error_msg:
                            error_msg = "Image generation failed. This usually means the API key doesn't have access to DALL-E or the account has exceeded its usage quota."
                        
                        print(f"OpenAI error ({response.status_code}):")
                        print(f"  Message: {error_msg}")
                        print(f"  Type: {error_type}")
                        print(f"  Code: {error_code}")
                    except:
                        print(f"OpenAI error ({response.status_code}): {response.text}")
                    return None
                    
            except Exception as e:
                print(f"Error generating image with OpenAI: {e}")
                return None
    
    async def _generate_openai_dalle2(self, prompt: str) -> Optional[str]:
        """Generate image using OpenAI DALL-E 2 as fallback"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    "https://api.openai.com/v1/images/generations",
                    headers={
                        "Authorization": f"Bearer {self.openai_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "dall-e-2",
                        "prompt": prompt,
                        "n": 1,
                        "size": "1024x1024"
                    },
                    timeout=60.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return data["data"][0]["url"]
                else:
                    print(f"OpenAI DALL-E 2 error: {response.status_code} - {response.text}")
                    return None
                    
            except Exception as e:
                print(f"Error generating image with OpenAI DALL-E 2: {e}")
                return None
    
    async def _generate_replicate(self, prompt: str) -> Optional[str]:
        """Generate image using Replicate (Stable Diffusion)"""
        async with httpx.AsyncClient() as client:
            try:
                # Create prediction
                response = await client.post(
                    "https://api.replicate.com/v1/predictions",
                    headers={
                        "Authorization": f"Token {self.replicate_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "version": "stability-ai/stable-diffusion:27b93a2413e",
                        "input": {
                            "prompt": prompt,
                            "width": 1024,
                            "height": 1024
                        }
                    }
                )
                
                if response.status_code == 201:
                    prediction = response.json()
                    prediction_id = prediction["id"]
                    
                    # Poll for result
                    for _ in range(60):  # Max 60 seconds
                        await httpx.AsyncClient().sleep(1)
                        
                        result = await client.get(
                            f"https://api.replicate.com/v1/predictions/{prediction_id}",
                            headers={"Authorization": f"Token {self.replicate_api_key}"}
                        )
                        
                        if result.status_code == 200:
                            data = result.json()
                            if data["status"] == "succeeded":
                                return data["output"][0]
                            elif data["status"] == "failed":
                                return None
                                
                return None
                
            except Exception as e:
                print(f"Error generating image with Replicate: {e}")
                return None
    
    async def _generate_placeholder(self, prompt: str) -> str:
        """Generate a placeholder image URL"""
        # Use a placeholder service or return a default image
        encoded_prompt = prompt.replace(" ", "+")
        return f"https://via.placeholder.com/1024x1024/7C3AED/FFFFFF?text={encoded_prompt[:50]}"
    
    async def save_image_url(self, image_url: str, campaign_id: int) -> str:
        """Save image URL for a campaign"""
        # In production, you might want to download and store the image
        # For now, we'll just return the URL
        return image_url
    
    async def generate_with_text_overlay(self, 
                                       background_prompt: str,
                                       text_overlays: List[Dict],
                                       provider: str = "openai") -> Optional[str]:
        """
        Generate an image and apply text overlay
        
        Args:
            background_prompt: Prompt for the background image (no text)
            text_overlays: List of text overlay configurations
            provider: Image generation provider to use
            
        Returns:
            Base64 encoded image data URL or None if failed
        """
        try:
            # Generate base image without text
            clean_prompt = background_prompt.replace("text:", "").replace("with text", "")
            clean_prompt += ". No text or letters in the image."
            
            image_url = await self.generate_image(clean_prompt, provider)
            if not image_url:
                return None
            
            # Convert text overlay dicts to TextConfig objects
            text_configs = []
            for overlay in text_overlays:
                config = TextConfig(
                    text=overlay.get("text", ""),
                    position=tuple(overlay.get("position", (512, 512))),
                    font_size=overlay.get("font_size", 48),
                    font_color=overlay.get("font_color", "#FFFFFF"),
                    font_style=overlay.get("font_style", "bold"),
                    alignment=overlay.get("alignment", "center"),
                    shadow=overlay.get("shadow", True),
                    shadow_color=overlay.get("shadow_color", "#000000"),
                    shadow_offset=tuple(overlay.get("shadow_offset", (2, 2))),
                    outline=overlay.get("outline", False),
                    outline_color=overlay.get("outline_color", "#000000"),
                    outline_width=overlay.get("outline_width", 2),
                    background_box=overlay.get("background_box", False),
                    background_color=overlay.get("background_color", "#000000"),
                    background_opacity=overlay.get("background_opacity", 128)
                )
                text_configs.append(config)
            
            # Apply text overlay
            processed_image = text_overlay_service.add_text_overlay(image_url, text_configs)
            
            # Convert to base64 data URL
            import base64
            base64_image = base64.b64encode(processed_image).decode('utf-8')
            return f"data:image/png;base64,{base64_image}"
            
        except Exception as e:
            print(f"Error generating image with text overlay: {e}")
            return None
    
    async def generate_marketing_image(self,
                                     background_description: str,
                                     headline: str,
                                     subtext: Optional[str] = None,
                                     cta: Optional[str] = None,
                                     provider: str = "openai") -> Optional[str]:
        """
        Generate a marketing image with text overlay
        
        Args:
            background_description: Description of the background scene
            headline: Main headline text
            subtext: Optional subtitle
            cta: Optional call-to-action
            provider: Image generation provider
            
        Returns:
            Base64 encoded image data URL or None if failed
        """
        try:
            # Generate background image
            image_url = await self.generate_image(background_description + ". No text.", provider)
            if not image_url:
                return None
            
            # Apply marketing text layout
            processed_image = text_overlay_service.add_marketing_text(
                image_url,
                headline,
                subtext,
                cta
            )
            
            # Convert to base64 data URL
            import base64
            base64_image = base64.b64encode(processed_image).decode('utf-8')
            return f"data:image/png;base64,{base64_image}"
            
        except Exception as e:
            print(f"Error generating marketing image: {e}")
            return None

image_service = ImageGenerationService()