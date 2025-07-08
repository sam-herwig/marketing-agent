from PIL import Image, ImageDraw, ImageFont
import io
import requests
from typing import Optional, Tuple, List, Dict
import logging
from dataclasses import dataclass
import base64

logger = logging.getLogger(__name__)

@dataclass
class TextConfig:
    """Configuration for text overlay"""
    text: str
    position: Tuple[int, int] = (50, 50)  # x, y coordinates
    font_size: int = 48
    font_color: str = "#FFFFFF"  # White
    font_style: str = "bold"  # regular, bold
    alignment: str = "left"  # left, center, right
    shadow: bool = True
    shadow_color: str = "#000000"  # Black
    shadow_offset: Tuple[int, int] = (2, 2)
    outline: bool = False
    outline_color: str = "#000000"
    outline_width: int = 2
    background_box: bool = False
    background_color: str = "#000000"
    background_opacity: int = 128  # 0-255

class TextOverlayService:
    """Service for adding text overlays to images"""
    
    # Default font paths - will use system fonts
    FONTS = {
        'regular': 'DejaVuSans.ttf',
        'bold': 'DejaVuSans-Bold.ttf',
        'liberation': 'LiberationSans-Regular.ttf',
        'liberation_bold': 'LiberationSans-Bold.ttf'
    }
    
    def __init__(self):
        self.font_cache = {}
    
    def _get_font(self, font_style: str, size: int) -> ImageFont:
        """Get font object, with caching"""
        cache_key = f"{font_style}_{size}"
        
        if cache_key in self.font_cache:
            return self.font_cache[cache_key]
        
        # Try to load system fonts
        font_paths = [
            f"/usr/share/fonts/truetype/dejavu/{self.FONTS.get(font_style, 'DejaVuSans.ttf')}",
            f"/usr/share/fonts/truetype/liberation/{self.FONTS.get(font_style, 'LiberationSans-Regular.ttf')}",
            f"/app/assets/fonts/{font_style}.ttf",  # Custom fonts if added
        ]
        
        font = None
        for path in font_paths:
            try:
                font = ImageFont.truetype(path, size)
                break
            except:
                continue
        
        # Fallback to default font
        if not font:
            logger.warning(f"Could not load font {font_style}, using default")
            font = ImageFont.load_default()
        
        self.font_cache[cache_key] = font
        return font
    
    def _download_image(self, image_url: str) -> Image.Image:
        """Download image from URL"""
        try:
            response = requests.get(image_url, timeout=30)
            response.raise_for_status()
            return Image.open(io.BytesIO(response.content)).convert("RGBA")
        except Exception as e:
            logger.error(f"Failed to download image from {image_url}: {str(e)}")
            raise
    
    def _parse_color(self, color: str, opacity: int = 255) -> Tuple[int, int, int, int]:
        """Parse color string to RGBA tuple"""
        if color.startswith("#"):
            # Convert hex to RGB
            color = color.lstrip("#")
            if len(color) == 3:
                color = "".join([c*2 for c in color])
            r, g, b = int(color[0:2], 16), int(color[2:4], 16), int(color[4:6], 16)
            return (r, g, b, opacity)
        return (255, 255, 255, opacity)  # Default white
    
    def _get_text_dimensions(self, text: str, font: ImageFont) -> Tuple[int, int]:
        """Get text width and height"""
        # Create temporary image to measure text
        temp_img = Image.new('RGBA', (1, 1))
        draw = ImageDraw.Draw(temp_img)
        bbox = draw.textbbox((0, 0), text, font=font)
        return bbox[2] - bbox[0], bbox[3] - bbox[1]
    
    def _calculate_position(self, 
                          text: str, 
                          font: ImageFont, 
                          image_size: Tuple[int, int], 
                          position: Tuple[int, int], 
                          alignment: str) -> Tuple[int, int]:
        """Calculate text position based on alignment"""
        text_width, text_height = self._get_text_dimensions(text, font)
        img_width, img_height = image_size
        x, y = position
        
        # Handle percentage-based positioning
        if isinstance(x, str) and x.endswith('%'):
            x = int(img_width * float(x.rstrip('%')) / 100)
        if isinstance(y, str) and y.endswith('%'):
            y = int(img_height * float(y.rstrip('%')) / 100)
        
        # Adjust for alignment
        if alignment == "center":
            x = x - text_width // 2
        elif alignment == "right":
            x = x - text_width
        
        return x, y
    
    def add_text_overlay(self, 
                        image_url: str, 
                        text_configs: List[TextConfig]) -> bytes:
        """
        Add text overlays to an image
        
        Args:
            image_url: URL of the base image
            text_configs: List of text configurations to apply
            
        Returns:
            Bytes of the processed image (PNG format)
        """
        # Download and prepare image
        image = self._download_image(image_url)
        
        # Create drawing context
        draw = ImageDraw.Draw(image)
        
        # Apply each text configuration
        for config in text_configs:
            font = self._get_font(config.font_style, config.font_size)
            
            # Calculate position
            x, y = self._calculate_position(
                config.text, 
                font, 
                image.size, 
                config.position, 
                config.alignment
            )
            
            # Draw background box if requested
            if config.background_box:
                text_width, text_height = self._get_text_dimensions(config.text, font)
                padding = 10
                box_color = self._parse_color(config.background_color, config.background_opacity)
                draw.rectangle(
                    [x - padding, y - padding, 
                     x + text_width + padding, y + text_height + padding],
                    fill=box_color
                )
            
            # Draw shadow if requested
            if config.shadow:
                shadow_x = x + config.shadow_offset[0]
                shadow_y = y + config.shadow_offset[1]
                shadow_color = self._parse_color(config.shadow_color)
                draw.text(
                    (shadow_x, shadow_y), 
                    config.text, 
                    font=font, 
                    fill=shadow_color
                )
            
            # Draw outline if requested
            if config.outline:
                outline_color = self._parse_color(config.outline_color)
                # Draw text multiple times for outline effect
                for dx in range(-config.outline_width, config.outline_width + 1):
                    for dy in range(-config.outline_width, config.outline_width + 1):
                        if dx != 0 or dy != 0:
                            draw.text(
                                (x + dx, y + dy), 
                                config.text, 
                                font=font, 
                                fill=outline_color
                            )
            
            # Draw main text
            text_color = self._parse_color(config.font_color)
            draw.text((x, y), config.text, font=font, fill=text_color)
        
        # Convert to bytes
        output = io.BytesIO()
        image.save(output, format='PNG')
        output.seek(0)
        return output.getvalue()
    
    def add_marketing_text(self, 
                          image_url: str, 
                          headline: str, 
                          subtext: Optional[str] = None,
                          cta: Optional[str] = None) -> bytes:
        """
        Add marketing-specific text layout
        
        Args:
            image_url: URL of the base image
            headline: Main headline text
            subtext: Optional subtitle
            cta: Optional call-to-action text
            
        Returns:
            Bytes of the processed image
        """
        text_configs = []
        
        # Headline - large, centered at top
        text_configs.append(TextConfig(
            text=headline.upper(),
            position=(512, 200),  # Center x, near top
            font_size=72,
            font_style="bold",
            alignment="center",
            shadow=True,
            shadow_offset=(3, 3)
        ))
        
        # Subtext - smaller, below headline
        if subtext:
            text_configs.append(TextConfig(
                text=subtext,
                position=(512, 350),
                font_size=36,
                font_style="regular",
                alignment="center",
                font_color="#EEEEEE"
            ))
        
        # CTA - bottom with background
        if cta:
            text_configs.append(TextConfig(
                text=cta.upper(),
                position=(512, 850),
                font_size=48,
                font_style="bold",
                alignment="center",
                background_box=True,
                background_color="#FF0000",
                background_opacity=200
            ))
        
        return self.add_text_overlay(image_url, text_configs)
    
    def create_text_styles(self) -> Dict[str, Dict]:
        """Return available text style presets"""
        return {
            "headline": {
                "font_size": 72,
                "font_style": "bold",
                "shadow": True,
                "alignment": "center"
            },
            "subheadline": {
                "font_size": 48,
                "font_style": "regular",
                "alignment": "center"
            },
            "body": {
                "font_size": 36,
                "font_style": "regular",
                "alignment": "left"
            },
            "cta": {
                "font_size": 48,
                "font_style": "bold",
                "background_box": True,
                "alignment": "center"
            },
            "price": {
                "font_size": 96,
                "font_style": "bold",
                "font_color": "#FF0000",
                "shadow": True,
                "alignment": "center"
            }
        }

# Initialize service
text_overlay_service = TextOverlayService()