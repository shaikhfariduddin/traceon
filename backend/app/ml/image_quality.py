import hashlib
import os
from PIL import Image
import numpy as np

try:
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False

try:
    from scipy.signal import convolve2d
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

def calculate_sha256(filepath: str) -> str:
    hasher = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def assess_image_quality(filepath: str) -> dict:
    """
    Validates file integrity, dimensions, blur via Laplacian variance,
    and illumination via mean pixel luminance.
    Returns: {
        'is_valid': bool,
        'width': int,
        'height': int,
        'blur_score': float,
        'brightness_score': float,
        'is_uncertain': bool,
        'quality_notes': str,
        'error': str or None
    }
    """
    result = {
        'is_valid': False,
        'width': None,
        'height': None,
        'blur_score': None,
        'brightness_score': None,
        'is_uncertain': False,
        'quality_notes': 'OK',
        'error': None
    }

    try:
        with Image.open(filepath) as img:
            img.verify()

        # Re-open after verify to compute metrics
        with Image.open(filepath) as img:
            width, height = img.size
            result['width'] = width
            result['height'] = height
            result['is_valid'] = True

            # Convert to RGB array
            rgb_arr = np.array(img.convert('RGB'))
            gray_arr = np.array(img.convert('L'))

            # Mean brightness
            brightness = float(np.mean(gray_arr))
            result['brightness_score'] = round(brightness, 2)

            # Blur assessment (Laplacian variance)
            if HAS_CV2:
                laplacian_var = float(cv2.Laplacian(gray_arr, cv2.CV_64F).var())
            elif HAS_SCIPY:
                lap_kernel = np.array([[0, 1, 0], [1, -4, 1], [0, 1, 0]], dtype=float)
                convolved = convolve2d(gray_arr, lap_kernel, mode='valid')
                laplacian_var = float(np.var(convolved))
            else:
                diff_x = np.diff(gray_arr, axis=1)
                diff_y = np.diff(gray_arr, axis=0)
                laplacian_var = float(np.var(diff_x) + np.var(diff_y))

            result['blur_score'] = round(laplacian_var, 2)

            # Evaluate thresholds
            notes = []
            is_uncertain = False

            if result['blur_score'] < 30.0:
                is_uncertain = True
                notes.append(f"Image appears blurry (Laplacian variance: {result['blur_score']} < 30.0)")

            if brightness < 25.0:
                is_uncertain = True
                notes.append(f"Underexposed image (brightness: {brightness} < 25.0)")
            elif brightness > 235.0:
                is_uncertain = True
                notes.append(f"Overexposed image (brightness: {brightness} > 235.0)")

            result['is_uncertain'] = is_uncertain
            result['quality_notes'] = "; ".join(notes) if notes else "Image quality checks passed (Sharpness & illumination valid)."

    except Exception as e:
        result['is_valid'] = False
        result['error'] = f"Corrupted or unreadable image: {str(e)}"
        result['quality_notes'] = result['error']
        result['is_uncertain'] = True

    return result
