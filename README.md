# Brandroom AI UGC Creator Studio (Template v1.0)

A web application and prompt synthesis engine built directly on the **AI UGC Creator Image Master Prompt Template (Version 1.0)**.

Designed for performance ad directors, UGC agencies, and DTC brands to generate production-ready image prompts with strict identity and style consistency locks.

---

## Key Features

1. **Quick AI 1-Sentence Command Bar ("I need...")**:
   - Type a single natural English sentence (e.g., *"I need a 22yo Indian female creator in a white linen shirt reviewing skincare serum, vertical format"*).
   - Instantly extracts brand, product, gender, age, ethnicity, wardrobe, category, and aspect ratio, auto-populates the studio form, and generates the complete prompt pack.

2. **Aspect Ratio / Format Selector**:
   - 1-click selection: **Vertical (9:16)** for Reels/TikTok/Shorts, **Horizontal (16:9)** for Web/YouTube/Lookbook, or **Square (1:1)** for Feed/Carousel.
   - Automatically adapts camera framing descriptions and injects Midjourney/Firefly parameter flags (`--ar 9:16`, `--ar 16:9`, `--ar 1:1`).

3. **3-Shot Lookbook Reference Pack**:
   - **Shot 1 (Face Close-Up Portrait)**: Intimate eye-level facial portrait locking skin micro-texture and features.
   - **Shot 2 (Full-Body Front)**: Head-to-toe standing posture showcasing complete outfit and footwear, cropped below chin with face completely not visible.
   - **Shot 3 (Full-Body Back)**: Direct rear view showcasing back silhouette, rear seams, and hair back.
   - **3-Panel Triptych Composite**: High-end commercial lookbook catalog reference sheet.
   - **Commercial UGC Ad Prompt**: Handheld phone camera UGC hook photo.

4. **Multi-Mode Creator Casting & Dynamic Vision Analysis**:
   - **Upload Photo**: Detects exact origin, apparent age, and accurate gender (`Female`, `Male`, `Non-Binary`) using Gemini/OpenAI vision without hardcoded defaults.
   - **Auto-Match from Product**: Generates 3 culturally resonant creator archetypes for any product origin.
   - **Clean Minimalist UI**: Single clean input control per field without duplicate stacked boxes.

5. **Multi-Model AI Integration (BYOK)**:
   - Connect **Google Gemini (1.5 Flash / Pro)**, **OpenAI (ChatGPT-4o)**, or **Anthropic Claude (3.5 Sonnet)**.
   - Live web search grounding with built-in zero-dependency offline simulation.

---

## How to Run

### Quick Start
Open terminal in this directory and run:

```bash
./start.sh
```

Or run directly with Python 3:
```bash
python3 server.py
```

Then open your browser at:
```
http://localhost:8765
```

---

## File Structure

```
.
├── server.py              # Zero-dependency Python backend proxy for OpenAI/Gemini/Claude
├── start.sh               # One-click launcher script
├── test_server.py         # Automated API tests
├── public/
│   ├── index.html         # Studio dashboard with responsive Tailwind UI
│   ├── app.js             # Vision analysis, outfit selection, model connector
│   └── styles.css         # Glassmorphism, animations, active states
└── README.md
```
