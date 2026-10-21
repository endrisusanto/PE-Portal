#!/usr/bin/env python3
"""
Local Background Remover for SEIN PE-Portal
Runs 100% locally using Pillow without external cloud APIs.
Usage: python3 remove_bg.py <input_file> <output_file> [tolerance: 0-100] [bg_color_hex: e.g. #ffffff or auto] [feather: 1-10]
"""

import sys
import math
from PIL import Image, ImageFilter

def hex_to_rgb(hex_str):
    hex_str = hex_str.lstrip('#')
    if len(hex_str) == 3:
        hex_str = ''.join([c*2 for c in hex_str])
    return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))

def sample_background_color(img):
    """Sample corner pixels to auto-detect predominant background color"""
    w, h = img.size
    sample_points = [
        (2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3),
        (w // 2, 2), (2, h // 2), (w - 3, h // 2), (w // 2, h - 3)
    ]
    colors = []
    for x, y in sample_points:
        if 0 <= x < w and 0 <= y < h:
            colors.append(img.getpixel((x, y))[:3])
    
    # Calculate average corner/edge color
    avg_r = sum(c[0] for c in colors) // len(colors)
    avg_g = sum(c[1] for c in colors) // len(colors)
    avg_b = sum(c[2] for c in colors) // len(colors)
    return (avg_r, avg_g, avg_b)

def remove_background(input_path, output_path, tolerance=35, bg_hex='auto', feather=2):
    try:
        img = Image.open(input_path).convert('RGBA')
    except Exception as e:
        print(f"ERROR: Failed to open image: {e}", file=sys.stderr)
        sys.exit(1)

    w, h = img.size
    
    if bg_hex.lower() == 'auto' or not bg_hex.startswith('#'):
        bg_rgb = sample_background_color(img)
    else:
        bg_rgb = hex_to_rgb(bg_hex)

    bg_r, bg_g, bg_b = bg_rgb
    tol_dist = float(tolerance) * 4.417  # Scale 0-100 to Euclidean distance range (0-441.67)
    feather_dist = float(feather) * 4.417

    # Extract pixel data
    pixels = img.load()
    
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            # Euclidean color distance to background
            dist = math.sqrt((r - bg_r)**2 + (g - bg_g)**2 + (b - bg_b)**2)
            
            if dist <= tol_dist:
                pixels[x, y] = (r, g, b, 0)
            elif dist < tol_dist + feather_dist:
                # Smooth edge alpha
                factor = (dist - tol_dist) / feather_dist
                new_a = int(factor * a)
                pixels[x, y] = (r, g, b, new_a)

    # Optional slight feather blur on alpha channel for ultra-smooth edges
    if feather > 1:
        alpha = img.split()[-1]
        alpha = alpha.filter(ImageFilter.GaussianBlur(radius=0.5))
        img.putalpha(alpha)

    img.save(output_path, format='PNG', optimize=True)
    print(f"SUCCESS: {output_path} (bg: {bg_rgb}, tol: {tolerance})")

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: remove_bg.py <input> <output> [tolerance=35] [bg_color=#ffffff|auto] [feather=2]")
        sys.exit(1)

    inp = sys.argv[1]
    out = sys.argv[2]
    tol = int(sys.argv[3]) if len(sys.argv) > 3 else 35
    bg = sys.argv[4] if len(sys.argv) > 4 else 'auto'
    fth = int(sys.argv[5]) if len(sys.argv) > 5 else 2

    remove_background(inp, out, tol, bg, fth)
