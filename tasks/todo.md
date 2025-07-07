# Todo List

## Completed Tasks

- [x] Analyze current image generation flow and identify where to split prompts
- [x] Create a new prompt generation service that splits prompts into background and text
- [x] Update the image generation service to handle split prompts
- [x] Modify the frontend UI to support split prompt input
- [x] Update API endpoints to handle split prompt structure

## Pending Tasks

- [ ] Test the new split prompt functionality

## Review

### Summary of Changes

I've successfully implemented the split prompt functionality for image generation:

1. **Backend Changes:**
   - Enhanced `ImageGenerationService` with new methods:
     - `split_prompt()`: Intelligently splits short text into background and text prompts
     - `combine_prompts()`: Combines background and text prompts with proper formatting
     - `generate_image_with_split_prompts()`: New method for split prompt generation
   - Updated API endpoints to accept split prompts while maintaining backward compatibility
   - Added automatic text styling: "Bold white sans-serif font, centered" is automatically appended

2. **Frontend Changes:**
   - Added toggle for "Use split prompts" mode
   - Created separate input fields for background and text prompts
   - Updated image generation logic to handle both single and split prompts
   - Maintained backward compatibility with existing single prompt functionality

3. **Key Features:**
   - Smart background generation based on keywords (summer, winter, sale, etc.)
   - Automatic text styling enforcement
   - Clean UI with helpful placeholders
   - Error handling and validation

The implementation is simple and focused, avoiding unnecessary complexity while providing the requested functionality.