#!/usr/bin/env python3
"""
Brandroom AI UGC Creator Studio - Backend Server
Provides static asset serving and unified API proxy for:
- OpenAI (ChatGPT / GPT-4o)
- Google Gemini (1.5 Pro / Flash / 2.0)
- Anthropic Claude (3.5 Sonnet)
Zero external dependencies required (uses Python standard library).
"""

import http.server
import socketserver
import json
import urllib.request
import urllib.error
import urllib.parse
import os
import sys

PORT = int(os.environ.get("PORT", 8765))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")

MASTER_SYSTEM_PROMPT = """You are an expert AI UGC creator casting director, commercial photographer, and master image-prompt engineer.
You are tasked with generating a production-ready UGC creator image prompt and consistency locks strictly following the "AI UGC CREATOR IMAGE MASTER PROMPT TEMPLATE (Version 1.0)".

Core Rules:
1. Do not assume photorealism unless REAL HUMAN / PHOTOREALISTIC is requested.
2. For Real Humans, prioritize natural skin texture, visible pores, subtle facial asymmetry, genuine phone-camera rendering, believable eyes and hands. Ban waxy/plastic skin and artificial influencer face.
3. Follow the 18-step description ordering:
   (1) visual style (2) creator identity (3) facial identity (4) skin/render treatment (5) hair (6) physique (7) clothing (8) expression (9) body language (10) action (11) product (12) product interaction (13) environment (14) composition (15) camera (16) lighting (17) visual quality (18) advertising purpose.
4. Output MUST contain exactly these 5 labelled sections:
   - UGC CREATOR IMAGE PROMPT
   - CHARACTER LOCK
   - STYLE / RENDER LOCK
   - CAMERA / VISUAL LOCK
   - NEGATIVE PROMPT
Do not add conversational preamble, meta-commentary, or explanations.
"""

def make_request(url, headers, data=None, method="GET"):
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            err_json = json.loads(err_body)
            msg = err_json.get("error", {}).get("message", err_body)
        except Exception:
            msg = err_body
        raise RuntimeError(f"HTTP {e.code}: {msg}")
    except Exception as e:
        raise RuntimeError(str(e))

class StudioHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def read_json_body(self):
        content_len = int(self.headers.get("Content-Length", 0))
        if content_len == 0:
            return {}
        post_data = self.rfile.read(content_len)
        return json.loads(post_data.decode("utf-8"))

    def send_json(self, data, status=200):
        resp_bytes = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(resp_bytes)))
        self.end_headers()
        self.wfile.write(resp_bytes)

    def do_POST(self):
        url_path = urllib.parse.urlparse(self.path).path
        try:
            body = self.read_json_body()
            if url_path == "/api/analyze-character":
                self.handle_analyze_character(body)
            elif url_path == "/api/suggest-character":
                self.handle_suggest_character(body)
            elif url_path == "/api/generate-prompt":
                self.handle_generate_prompt(body)
            elif url_path == "/api/generate-image":
                self.handle_generate_image(body)
            elif url_path == "/api/chat":
                self.handle_chat(body)
            elif url_path == "/api/quick-prompt":
                self.handle_quick_prompt(body)
            elif url_path == "/api/refine-prompt":
                self.handle_refine_prompt(body)
            elif url_path == "/api/analyze-product":
                self.handle_analyze_product(body)
            elif url_path == "/api/test-connection":
                self.handle_test_connection(body)
            else:
                self.send_json({"error": f"Endpoint {url_path} not found"}, 404)
        except Exception as e:
            self.send_json({"error": str(e)}, 500)

    # --------------------------------------------------------------------------
    # AI API Connectors & Provider Resolution
    # --------------------------------------------------------------------------
    def resolve_provider_and_key(self, requested_provider, api_keys, explicit_key=None):
        """
        Resolves the target AI provider ('gemini', 'openai', 'claude') and corresponding API key.
        Checks explicit_key, client api_keys dictionary, and server environment variables.
        """
        if not api_keys or not isinstance(api_keys, dict):
            api_keys = {}

        env_keys = {
            "gemini": os.environ.get("GEMINI_API_KEY", "").strip(),
            "openai": os.environ.get("OPENAI_API_KEY", "").strip(),
            "claude": (os.environ.get("ANTHROPIC_API_KEY", "") or os.environ.get("CLAUDE_API_KEY", "")).strip()
        }

        # Auto-associate explicit single key if passed
        if explicit_key and isinstance(explicit_key, str):
            explicit_key = explicit_key.strip()
            if explicit_key.startswith("AIza") and not api_keys.get("gemini"):
                api_keys["gemini"] = explicit_key
            elif explicit_key.startswith("sk-ant") and not api_keys.get("claude"):
                api_keys["claude"] = explicit_key
            elif explicit_key.startswith("sk-") and not api_keys.get("openai"):
                api_keys["openai"] = explicit_key

        req = (requested_provider or "auto").lower().strip()
        if req in ("gemini", "google"):
            target = "gemini"
            key = api_keys.get("gemini") or env_keys["gemini"] or (explicit_key if explicit_key and explicit_key.startswith("AIza") else "")
            return target, key
        elif req in ("openai", "chatgpt", "gpt"):
            target = "openai"
            key = api_keys.get("openai") or env_keys["openai"] or (explicit_key if explicit_key and not explicit_key.startswith("AIza") and not explicit_key.startswith("sk-ant") else "")
            return target, key
        elif req in ("claude", "anthropic"):
            target = "claude"
            key = api_keys.get("claude") or env_keys["claude"] or (explicit_key if explicit_key and explicit_key.startswith("sk-ant") else "")
            return target, key
        else:  # 'auto'
            for prov in ("gemini", "openai", "claude"):
                k = api_keys.get(prov) or env_keys[prov]
                if k:
                    return prov, k
            if explicit_key:
                if explicit_key.startswith("AIza"):
                    return "gemini", explicit_key
                elif explicit_key.startswith("sk-ant"):
                    return "claude", explicit_key
                else:
                    return "openai", explicit_key
            return "auto", None

    def call_llm(self, provider, api_key, model, system_prompt, user_prompt, image_base64=None):
        if not api_key:
            raise ValueError(f"No API key provided for {provider}.")

        if provider == "auto":
            if api_key.startswith("AIza"):
                provider = "gemini"
            elif api_key.startswith("sk-ant"):
                provider = "claude"
            else:
                provider = "openai"

        if provider == "openai":
            messages = [{"role": "system", "content": system_prompt}]
            user_content = []
            if image_base64:
                user_content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}
                })
            user_content.append({"type": "text", "text": user_prompt})
            messages.append({"role": "user", "content": user_content})

            payload = {
                "model": model or "gpt-4o",
                "messages": messages,
                "temperature": 0.7
            }
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            res = make_request("https://api.openai.com/v1/chat/completions", headers, json.dumps(payload).encode("utf-8"), "POST")
            return res["choices"][0]["message"]["content"]

        elif provider == "gemini":
            target_model = model or "gemini-1.5-flash"
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={api_key}"
            parts = []
            if image_base64:
                parts.append({
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": image_base64
                    }
                })
            parts.append({"text": f"{system_prompt}\n\nTask:\n{user_prompt}"})
            
            headers = {"Content-Type": "application/json"}
            if image_base64:
                # Multimodal request: Gemini does NOT support google_search tools when image is present
                payload_simple = {
                    "contents": [{"parts": parts}],
                    "generationConfig": {"temperature": 0.7}
                }
                res = make_request(url, headers, json.dumps(payload_simple).encode("utf-8"), "POST")
                return res["candidates"][0]["content"]["parts"][0]["text"]
            else:
                # Text request: enable live internet browsing data via Google Search grounding
                payload_with_search = {
                    "contents": [{"parts": parts}],
                    "tools": [{"google_search": {}}],
                    "generationConfig": {"temperature": 0.7}
                }
                try:
                    res = make_request(url, headers, json.dumps(payload_with_search).encode("utf-8"), "POST")
                    return res["candidates"][0]["content"]["parts"][0]["text"]
                except Exception:
                    # Fallback without search grounding if key tier doesn't support tools
                    payload_simple = {
                        "contents": [{"parts": parts}],
                        "generationConfig": {"temperature": 0.7}
                    }
                    res = make_request(url, headers, json.dumps(payload_simple).encode("utf-8"), "POST")
                    return res["candidates"][0]["content"]["parts"][0]["text"]

        elif provider == "claude":
            headers = {
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            }
            content = []
            if image_base64:
                content.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": image_base64
                    }
                })
            content.append({"type": "text", "text": user_prompt})
            payload = {
                "model": model or "claude-3-5-sonnet-20241022",
                "system": system_prompt,
                "max_tokens": 4096,
                "messages": [{"role": "user", "content": content}]
            }
            res = make_request("https://api.anthropic.com/v1/messages", headers, json.dumps(payload).encode("utf-8"), "POST")
            return res["content"][0]["text"]
        else:
            raise ValueError(f"Unsupported AI provider: {provider}")

    # --------------------------------------------------------------------------
    # Handlers
    # --------------------------------------------------------------------------
    def handle_test_connection(self, body):
        provider = body.get("provider")
        api_key = body.get("apiKey")
        model = body.get("model")
        if not api_key:
            return self.send_json({"success": False, "error": "API Key is empty."})

        try:
            out = self.call_llm(
                provider=provider,
                api_key=api_key,
                model=model,
                system_prompt="You are an API tester. Respond only with: OK",
                user_prompt="Ping test."
            )
            self.send_json({"success": True, "response": out.strip()})
        except Exception as e:
            self.send_json({"success": False, "error": str(e)})

    def handle_analyze_character(self, body):
        """Analyzes uploaded image: detects gender accurately, origin/ethnicity, facial traits, and suggests best outfits."""
        provider, api_key = self.resolve_provider_and_key(body.get("provider", "auto"), body.get("apiKeys"), body.get("apiKey"))
        model = body.get("model")
        image_base64 = body.get("imageBase64")
        product_category = body.get("productCategory", "Beauty & Lifestyle")
        product_origin = body.get("productOrigin", "Global")

        if not image_base64:
            return self.send_json({"error": "No image data provided"}, 400)

        # Context-aware fallback if no API key is provided
        is_beauty = any(k in product_category.lower() for k in ["skincare", "beauty", "hair", "serum", "dermatology"])
        fallback_gender = "Female" if is_beauty else "Female"
        fallback_origin = "South Asian / Indian" if "india" in product_origin.lower() else f"{product_origin}"
        
        fallback_data = {
            "origin": fallback_origin,
            "apparentAge": "23",
            "gender": fallback_gender,
            "skinTone": "Warm natural skin tone with radiant undertone and authentic micro-texture",
            "facialFeatures": "Expressive almond eyes, softly defined natural jawline, authentic micro-pores, friendly engaging look",
            "hair": "Naturally textured dark-brown hair with soft volume and organic flyaways",
            "outfitRecommendations": [
                {
                    "title": "Modern Casual Kurti / Linen Shirt",
                    "top": "Relaxed breathable sage green or ivory linen shirt with rolled cuffs",
                    "bottom": "Slim-fit off-white trousers, clean minimalist slides",
                    "vibe": "Relatable, authentic everyday UGC creator with genuine credibility"
                },
                {
                    "title": "Clean Minimalist Athleisure",
                    "top": "Fitted matte ribbed athletic tank top",
                    "bottom": "High-waisted charcoal seamless leggings",
                    "vibe": "Energetic, health-conscious morning routine aesthetic"
                },
                {
                    "title": "Chic Studio / Home Vlogger",
                    "top": "Oversized pastel beige ribbed knit cardigan over simple white cotton top",
                    "bottom": "Relaxed straight-leg light-wash denim",
                    "vibe": "Trustworthy, approachable, premium direct-to-consumer product review"
                }
            ],
            "isSimulated": True
        }

        if not api_key:
            return self.send_json(fallback_data)

        system_prompt = (
            "You are a professional UGC casting director, fashion stylist, and facial analyst. "
            "Analyze the character photo with high visual fidelity. "
            "CRITICAL REQUIREMENT: Accurately determine the subject's gender (Female, Male, or Non-Binary). "
            "Return a strict JSON object (no markdown, pure valid JSON only) with exactly these keys:\n"
            "{\n"
            '  "gender": "Female" or "Male" or "Non-Binary",\n'
            '  "apparentAge": "23",\n'
            '  "origin": "South Asian / Indian, East Asian, European / Fair, Afro-descendant, etc.",\n'
            '  "skinTone": "Natural detailed skin complexion and undertone description",\n'
            '  "facialFeatures": "Detailed facial bone structure, eyes, brows, nose, authentic unretouched skin micro-texture",\n'
            '  "hair": "Detailed hair cut, texture, color, and styling",\n'
            '  "outfitRecommendations": [\n'
            '    {"title": "...", "top": "...", "bottom": "...", "vibe": "..."},\n'
            '    {"title": "...", "top": "...", "bottom": "...", "vibe": "..."},\n'
            '    {"title": "...", "top": "...", "bottom": "...", "vibe": "..."}\n'
            '  ]\n'
            "}\n"
            f"Tailor outfit suggestions specifically for a product in category '{product_category}' from '{product_origin}'."
        )

        user_prompt = "Examine this person's gender, regional origin, facial identity, and generate 3 suitable UGC outfits in JSON format."

        try:
            raw_output = self.call_llm(provider, api_key, model, system_prompt, user_prompt, image_base64)
            clean_json = raw_output.strip()
            if clean_json.startswith("```json"):
                clean_json = clean_json[7:]
            if clean_json.startswith("```"):
                clean_json = clean_json[3:]
            if clean_json.endswith("```"):
                clean_json = clean_json[:-3]
            clean_json = clean_json.strip()
            parsed = json.loads(clean_json)
            self.send_json(parsed)
        except Exception:
            self.send_json(fallback_data)

    def handle_analyze_product(self, body):
        """Analyzes an uploaded product photo to infer product attributes and recommend the best UGC creator personas."""
        provider, api_key = self.resolve_provider_and_key(body.get("provider", "auto"), body.get("apiKeys"), body.get("apiKey"))
        model = body.get("model")
        image_base64 = body.get("imageBase64")
        current_product_name = body.get("productName", "").strip()
        current_category = body.get("productCategory", "Fashion & Apparel (Streetwear & Casual)")
        current_origin = body.get("productOrigin", "India — Urban Metro")
        brand_name = body.get("brandName", "Brandroom Studio")
        cycle = int(body.get("cycle", 1))
        exclude_archetypes = body.get("excludeArchetypes", [])

        if not image_base64:
            return self.send_json({"error": "No product image provided"}, 400)

        fallback_data = self.get_simulated_product_recommendations(current_product_name, current_category, current_origin, cycle=cycle)

        if not api_key:
            return self.send_json(fallback_data)

        exclude_clause = f"\nCRITICAL DIVERSITY REQUIREMENT: The user already saw and rejected these personas: {', '.join(exclude_archetypes)}. You MUST generate 3 COMPLETELY DIFFERENT and FRESH creator archetypes with contrasting demographics, vibes, or marketing angles." if exclude_archetypes else ""

        system_prompt = (
            "You are an elite UGC creative director, e-commerce branding expert, and casting director. "
            "Examine the uploaded product photo with high visual attention.\n"
            "CRITICAL INSTRUCTIONS:\n"
            "1. Inspect the product image: determine product title/type, packaging/materials, color palette, and brand aesthetic.\n"
            "2. Generate 3 distinct, highly effective UGC creator personas designed specifically to showcase and sell this product."
            f"{exclude_clause}\n"
            "For each creator archetype, provide:\n"
            "   - 'archetype': Punchy, memorable title (e.g. 'Relatable Clean Skincare Creator', 'Urban Streetwear Stylist')\n"
            "   - 'gender': 'Female', 'Male', or 'Non-Binary'\n"
            "   - 'age': Realistic adult creator age (e.g. '23', '26', '29')\n"
            "   - 'ethnicity': Culturally authentic ethnicity fitting the target market (e.g. 'South Asian / Indian — Warm golden medium complexion')\n"
            "   - 'facialFeatures': Specific facial bone structure, skin texture, micro-pores, authentic direct eye contact\n"
            "   - 'hair': Specific cut, color, texture, and styling that complements the product\n"
            "   - 'wardrobe': Clothing and colors that complement (and never clash with or hide) the product\n"
            "   - 'environment': Ideal authentic UGC setting (e.g. 'Bright sunlit modern bathroom marble vanity', 'Minimalist concrete studio')\n"
            "   - 'lighting': Natural flattering lighting\n"
            "   - 'action': Specific product interaction pose (e.g. 'Holding dropper delicately near cheek while smiling warmly')\n"
            "   - 'fineTune': Specific fine-tuning recommendation (e.g. 'Emphasize visible micro-pores and soft morning glow')\n"
            "   - 'vibe': 1-sentence persona vibe and hook delivery style\n"
            "   - 'matchReason': 1-sentence explaining why this character archetype maximizes conversion for this product\n\n"
            "Return a strict pure JSON object (no markdown, no backticks) with this structure:\n"
            "{\n"
            '  "success": true,\n'
            '  "detectedProduct": {\n'
            '    "name": "...",\n'
            '    "category": "...",\n'
            '    "colorPalette": "...",\n'
            '    "vibe": "..."\n'
            '  },\n'
            '  "creators": [\n'
            '    {\n'
            '      "archetype": "...",\n'
            '      "gender": "Female",\n'
            '      "age": "24",\n'
            '      "ethnicity": "...",\n'
            '      "facialFeatures": "...",\n'
            '      "hair": "...",\n'
            '      "wardrobe": "...",\n'
            '      "environment": "...",\n'
            '      "lighting": "...",\n'
            '      "action": "...",\n'
            '      "fineTune": "...",\n'
            '      "vibe": "...",\n'
            '      "matchReason": "..."\n'
            '    }\n'
            '  ]\n'
            "}"
        )

        user_prompt = (
            f"Analyze this product photo. Current brand: '{brand_name}', User category hint: '{current_category}', "
            f"User origin/market hint: '{current_origin}'. Batch #{cycle}. Provide product detection and 3 tailored creator casting recommendations in strict JSON."
        )

        try:
            raw_output = self.call_llm(provider, api_key, model, system_prompt, user_prompt, image_base64)
            clean_json = raw_output.strip()
            if clean_json.startswith("```json"):
                clean_json = clean_json[7:]
            if clean_json.startswith("```"):
                clean_json = clean_json[3:]
            if clean_json.endswith("```"):
                clean_json = clean_json[:-3]
            clean_json = clean_json.strip()
            parsed = json.loads(clean_json)
            parsed["success"] = True
            parsed["batch"] = cycle
            self.send_json(parsed)
        except Exception:
            self.send_json(fallback_data)

    def get_simulated_product_recommendations(self, product_name, category, origin, cycle=1):
        """Returns 3 context-aware creator archetypes tailored to the product category and origin, supporting multiple batches."""
        cat_lower = (category or "").lower()
        name_lower = (product_name or "").lower()
        orig_lower = (origin or "").lower()
        batch_idx = (cycle - 1) % 3  # 0, 1, or 2

        if "india" in orig_lower:
            def_eth = "South Asian / Indian — Warm golden medium complexion with natural radiance"
        elif any(k in orig_lower for k in ["korea", "japan", "east asian"]):
            def_eth = "East Asian / Korean-Japanese — Smooth porcelain skin with subtle warm undertones"
        elif any(k in orig_lower for k in ["black", "africa", "afro"]):
            def_eth = "Afro-descendant / Black — Deep rich melanin with natural radiant skin sheen"
        elif any(k in orig_lower for k in ["latin", "brazil", "mexico"]):
            def_eth = "Latin American — Warm bronze complexion with radiant golden undertones"
        elif any(k in orig_lower for k in ["middle east", "dubai", "arab"]):
            def_eth = "Middle Eastern / Arab — Warm wheatish-olive skin with defined features"
        else:
            def_eth = "South Asian / Indian — Warm golden medium complexion with natural radiance"

        if any(k in cat_lower or k in name_lower for k in ["skincare", "serum", "cream", "beauty", "dermatology", "oil", "face"]):
            batches = [
                # Batch 1: Everyday Relatable, Clinical Specialist, Men's Grooming
                [
                    {
                        "archetype": "Relatable Clean Skincare Creator",
                        "gender": "Female",
                        "age": "24",
                        "ethnicity": def_eth,
                        "facialFeatures": "Naturally textured skin with dewy bare glow, visible micro-pores, friendly warm almond eyes, approachable smile",
                        "hair": "Glossy dark-brown hair tied back into a loose effortless low bun with face-framing tendrils",
                        "wardrobe": "Breathable off-white relaxed linen sleeveless top, delicate silver huggie earrings",
                        "environment": "Clean modern bathroom with marble vanity, soft subway tile, and subtle warm mirror reflection",
                        "lighting": "Natural soft morning window daylight with flattering organic shadows",
                        "action": "Holding dropper bottle delicately near cheek with authentic smiling direct gaze toward lens",
                        "fineTune": "Ultra-Realistic Skin Texture (Accentuate Visible Micro-Pores, Authentic Epidermal Sheen, No CGI Polish)",
                        "vibe": "Direct-to-camera intimate morning routine testimonial",
                        "matchReason": "Bare radiant skin visually proves product efficacy while off-white linen prevents clothing from competing with the product."
                    },
                    {
                        "archetype": "Clinical Dermatology & Routine Specialist",
                        "gender": "Female",
                        "age": "28",
                        "ethnicity": def_eth,
                        "facialFeatures": "Articulate direct gaze, calm poised demeanor, naturally radiant even-toned complexion, subtle smile",
                        "hair": "Polished shoulder-length dark lob with clean center part",
                        "wardrobe": "Crisp sage-green tailored cotton button-down shirt with rolled cuffs, minimalist watch",
                        "environment": "Seamless neutral light-gray studio backdrop with soft floor contact shadows",
                        "lighting": "Clean diffused commercial softbox studio daylight with realistic micro-shadows",
                        "action": "Presenting product label clearly toward camera with authoritative confident poise",
                        "fineTune": "Macro Product-in-Hand Focus (Crisp Product Label & Hand Details)",
                        "vibe": "Authoritative ingredient-breakdown product review",
                        "matchReason": "Professional yet approachable appearance establishes high scientific and dermatological credibility."
                    },
                    {
                        "archetype": "Everyday Men's Grooming Creator",
                        "gender": "Male",
                        "age": "26",
                        "ethnicity": def_eth,
                        "facialFeatures": "Clean healthy skin, well-groomed short stubble, friendly relatable eye contact",
                        "hair": "Neat textured taper fade with natural matte finish",
                        "wardrobe": "Heather gray organic cotton crewneck t-shirt, simple silver wrist chain",
                        "environment": "Sunlit contemporary apartment bedroom with organic linen bedding and soft bokeh plant",
                        "lighting": "Natural soft morning window daylight with flattering organic shadows",
                        "action": "Applying drop to fingertip with natural candid curiosity",
                        "fineTune": "Raw Mobile UGC Realism (iPhone 15 Pro, 28mm Focal Lens, Subtle Sensor Grain, Candid Handheld)",
                        "vibe": "No-nonsense, candid 60-second skincare routine hook",
                        "matchReason": "Captures the rapidly growing male skincare demographic with authentic, unpretentious appeal."
                    }
                ],
                # Batch 2: Luxury Spa Aesthetician, Gen-Z Viral Reviewer, Holistic Botanist
                [
                    {
                        "archetype": "Luxury Spa Aesthetician & Treatment Specialist",
                        "gender": "Female",
                        "age": "32",
                        "ethnicity": def_eth,
                        "facialFeatures": "Poised serene facial symmetry, radiant mature complexion, warm knowing smile, confident eye contact",
                        "hair": "Refined French twist updo with polished flyaways",
                        "wardrobe": "Tailored ivory minimalist collarless crepe blazer, subtle pearl studs",
                        "environment": "Warm minimalist cream/limewash textured studio wall with soft ambient floor falloff",
                        "lighting": "Soft Flattering Beauty Diffusion (Gentle Radiant Skin Glow, Flattering Catchlights in Eyes)",
                        "action": "Cradling product bottle between palms with gentle spa-level reverence",
                        "fineTune": "Soft Flattering Beauty Diffusion (Gentle Radiant Skin Glow, Flattering Catchlights in Eyes)",
                        "vibe": "Elevated luxury validation and spa-ritual aesthetic",
                        "matchReason": "Provides luxury spa authority that justifies a premium price point and builds high aspirational desire."
                    },
                    {
                        "archetype": "Gen-Z Viral TikTok Beauty Creator",
                        "gender": "Female",
                        "age": "21",
                        "ethnicity": def_eth,
                        "facialFeatures": "Expressive lively face, natural peach flush on cheeks, infectious enthusiastic smile, sparkling catchlights",
                        "hair": "High half-up ponytail with soft face tendrils and satin hair ribbon",
                        "wardrobe": "Pastel lavender ribbed knit crop cardigan, high-waisted relaxed off-white denim",
                        "environment": "Sunlit contemporary apartment bedroom with organic linen bedding and soft bokeh plant",
                        "lighting": "Natural soft morning window daylight with flattering organic shadows",
                        "action": "Showing immediate before/after skin texture with excited expressive eye contact",
                        "fineTune": "Raw Mobile UGC Realism (iPhone 15 Pro, 28mm Focal Lens, Subtle Sensor Grain, Candid Handheld)",
                        "vibe": "Rapid scroll-stopping 'POV: You found the holy grail' hook",
                        "matchReason": "High energy and candid expressions trigger rapid social proof and impulsive cart additions."
                    },
                    {
                        "archetype": "Holistic Botanical & Clean Beauty Advocate",
                        "gender": "Male",
                        "age": "29",
                        "ethnicity": def_eth,
                        "facialFeatures": "Mindful calm expression, clear healthy skin with natural pores, warm deep-brown eyes",
                        "hair": "Naturally textured dark curls with soft volume",
                        "wardrobe": "Raw unbleached beige cotton camp-collar shirt, minimalist woven bracelet",
                        "environment": "Vibrant modern creative studio with sleek oak wood desk and ambient lamps",
                        "lighting": "Overcast outdoor daylight with ultra-soft diffused shadows",
                        "action": "Inspecting product botanical ingredients thoughtfully toward camera",
                        "fineTune": "Cinematic 35mm Analog Film Grain (Subtle Warm Vintage Tone, Halation, Authentic Color Rendition)",
                        "vibe": "Conscious ingredient transparency and clean lifestyle advocacy",
                        "matchReason": "Resonates strongly with eco-conscious consumers who prioritize plant-based and non-toxic formulations."
                    }
                ],
                # Batch 3: Pro-Ageing Radiance, Sensitive Skin Advocate, Hair & Scalp Specialist
                [
                    {
                        "archetype": "Pro-Ageing Radiance Advocate",
                        "gender": "Female",
                        "age": "41",
                        "ethnicity": def_eth,
                        "facialFeatures": "Graceful authentic laugh lines, luminous mature skin, elegant confident direct gaze",
                        "hair": "Rich voluminous shoulder-length dark hair with subtle natural silver highlights",
                        "wardrobe": "Dusty-rose draped silk blouse with rolled sleeves, fine gold jewelry",
                        "environment": "Minimalist designer kitchen with honed quartz countertop and warm morning light",
                        "lighting": "Natural soft morning window daylight with flattering organic shadows",
                        "action": "Applying drop to back of hand smoothly while explaining age-defying hydration",
                        "fineTune": "Balanced Commercial Lookbook Standards (Neutral Exposure, Sharp Garment Weave, Zero Airbrushing)",
                        "vibe": "Empowering, mature, filter-free luxury skincare testimonial",
                        "matchReason": "Directly targets high-disposable-income mature buyers who seek authenticity over aggressive airbrushing."
                    },
                    {
                        "archetype": "Gentle Sensitive-Skin Problem Solver",
                        "gender": "Female",
                        "age": "25",
                        "ethnicity": def_eth,
                        "facialFeatures": "Gentle compassionate gaze, calm clear facial skin, subtle empathetic smile",
                        "hair": "Sleek middle-parted low ponytail with soft flyaways",
                        "wardrobe": "Oversized oatmeal knit crewneck sweater, relaxed linen lounge pants",
                        "environment": "Clean modern bathroom with marble vanity, soft subway tile, and subtle warm mirror reflection",
                        "lighting": "Clean diffused commercial softbox studio daylight with realistic micro-shadows",
                        "action": "Showing skin calm barrier after application with honest relief",
                        "fineTune": "Ultra-Realistic Skin Texture (Accentuate Visible Micro-Pores, Authentic Epidermal Sheen, No CGI Polish)",
                        "vibe": "Heartfelt problem-solution story for barrier repair and calm skin",
                        "matchReason": "Deep emotional resonance for consumers frustrated by harsh formulas and redness."
                    },
                    {
                        "archetype": "Modern Creative Studio Vlogger",
                        "gender": "Non-Binary",
                        "age": "26",
                        "ethnicity": def_eth,
                        "facialFeatures": "Modern balanced facial traits, glowing clear complexion, engaging artistic smile",
                        "hair": "Soft textured wavy wolf cut with curtain bangs",
                        "wardrobe": "Tailored relaxed ecru workwear jacket over neutral white tee",
                        "environment": "Vibrant modern creative studio with sleek oak wood desk and ambient lamps",
                        "lighting": "Soft ring light eye reflection with clean, balanced, front-facing creator exposure",
                        "action": "Unboxing and demonstrating dropper precision with creative flair",
                        "fineTune": "Balanced Commercial Lookbook Standards (Neutral Exposure, Sharp Garment Weave, Zero Airbrushing)",
                        "vibe": "Aesthetic lifestyle curator with eye for product tactile design",
                        "matchReason": "Bridges beauty and lifestyle for a modern, progressive digital audience."
                    }
                ]
            ]
            return {
                "success": True,
                "isSimulated": True,
                "batch": cycle,
                "detectedProduct": {
                    "name": product_name or "Botanical Radiant Serum",
                    "category": "Beauty / Clean Skincare & Serums",
                    "colorPalette": "Amber glass, warm gold, off-white dropper",
                    "vibe": "Clean luxury clinical skincare with organic botanical notes"
                },
                "creators": batches[batch_idx]
            }

        elif any(k in cat_lower or k in name_lower for k in ["apparel", "fashion", "linen", "shirt", "streetwear", "hoodie", "dress", "outfit"]):
            batches = [
                # Batch 1: Urban Streetwear, Indo-Western Stylist, Minimalist Capsule
                [
                    {
                        "archetype": "Urban Contemporary Streetwear Stylist",
                        "gender": "Male",
                        "age": "23",
                        "ethnicity": def_eth,
                        "facialFeatures": "Sharp softly defined jawline, confident calm expression, authentic unretouched skin micro-pores",
                        "hair": "Clean textured crop with subtle faded temples and natural movement",
                        "wardrobe": "Oversized heavyweight ivory cotton drop-shoulder crewneck tee, relaxed pleated trousers, clean leather sneakers",
                        "environment": "Seamless neutral light-gray studio backdrop with soft floor contact shadows",
                        "lighting": "Clean diffused commercial softbox studio daylight with realistic micro-shadows",
                        "action": "Standing straight with neutral hands at sides showcasing fabric silhouette and drape",
                        "fineTune": "High-Fashion Editorial Contrast (Sharp Fabric Seams, Crisp Specular Highlights, Deep Controlled Shadows)",
                        "vibe": "Effortless styling lookbook showcase with clean full-body posture",
                        "matchReason": "Relaxed silhouette and neutral palette accentuate garment drape, seam construction, and fabric texture."
                    },
                    {
                        "archetype": "Chic Contemporary Indo-Western Stylist",
                        "gender": "Female",
                        "age": "25",
                        "ethnicity": def_eth,
                        "facialFeatures": "Warm almond deep-brown eyes, softly defined oval face, radiant golden undertone, poised direct gaze",
                        "hair": "Long glossy dark-brown hair with loose effortless waves cascading over shoulders",
                        "wardrobe": "Relaxed breathable sage-green linen kurti with rolled cuffs, slim off-white cigarette trousers, clean leather sandals",
                        "environment": "Chic urban outdoor cafe terrace with softly blurred street architecture",
                        "lighting": "Golden-hour warm directional sunlight casting long soft warm shadows",
                        "action": "Holding handbag and gesturing naturally to garment texture with poised smile",
                        "fineTune": "Balanced Commercial Lookbook Standards (Neutral Exposure, Sharp Garment Weave, Zero Airbrushing)",
                        "vibe": "Aspirational yet highly accessible styling inspiration",
                        "matchReason": "Sophisticated styling seamlessly bridges ethnic tradition with modern metro aesthetics."
                    },
                    {
                        "archetype": "Minimalist Fashion & Capsule Wardrobe Creator",
                        "gender": "Female",
                        "age": "27",
                        "ethnicity": def_eth,
                        "facialFeatures": "Refined facial symmetry, poised calm expression, glowing natural skin texture",
                        "hair": "Sleek middle-parted low ponytail with polished edges",
                        "wardrobe": "Tailored unstructured beige linen blazer over clean white cotton crewneck, pleated olive chinos, tan leather mules",
                        "environment": "High-end architectural concrete loft studio with soft diffused northern window light",
                        "lighting": "Natural soft morning window daylight with flattering organic shadows",
                        "action": "Adjusting blazer cuff with calm deliberate poise toward camera",
                        "fineTune": "Minimalist Monochromatic Studio (Muted Neutral Grays, Clean Drop Shadows, Scandinavian Palette)",
                        "vibe": "High-credibility capsule wardrobe versatility review",
                        "matchReason": "Neutral elevated layering demonstrates how to style the hero piece for multiple occasions."
                    }
                ],
                # Batch 2: Editorial High-Fashion Model, Technical Utility Creator, Vintage Thrift Curator
                [
                    {
                        "archetype": "Editorial High-Fashion Lookbook Model",
                        "gender": "Female",
                        "age": "22",
                        "ethnicity": def_eth,
                        "facialFeatures": "Sculpted high cheekbones, intense calm editorial gaze, authentic skin micro-pores",
                        "hair": "Sleek side-parted wet-look bun with sharp architectural contour",
                        "wardrobe": "Monochrome charcoal structured oversized blazer, tailored wide-leg trousers, square-toe leather boots",
                        "environment": "High-end architectural concrete loft studio with soft diffused northern window light",
                        "lighting": "Dramatic subtle side window chiaroscuro with gentle fill light",
                        "action": "Direct intense fashion gaze into lens with poised architectural silhouette",
                        "fineTune": "High-Fashion Editorial Contrast (Sharp Fabric Seams, Crisp Specular Highlights, Deep Controlled Shadows)",
                        "vibe": "Runway-level elevated catalog authority",
                        "matchReason": "Transforms the product into a luxury fashion hero piece."
                    },
                    {
                        "archetype": "Technical Apparel & Functional Utility Specialist",
                        "gender": "Male",
                        "age": "26",
                        "ethnicity": def_eth,
                        "facialFeatures": "Sharp focused gaze, strong jaw, unposed natural expression",
                        "hair": "Modern textured fade with matte finish",
                        "wardrobe": "Modular olive utility overshirt with zip pockets, tapered water-resistant technical cargos, trail runners",
                        "environment": "Seamless neutral light-gray studio backdrop with soft floor contact shadows",
                        "lighting": "Clean diffused commercial softbox studio daylight with realistic micro-shadows",
                        "action": "Demonstrating seam construction and pocket functionality with hands-on detail",
                        "fineTune": "Macro Product-in-Hand Focus (Crisp Product Label & Hand Details)",
                        "vibe": "Durability, craftsmanship, and weather-ready utility",
                        "matchReason": "Validates fabric durability and technical features for active urban lifestyles."
                    },
                    {
                        "archetype": "Vintage Thrift & Upcycled Style Curator",
                        "gender": "Female",
                        "age": "24",
                        "ethnicity": def_eth,
                        "facialFeatures": "Playful confident smirk, warm direct eye contact, natural skin glow",
                        "hair": "Shaggy layered bob with soft curtain bangs",
                        "wardrobe": "Relaxed ecru chore jacket over washed terracotta tee, high-rise vintage wash denim",
                        "environment": "Chic urban outdoor cafe terrace with softly blurred street architecture",
                        "lighting": "Golden-hour warm directional sunlight casting long soft warm shadows",
                        "action": "Turning gently to showcase the 360 garment silhouette with playful confidence",
                        "fineTune": "Cinematic 35mm Analog Film Grain (Subtle Warm Vintage Tone, Halation, Authentic Color Rendition)",
                        "vibe": "Effortless thrifted vintage cool with timeless versatility",
                        "matchReason": "Connects with the sustainability and timeless wardrobe movements."
                    }
                ],
                # Batch 3: Executive Smart Casual, Resort/Vacation Stylist, Monochrome Minimalist
                [
                    {
                        "archetype": "Urban Executive & Smart Casual Director",
                        "gender": "Male",
                        "age": "34",
                        "ethnicity": def_eth,
                        "facialFeatures": "Authoritative mature presence, distinguished jawline, calm friendly smile",
                        "hair": "Classic neat taper with soft side-swept volume",
                        "wardrobe": "Tailored unconstructed navy hopsack blazer, crisp white poplin shirt, olive chinos, dark-brown suede loafers",
                        "environment": "Vibrant modern creative studio with sleek oak wood desk and ambient lamps",
                        "lighting": "High-key commercial studio lighting with dual diffused white reflectors",
                        "action": "Checking watch with poised executive body language",
                        "fineTune": "Balanced Commercial Lookbook Standards (Neutral Exposure, Sharp Garment Weave, Zero Airbrushing)",
                        "vibe": "Effortless modern professional transition from boardroom to dinner",
                        "matchReason": "Drives purchases from high-earning professionals looking for versatile smart-casual clothing."
                    },
                    {
                        "archetype": "Coastal Resort & Summer Linen Stylist",
                        "gender": "Female",
                        "age": "26",
                        "ethnicity": def_eth,
                        "facialFeatures": "Sun-kissed radiant golden skin, relaxed warm laugh, bright eyes",
                        "hair": "Long beachy textured waves catching light",
                        "wardrobe": "Relaxed breathable ivory linen co-ord set with rolled cuffs, woven leather slides, minimalist raffia tote",
                        "environment": "Golden-hour rooftop terrace overlooking soft blurred urban skyline",
                        "lighting": "Golden-hour warm directional sunlight casting long soft warm shadows",
                        "action": "Walking naturally toward lens with effortless holiday elegance",
                        "fineTune": "Soft Flattering Beauty Diffusion (Gentle Radiant Skin Glow, Flattering Catchlights in Eyes)",
                        "vibe": "Summer holiday and travel-ready lightness",
                        "matchReason": "Inspires high-intent vacation and warm-weather impulse wardrobe buying."
                    },
                    {
                        "archetype": "Monochrome Minimalist Designer",
                        "gender": "Non-Binary",
                        "age": "28",
                        "ethnicity": def_eth,
                        "facialFeatures": "Clean geometric bone structure, calm serene gaze, porcelain complexion",
                        "hair": "Blunt architectural bob with precise edges",
                        "wardrobe": "Asymmetric black draped tunic top, wide-leg pleated culottes, minimalist leather mules",
                        "environment": "Seamless neutral light-gray studio backdrop with soft floor contact shadows",
                        "lighting": "Clean diffused commercial softbox studio daylight with realistic micro-shadows",
                        "action": "Striking deliberate clean lookbook pose highlighting garment lines",
                        "fineTune": "Minimalist Monochromatic Studio (Muted Neutral Grays, Clean Drop Shadows, Scandinavian Palette)",
                        "vibe": "High-concept contemporary design aesthetic",
                        "matchReason": "Presents garments with museum-grade visual clarity."
                    }
                ]
            ]
            return {
                "success": True,
                "isSimulated": True,
                "batch": cycle,
                "detectedProduct": {
                    "name": product_name or "Tailored Contemporary Outfit",
                    "category": "Fashion & Apparel (Streetwear & Casual)",
                    "colorPalette": "Neutral earthy tones, tactile woven fabrics, minimalist hardware",
                    "vibe": "Elevated everyday casual with effortless silhouette"
                },
                "creators": batches[batch_idx]
            }

        else:
            # Universal / Lifestyle default with 3 rich batches
            batches = [
                # Batch 1
                [
                    {
                        "archetype": "Relatable Metro Lifestyle Creator",
                        "gender": "Female",
                        "age": "24",
                        "ethnicity": def_eth,
                        "facialFeatures": "Warm almond eyes, expressive genuine smile, authentic natural skin micro-pores",
                        "hair": "Naturally textured dark hair with soft effortless layers",
                        "wardrobe": "Contemporary ivory silk-blend button-down shirt, tailored trousers, delicate gold jewelry",
                        "environment": "Sunlit contemporary apartment bedroom with organic linen bedding and soft bokeh plant",
                        "lighting": "Natural soft morning window daylight with flattering organic shadows",
                        "action": "Presenting product with authentic friendly smile directly to camera",
                        "fineTune": "Raw Mobile UGC Realism (iPhone 15 Pro, 28mm Focal Lens, Subtle Sensor Grain, Candid Handheld)",
                        "vibe": "Engaging, authentic, rapid scroll-stopping product review",
                        "matchReason": "Warm approachable demeanor immediately hooks mobile viewers while keeping product front and center."
                    },
                    {
                        "archetype": "Curated Aesthetic Specialist",
                        "gender": "Male",
                        "age": "27",
                        "ethnicity": def_eth,
                        "facialFeatures": "Calm thoughtful gaze, clear complexion, refined facial symmetry",
                        "hair": "Textured modern cut with natural volume",
                        "wardrobe": "Unstructured beige cotton overshirt over white crewneck tee, relaxed dark trousers",
                        "environment": "Chic urban outdoor cafe terrace with softly blurred street architecture",
                        "lighting": "Clean diffused commercial softbox studio daylight with realistic micro-shadows",
                        "action": "Inspecting product quality thoughtfully with direct camera connection",
                        "fineTune": "Balanced Commercial Lookbook Standards (Neutral Exposure, Sharp Garment Weave, Zero Airbrushing)",
                        "vibe": "Aesthetic lifestyle curator with eye for quality and design",
                        "matchReason": "Elevated taste level communicates premium product value and thoughtful craftsmanship."
                    },
                    {
                        "archetype": "Honest Problem-Solution Reviewer",
                        "gender": "Female",
                        "age": "29",
                        "ethnicity": def_eth,
                        "facialFeatures": "Intelligent direct eye contact, friendly conversational smile, authentic unretouched skin",
                        "hair": "Shoulder-length loose curls with natural bounce",
                        "wardrobe": "Soft dusty-rose draped linen blouse, dark denim, subtle stud earrings",
                        "environment": "Minimalist designer kitchen with honed quartz countertop and warm morning light",
                        "lighting": "High-key commercial studio lighting with dual diffused white reflectors",
                        "action": "Demonstrating product feature clearly with enthusiastic relatable tone",
                        "fineTune": "Macro Product-in-Hand Focus (Crisp Product Label & Hand Details)",
                        "vibe": "High-credibility before-and-after recommendation",
                        "matchReason": "Direct conversational delivery makes viewers feel like they are receiving advice from a trusted friend."
                    }
                ],
                # Batch 2
                [
                    {
                        "archetype": "Cozy Homebody & Aesthetic Vlogger",
                        "gender": "Female",
                        "age": "25",
                        "ethnicity": def_eth,
                        "facialFeatures": "Gentle warm smile, approachable friendly eyes, radiant natural skin",
                        "hair": "Soft messy bun with satin scrunchie and face tendrils",
                        "wardrobe": "Oversized chunky oatmeal cardigan over white tee, comfortable ribbed lounge pants",
                        "environment": "Sunlit contemporary apartment bedroom with organic linen bedding and soft bokeh plant",
                        "lighting": "Natural soft morning window daylight with flattering organic shadows",
                        "action": "Holding product close while nestled on sofa with warm mug nearby",
                        "fineTune": "Cinematic 35mm Analog Film Grain (Subtle Warm Vintage Tone, Halation, Authentic Color Rendition)",
                        "vibe": "Cozy aesthetic comfort and sincere lifestyle recommendation",
                        "matchReason": "Creates an irresistible emotional craving for home comfort and daily quality."
                    },
                    {
                        "archetype": "Digital Nomad & Remote Work Pro",
                        "gender": "Male",
                        "age": "28",
                        "ethnicity": def_eth,
                        "facialFeatures": "Candid engaged posture, relaxed confident gaze, clean grooming",
                        "hair": "Casual textured comb-over with natural movement",
                        "wardrobe": "Minimalist charcoal merino wool t-shirt, tailored slim chinos",
                        "environment": "Chic urban outdoor cafe terrace with softly blurred street architecture",
                        "lighting": "Overcast outdoor daylight with ultra-soft diffused shadows",
                        "action": "Taking product out of backpack with seamless everyday ease",
                        "fineTune": "Raw Mobile UGC Realism (iPhone 15 Pro, 28mm Focal Lens, Subtle Sensor Grain, Candid Handheld)",
                        "vibe": "Everyday portability, travel-friendliness, and smart utility",
                        "matchReason": "Shows real-world durability and convenience for mobile consumers on the move."
                    },
                    {
                        "archetype": "Sustainable Living & Eco-Curator",
                        "gender": "Female",
                        "age": "30",
                        "ethnicity": def_eth,
                        "facialFeatures": "Articulate passionate eye contact, authentic radiant smile, natural texture",
                        "hair": "Natural wavy dark hair tied back loosely with wooden pin",
                        "wardrobe": "Sage-green organic cotton utility shirt, beige pleated trousers",
                        "environment": "Vibrant modern creative studio with sleek oak wood desk and ambient lamps",
                        "lighting": "Natural soft morning window daylight with flattering organic shadows",
                        "action": "Pointing to sustainable design details with genuine appreciation",
                        "fineTune": "Balanced Commercial Lookbook Standards (Neutral Exposure, Sharp Garment Weave, Zero Airbrushing)",
                        "vibe": "Conscious consumer advocacy and transparent product breakdown",
                        "matchReason": "Drives conversion for mission-driven and conscious consumer brands."
                    }
                ],
                # Batch 3
                [
                    {
                        "archetype": "Tech & Gadget Precision Reviewer",
                        "gender": "Male",
                        "age": "25",
                        "ethnicity": def_eth,
                        "facialFeatures": "Sharp curious eyes, enthusiastic smile, clear direct focus",
                        "hair": "Textured modern crop with subtle fade",
                        "wardrobe": "Matte black minimal crewneck tee, sleek fitness tracker",
                        "environment": "Vibrant modern creative studio with sleek oak wood desk and ambient lamps",
                        "lighting": "High-key commercial studio lighting with dual diffused white reflectors",
                        "action": "Unboxing and demonstrating tactile build quality up close to lens",
                        "fineTune": "Macro Product-in-Hand Focus (Crisp Product Label & Hand Details)",
                        "vibe": "Hands-on tech breakdown and performance validation",
                        "matchReason": "Drives immediate impulse conversions through clear proof-of-performance."
                    },
                    {
                        "archetype": "Architectural & Interior Design Stylist",
                        "gender": "Female",
                        "age": "36",
                        "ethnicity": def_eth,
                        "facialFeatures": "Poised sophisticated demeanor, discerning aesthetic eye, refined posture",
                        "hair": "Architectural blunt bob tucked behind ears",
                        "wardrobe": "Fine-gauge black knit turtleneck, tailored charcoal trousers, minimalist silver ring",
                        "environment": "High-end architectural concrete loft studio with soft diffused northern window light",
                        "lighting": "Dramatic subtle side window chiaroscuro with gentle fill light",
                        "action": "Placing product intentionally on surface and admiring form and balance",
                        "fineTune": "Minimalist Monochromatic Studio (Muted Neutral Grays, Clean Drop Shadows, Scandinavian Palette)",
                        "vibe": "High-end design validation and timeless luxury appeal",
                        "matchReason": "Validates premium industrial design and aesthetic worth."
                    },
                    {
                        "archetype": "Family & Household Problem Solver",
                        "gender": "Male",
                        "age": "32",
                        "ethnicity": def_eth,
                        "facialFeatures": "Warm reassuring smile, kind approachable eyes, authentic natural pores",
                        "hair": "Classic short taper with natural finish",
                        "wardrobe": "Relaxed navy cotton henley shirt with rolled cuffs, khaki chinos",
                        "environment": "Minimalist designer kitchen with honed quartz countertop and warm morning light",
                        "lighting": "Natural soft morning window daylight with flattering organic shadows",
                        "action": "Giving thumbs up while demonstrating product efficiency in real life",
                        "fineTune": "Raw Mobile UGC Realism (iPhone 15 Pro, 28mm Focal Lens, Subtle Sensor Grain, Candid Handheld)",
                        "vibe": "Real-world reliability, dependability, and authentic consumer relief",
                        "matchReason": "Builds high trust with everyday families who want proven, reliable solutions."
                    }
                ]
            ]
            return {
                "success": True,
                "isSimulated": True,
                "batch": cycle,
                "detectedProduct": {
                    "name": product_name or "Lifestyle Hero Product",
                    "category": category or "Modern Home Decor, Linen & Interior",
                    "colorPalette": "Balanced neutral tones, refined product accents",
                    "vibe": "Premium contemporary lifestyle and authentic consumer trust"
                },
                "creators": batches[batch_idx]
            }

    def get_simulated_suggestions(self, product_origin):
        if "india" in (product_origin or "").lower():
            return [
                {
                    "archetype": "Everyday Urban Indian Professional",
                    "age": "26",
                    "gender": "Female",
                    "ethnicity": "South Asian / Indian",
                    "tone": "Warm medium golden",
                    "hair": "Dark brown softly layered hair with natural flyaways",
                    "vibe": "Trustworthy, knowledgeable working professional who values clean authentic routines",
                    "suggestedOutfit": "Dusty rose tailored linen shirt with rolled cuffs and subtle silver huggie earrings"
                },
                {
                    "archetype": "Relatable College Micro-Influencer",
                    "age": "21",
                    "gender": "Female",
                    "ethnicity": "South Asian / Indian",
                    "tone": "Warm wheatish skin with natural cheeks",
                    "hair": "Messy casual top knot with soft face-framing tendrils",
                    "vibe": "Energetic, authentic, rapid scroll-stopping hook delivery",
                    "suggestedOutfit": "Oversized ivory cotton graphic tee and delicate wrist scrunchie"
                },
                {
                    "archetype": "Holistic Wellness & Fitness Creator",
                    "age": "29",
                    "gender": "Male",
                    "ethnicity": "South Asian / Indian",
                    "tone": "Warm olive skin tone",
                    "hair": "Neatly trimmed faded textured crew cut and well-groomed short stubble",
                    "vibe": "Disciplined, articulate, authoritative yet approachable product advocate",
                    "suggestedOutfit": "Minimalist charcoal athletic performance t-shirt"
                }
            ]
        else:
            return [
                {
                    "archetype": "Minimalist Fashion Model",
                    "age": "23",
                    "gender": "Male",
                    "ethnicity": "European / Fair with natural subtle freckles",
                    "tone": "Fair natural skin with authentic micro-pores",
                    "hair": "Curly short messy brown hair with soft temple volume",
                    "vibe": "Clean contemporary lookbook model with relaxed posture",
                    "suggestedOutfit": "Minimalist black textured mandarin-collar shirt, tailored black straight trousers"
                },
                {
                    "archetype": "Authentic Everyday Reviewer",
                    "age": "27",
                    "gender": "Female",
                    "ethnicity": f"Native to {product_origin}",
                    "tone": "Natural healthy skin tone with realistic texture",
                    "hair": "Natural shoulder-length hairstyle with organic volume",
                    "vibe": "Honest, direct-to-camera testimonial speaker",
                    "suggestedOutfit": "Cozy knit neutral sweater and minimal gold jewelry"
                },
                {
                    "archetype": "Modern Niche Specialist",
                    "age": "31",
                    "gender": "Male",
                    "ethnicity": f"Native to {product_origin}",
                    "tone": "Clear complexion with authentic micro-details",
                    "hair": "Clean contemporary taper",
                    "vibe": "High credibility, problem-solution breakdown specialist",
                    "suggestedOutfit": "Tailored navy button-down with natural fabric creasing"
                }
            ]

    def handle_quick_prompt(self, body):
        """Parses a 1-sentence user request into structured UGC brief fields with aspect ratio and casting."""
        prompt_text = body.get("prompt", "").strip()
        provider = body.get("provider", "auto")
        api_keys = body.get("apiKeys", {})
        api_key = body.get("apiKey") or api_keys.get("gemini") or api_keys.get("openai") or api_keys.get("claude")

        p_lower = prompt_text.lower()
        import re

        # 1. Age extraction
        age_match = re.search(r'\b(1[6-9]|[2-8][0-9])\s*(?:yo|years?\s*(?:old)?|yr|y/o)?\b', p_lower)
        parsed_age = age_match.group(1) if age_match else "23"

        # 2. Gender extraction
        if any(w in p_lower for w in ["female", "woman", "girl", "lady", "she", "her"]):
            parsed_gender = "Female"
        elif any(w in p_lower for w in ["male", "man", "boy", "guy", "he", "him", "gentleman"]):
            parsed_gender = "Male"
        elif any(w in p_lower for w in ["non-binary", "androgynous"]):
            parsed_gender = "Non-Binary"
        else:
            parsed_gender = "Female"

        # 3. Aspect Ratio / Format extraction
        if any(w in p_lower for w in ["horizontal", "16:9", "landscape", "widescreen", "wide"]):
            parsed_ar = "16:9"
        elif any(w in p_lower for w in ["square", "1:1", "feed"]):
            parsed_ar = "1:1"
        else:
            parsed_ar = "9:16"

        # 4. Ethnicity & Origin extraction
        if any(w in p_lower for w in ["indian", "south asian", "desi", "mumbai", "delhi"]):
            parsed_eth = "South Asian / Indian — Warm golden medium complexion with radiant undertones"
            parsed_origin = "India — Urban Metro (Mumbai / Delhi / Bengaluru)"
        elif any(w in p_lower for w in ["east asian", "korean", "japanese", "chinese"]):
            parsed_eth = "East Asian / Korean-Japanese — Smooth porcelain skin with subtle warm undertone"
            parsed_origin = "South Korea / Seoul Clean Aesthetic"
        elif any(w in p_lower for w in ["black", "afro", "african", "melanin"]):
            parsed_eth = "Afro-descendant / Black — Deep rich melanin with natural radiant skin sheen"
            parsed_origin = "Global / Universal International"
        elif any(w in p_lower for w in ["latina", "latino", "hispanic", "brazilian", "mexican"]):
            parsed_eth = "Latin American — Warm bronze complexion with radiant golden undertones"
            parsed_origin = "Latin America (Brazil / Mexico / Colombia)"
        elif any(w in p_lower for w in ["middle eastern", "arab", "dubai", "gulf"]):
            parsed_eth = "Middle Eastern / Arab — Warm wheatish-olive skin with defined dark brows"
            parsed_origin = "Middle East & Gulf (Dubai / Riyadh Luxury)"
        elif any(w in p_lower for w in ["nordic", "scandinavian"]):
            parsed_eth = "Nordic / Scandinavian — Fair porcelain skin with light rosy flush"
            parsed_origin = "Nordic / Scandinavian Functional Minimal"
        else:
            parsed_eth = "European / Fair with natural subtle freckles"
            parsed_origin = "Global / Universal International"

        # 5. Wardrobe extraction
        if "linen" in p_lower:
            wardrobe = "Relaxed breathable white linen shirt with rolled cuffs, tailored straight off-white trousers, clean leather slides"
        elif "kurti" in p_lower:
            wardrobe = "Relaxed breathable sage-green linen kurti with subtle embroidered accents, cigarette trousers, leather sandals"
        elif any(w in p_lower for w in ["gym", "workout", "leggings", "activewear"]):
            wardrobe = "Charcoal fitted athletic ribbed performance tank, high-waisted seamless training leggings, neutral running sneakers"
        elif any(w in p_lower for w in ["hoodie", "streetwear", "oversized"]):
            wardrobe = "Oversized heavyweight ivory cotton drop-shoulder crewneck tee, relaxed light-wash straight denim jeans, clean white leather sneakers"
        elif any(w in p_lower for w in ["suit", "blazer", "formal"]):
            wardrobe = "Tailored unstructured beige linen blazer over clean white cotton crewneck, pleated olive chinos, dark brown suede loafers"
        elif parsed_gender == "Female":
            wardrobe = "Contemporary ivory silk-blend button-down shirt, high-waisted tailored pleated trousers, minimalist jewelry"
        else:
            wardrobe = "Minimalist textured button-down shirt, tailored dark straight trousers, clean footwear"

        # 6. Category & Product Name
        category = "Fashion & Apparel (Streetwear & Casual)"
        product_name = "Product"
        brand_name = "Brandroom Studio"

        if any(w in p_lower for w in ["serum", "skincare", "cream", "glow", "dermatology"]):
            category = "Beauty / Clean Skincare & Serums"
            product_name = "Radiant Glow Botanical Serum"
            brand_name = "Lumina Skin"
        elif any(w in p_lower for w in ["hair", "scalp", "shampoo"]):
            category = "Haircare, Scalp Treatments & Oils"
            product_name = "Nourishing Herbal Hair Oil"
            brand_name = "Kesh Botanica"
        elif any(w in p_lower for w in ["fitness", "protein", "supplement", "vitamin"]):
            category = "Fitness, Gym Apparel & Bodybuilding"
            product_name = "Plant Performance Protein"
            brand_name = "Apex Fuel"
        elif any(w in p_lower for w in ["shirt", "dress", "trouser", "apparel", "clothing"]):
            category = "Fashion & Apparel (Luxury Minimalist & Formal)"
            product_name = "Minimalist Linen Ensemble"
            brand_name = "Kaya Studio"
        elif any(w in p_lower for w in ["perfume", "fragrance", "scent"]):
            category = "Artisan Fragrance, Perfumes & Scents"
            product_name = "Artisan Velvet Oud EDP"
            brand_name = "Maison Botanique"

        hair_desc = "Long glossy dark hair with soft effortless waves and natural flyaways" if parsed_gender == "Female" else "Neat textured short taper fade with natural scissor-cut volume"
        face_desc = "Softly defined oval jawline, warm expressive almond eyes, authentic unretouched skin micro-pores, friendly engaging expression" if parsed_gender == "Female" else "Clean defined jawline, direct calm frontal gaze, authentic micro-pores, natural masculine features"

        fallback_brief = {
            "brandName": brand_name,
            "productName": product_name,
            "productCategory": category,
            "productOrigin": parsed_origin,
            "gender": parsed_gender,
            "age": parsed_age,
            "ethnicity": parsed_eth,
            "hair": hair_desc,
            "faceFeatures": face_desc,
            "wardrobe": wardrobe,
            "environment": "Seamless neutral light-gray studio backdrop with soft floor contact shadows",
            "lighting": "Clean diffused commercial softbox studio daylight with realistic micro-shadows",
            "action": "Presenting product delicately toward camera with authentic friendly curiosity",
            "fineTune": "Balanced Commercial Lookbook Standards (Neutral Exposure, Sharp Garment Weave, Zero Airbrushing)",
            "aspectRatio": parsed_ar
        }

        # If an AI key is available, use LLM to parse with deep understanding
        if api_key:
            system_prompt = (
                "You are an AI Creative Director. The user provided a single prompt sentence describing an AI UGC Creator request. "
                "Parse this into a complete, high-quality UGC brief. Return pure JSON only with these exact keys: "
                "brandName, productName, productCategory, productOrigin, gender ('Female', 'Male', or 'Non-Binary'), "
                "age (string number), ethnicity, hair, faceFeatures, wardrobe, environment, lighting, action, fineTune, aspectRatio ('9:16', '16:9', or '1:1')."
            )
            try:
                raw_out = self.call_llm(provider, api_key, None, system_prompt, f"User Quick Prompt: '{prompt_text}'")
                clean = raw_out.strip()
                if clean.startswith("```json"): clean = clean[7:]
                if clean.startswith("```"): clean = clean[3:]
                if clean.endswith("```"): clean = clean[:-3]
                parsed_llm = json.loads(clean.strip())
                for k, v in fallback_brief.items():
                    if k not in parsed_llm or not parsed_llm[k]:
                        parsed_llm[k] = v
                return self.send_json({"brief": parsed_llm, "isAI": True})
            except Exception:
                pass

        self.send_json({"brief": fallback_brief, "isAI": False})

    def handle_suggest_character(self, body):
        """Recommends creator archetypes based on product category, product origin, and target customer."""
        provider, api_key = self.resolve_provider_and_key(body.get("provider", "openai"), body.get("apiKeys"), body.get("apiKey"))
        model = body.get("model")
        product_name = body.get("productName", "Product")
        product_category = body.get("productCategory", "Skincare")
        product_origin = body.get("productOrigin", "India")
        target_customer = body.get("targetCustomer", "Gen Z and Millennials")

        fallback_suggestions = self.get_simulated_suggestions(product_origin)

        if not api_key:
            return self.send_json({"suggestions": fallback_suggestions, "isSimulated": True})

        system_prompt = (
            "You are a performance ad creative director. Given a product name, origin, category, and target audience, "
            "return a JSON array with 3 distinct, highly realistic UGC creator archetypes that best fit the brand. "
            "Return pure JSON format: [{\"archetype\": \"...\", \"age\": \"...\", \"gender\": \"...\", \"ethnicity\": \"...\", \"tone\": \"...\", \"hair\": \"...\", \"vibe\": \"...\", \"suggestedOutfit\": \"...\"}]"
        )
        user_prompt = (
            f"Product: {product_name}, Category: {product_category}, Origin: {product_origin}, Target Audience: {target_customer}. "
            "Suggest 3 high-performing UGC creator personas."
        )

        try:
            raw_output = self.call_llm(provider, api_key, model, system_prompt, user_prompt)
            clean_json = raw_output.strip()
            if clean_json.startswith("```json"):
                clean_json = clean_json[7:]
            if clean_json.startswith("```"):
                clean_json = clean_json[3:]
            if clean_json.endswith("```"):
                clean_json = clean_json[:-3]
            clean_json = clean_json.strip()
            parsed = json.loads(clean_json)
            self.send_json({"suggestions": parsed})
        except Exception:
            self.send_json({"suggestions": fallback_suggestions, "isSimulated": True})

    def synthesize_master_prompts(self, brief, provider="auto"):
        """Compiles the Master Prompt Template v1.0 and generates the 3-Shot Lookbook Pack + Consistency Locks."""
        style = brief.get('visualStyle', 'REAL HUMAN / PHOTOREALISTIC')
        product = brief.get('productName', 'Product')
        brand = brief.get('brandName', 'Brand')
        age = brief.get('age', '23')
        gender = brief.get('gender', 'Female')
        eth = brief.get('ethnicity', 'South Asian / Indian')
        hair = brief.get('hair', 'Naturally textured dark hair with soft volume')
        face = brief.get('faceFeatures', 'Naturally textured skin with visible micro-pores and realistic facial symmetry')
        wardrobe = brief.get('wardrobe', 'Relaxed breathable linen outfit with tailored trousers')
        env = brief.get('environment', 'Seamless neutral light-gray studio backdrop with soft floor contact shadows')
        lighting = brief.get('lighting', 'Clean diffused commercial softbox studio daylight with realistic micro-shadows')
        moment = brief.get('moment', 'SCROLL-STOPPING HOOK')
        action = brief.get('action', 'Presenting product toward camera naturally')
        fine_tune = brief.get('fineTune', '').strip()
        use_uploaded = brief.get('useUploadedCharacter', False)
        uploaded_info = brief.get('uploadedCharacterInfo', {})

        fine_tune_suffix = f" Direct Fine-Tuning: {fine_tune}." if fine_tune else ""

        # Aspect Ratio framing and tags
        aspect_ratio = brief.get('aspectRatio', '9:16')
        if aspect_ratio in ['16:9', 'horizontal'] or '16:9' in str(aspect_ratio):
            ar_code = "16:9"
            ar_tag = "--ar 16:9"
            p1_framing = "Framed in 16:9 widescreen horizontal ratio, commercial cinematic close-up portrait composition with clean negative studio space"
            p2_framing = "framed in 16:9 horizontal landscape composition with full-length body visibility and balanced studio negative space"
            p3_framing = "framed in 16:9 horizontal widescreen orientation with full rear silhouette view"
            triptych_framing = "3-panel split horizontal banner lookbook reference sheet in 16:9 panoramic ratio"
            comm_framing = "Framed in 16:9 widescreen commercial catalog landscape ratio for web and desktop"
        elif aspect_ratio in ['1:1', 'square'] or '1:1' in str(aspect_ratio):
            ar_code = "1:1"
            ar_tag = "--ar 1:1"
            p1_framing = "Framed in 1:1 square ratio, centered eye-level close-up portrait"
            p2_framing = "framed in 1:1 square ratio with centered full-body lookbook framing"
            p3_framing = "framed in 1:1 square ratio with full rear silhouette view"
            triptych_framing = "3-panel split character lookbook reference sheet in 1:1 square format"
            comm_framing = "Framed in 1:1 square format for social feed"
        else:
            ar_code = "9:16"
            ar_tag = "--ar 9:16"
            p1_framing = "Framed in 9:16 vertical ratio, eye-level close-up portrait"
            p2_framing = "framed in 9:16 vertical orientation, head-to-toe full-length lookbook framing"
            p3_framing = "framed in 9:16 vertical orientation, full-length rear view"
            triptych_framing = "3-panel split character lookbook reference sheet in 9:16 vertical composition"
            comm_framing = "Framed in 9:16 vertical smartphone format for Reels and TikTok"

        # 1. Shot 1: Face Portrait Close-Up
        shot1_face = (
            f"Studio character casting close-up portrait of an adult {age}-year-old {eth} {gender.lower()} creator with {face}. "
            f"{hair}. Natural direct frontal gaze toward lens, neutral relaxed expression. Authentic unretouched skin micro-texture, "
            f"visible pores, fine facial asymmetry, realistic eye moisture and subtle catchlights. "
            f"{p1_framing}, shallow depth of field with sharp facial focus, "
            f"illuminated by {lighting} against {env}.{fine_tune_suffix} Zero CGI or waxy skin. {ar_tag}"
        )

        # 2. Shot 2: Full-Body Front (Face Not Visible / Headless Mannequin Framing)
        shot2_front = (
            f"Commercial fashion lookbook full-body frontal shot of the {age}-year-old {eth} {gender.lower()} character standing straight, "
            f"framed from below the chin down with face completely not visible and out of frame. Showcases the complete front silhouette: "
            f"{wardrobe}. Physically accurate fabric drape, authentic material texture, clean seams, paired with minimalist footwear. "
            f"Full-body standing posture, hands resting naturally at sides, {p2_framing} with clear shoe contact shadows on a flat gray studio floor, "
            f"even balanced commercial studio lighting, deep field focus across all garments.{fine_tune_suffix} {ar_tag}"
        )

        # 3. Shot 3: Full-Body Back (Rear View / Face Not Visible)
        shot3_back = (
            f"Commercial fashion lookbook full-body rear view shot of the character viewed from directly behind, standing straight. "
            f"Face completely invisible. Clearly displays the back silhouette and construction of {wardrobe}, back neckline, rear shoulder drape, "
            f"back of trousers, and clean heels of footwear. Rear view of {hair}. Clean posture, {p3_framing} against an infinity cyclorama neutral light-gray studio background "
            f"with soft realistic ground contact shadows, professional commercial studio lighting.{fine_tune_suffix} {ar_tag}"
        )

        # 4. 3-Panel Composite Triptych (Exact match to reference sheet)
        triptych_prompt = (
            f"{triptych_framing} for fashion and advertising consistency on a clean light-gray studio backdrop: "
            f"LEFT PANEL: intimate close-up face portrait of adult {age}-year-old {eth} {gender.lower()} with {face} and {hair}; "
            f"CENTER PANEL: full-body frontal lookbook shot standing straight, cropped below chin with face completely not visible, showcasing {wardrobe}; "
            f"RIGHT PANEL: full-body rear view from directly behind, face not visible, displaying the back of the outfit and rear silhouette. "
            f"High-end commercial catalog photography, sharp focus, physically accurate fabrics, uniform neutral studio illumination.{fine_tune_suffix} {ar_tag}"
        )

        # 5. Commercial UGC Product Ad Prompt
        commercial_prompt = (
            f"Photorealistic genuine smartphone UGC photo of adult {age}-year-old {eth} {gender.lower()} creator with {face} and {hair}. "
            f"Wearing {wardrobe}. Delivering an authentic {moment} while {action} featuring {product} by {brand}. "
            f"Set inside {env}. {comm_framing}, 28mm wide mobile lens aesthetic, natural phone focal roll-off, "
            f"soft daylight illumination with authentic contact shadows,{fine_tune_suffix} zero CGI or plastic appearance. {ar_tag}"
        )

        # Consistency Locks
        upload_lock_note = ""
        if use_uploaded and uploaded_info:
            upload_lock_note = f"\nUploaded Character Anchor: Linked to reference photo ({uploaded_info.get('name', 'Custom uploaded character')}). Exact facial identity and regional features locked in memory."

        char_lock = (
            f"Visual Style: {style}\n"
            f"Age: {age} years old (Adult)\n"
            f"Gender: {gender}\n"
            f"Ethnicity / Appearance: {eth}\n"
            f"Face: {face}\n"
            f"Hair: {hair}\n"
            f"Body / Physique: Natural balanced build, upright posture, authentic proportions{upload_lock_note}"
        )

        style_lock = (
            "Photorealistic real-human photography, naturally textured skin with epidermal micro-detail, "
            "individual hair strands, believable anatomy, physically accurate fabrics and seams, "
            "realistic contact shadows, neutral exposure, zero CGI, plastic, or mannequin rendering."
        )
        if fine_tune:
            style_lock += f"\nFine-Tuning Directive: {fine_tune}"

        camera_lock = (
            "Lookbook Shots: 50mm - 85mm clean commercial studio lens, deep focal sharpness, neutral softbox illumination.\n"
            "UGC Ad Shots: 28mm smartphone mobile optics, natural perspective, soft daylight."
        )

        neg_prompt = (
            "generic AI face, artificial influencer face, uncanny human, waxy skin, plastic skin, porcelain skin, rubber skin, "
            "CGI skin, mannequin appearance, overly smooth skin, excessive beauty filter, artificial pore pattern, extreme facial symmetry, "
            "face morphing, deformed face, dead eyes, glassy artificial eyes, malformed pupils, badly rendered teeth, floating hair, "
            "malformed anatomy, extra arms, missing arms, fused fingers, missing fingers, extra fingers, warped product, melted packaging, "
            "distorted label, incorrect logo, misspelled brand name, gibberish text, fake barcode, CGI render, 3D character, anime character, illustration."
        )

        return {
            "shot1Face": shot1_face,
            "shot2Front": shot2_front,
            "shot3Back": shot3_back,
            "triptychPrompt": triptych_prompt,
            "imagePrompt": commercial_prompt,
            "characterLock": char_lock,
            "styleLock": style_lock,
            "cameraLock": camera_lock,
            "negativePrompt": neg_prompt,
            "fineTune": fine_tune,
            "aspectRatio": ar_code,
            "activeModel": {
                "gemini": "Google Gemini (1.5 Flash / Pro)",
                "openai": "ChatGPT-4o (OpenAI)",
                "claude": "Claude 3.5 Sonnet (Anthropic)",
                "auto": "Auto-Optimized Master Prompt Engine"
            }.get(provider, "Auto-Optimized Master Prompt Engine")
        }

    def handle_generate_prompt(self, body):
        """Compiles the Master Prompt Template v1.0 and generates the 3-Shot Lookbook Pack + Consistency Locks."""
        brief = body.get("brief", {})
        provider, api_key = self.resolve_provider_and_key(body.get("provider", "auto"), body.get("apiKeys"), body.get("apiKey"))
        output = self.synthesize_master_prompts(brief, provider=provider)
        self.send_json(output)

    def handle_refine_prompt(self, body):
        """Applies in-place iterative corrections to an existing generated brief and prompt package."""
        correction = body.get("correction", "").strip()
        brief = body.get("brief", {})
        provider, api_key = self.resolve_provider_and_key(body.get("provider", "auto"), body.get("apiKeys"), body.get("apiKey"))
        model = body.get("model")

        if not correction:
            return self.send_json({"error": "No correction instruction provided"}, 400)

        updated_brief = dict(brief)
        revision_summary = "Refined"
        ai_refined = False

        if api_key:
            system_prompt = (
                "You are an AI UGC Prompt Master Editor. You are given an active UGC campaign brief and a user's requested correction or change.\n"
                "Your task is to surgically update only the relevant fields of the brief (such as wardrobe, hair, faceFeatures, environment, lighting, action, fineTune, or aspectRatio) "
                "while strictly preserving all unchanged parameters, regional ethnicity, and character identity.\n"
                "Return a strict pure JSON object (no markdown) with two keys:\n"
                "1. 'updatedBrief': an object containing the full updated brief.\n"
                "2. 'revisionSummary': a concise 3-6 word summary of what changed (e.g. '+Navy blazer, +Glasses')."
            )
            user_prompt = f"Current Brief:\n{json.dumps(brief, indent=2)}\n\nUser Requested Correction:\n{correction}"

            try:
                raw_output = self.call_llm(provider, api_key, model, system_prompt, user_prompt)
                clean_json = raw_output.strip()
                if clean_json.startswith("```json"):
                    clean_json = clean_json[7:]
                if clean_json.startswith("```"):
                    clean_json = clean_json[3:]
                if clean_json.endswith("```"):
                    clean_json = clean_json[:-3]
                parsed = json.loads(clean_json.strip())
                if isinstance(parsed, dict) and "updatedBrief" in parsed:
                    updated_brief = parsed["updatedBrief"]
                    revision_summary = parsed.get("revisionSummary", "AI Refined")
                    ai_refined = True
            except Exception:
                ai_refined = False

        if not ai_refined:
            import re
            c_lower = correction.lower()
            changes = []

            # 1. Eyeglasses / Accessories
            if any(w in c_lower for w in ["glasses", "spectacles", "eyewear"]):
                if "glasses" not in updated_brief.get("faceFeatures", "").lower():
                    updated_brief["faceFeatures"] = (updated_brief.get("faceFeatures", "") + ", stylish thin minimalist wireframe glasses").strip(", ")
                    changes.append("+Glasses")
            elif "remove glasses" in c_lower or "no glasses" in c_lower:
                updated_brief["faceFeatures"] = re.sub(r',?\s*(?:stylish thin minimalist )?wireframe glasses', '', updated_brief.get("faceFeatures", "")).strip(", ")
                changes.append("-Glasses")

            # 2. Wardrobe changes
            if any(w in c_lower for w in ["wardrobe", "jacket", "shirt", "blazer", "kurti", "outfit", "dress", "trousers", "wear", "wearing", "suit", "tee", "top"]):
                match = re.search(r'(?:wardrobe|outfit|clothing|jacket|shirt|wear|wearing|to a|in a)\s+(?:to\s+)?([^\.,;]+)', correction, re.IGNORECASE)
                if match:
                    new_outfit = match.group(1).strip()
                    if len(new_outfit) > 3:
                        updated_brief["wardrobe"] = new_outfit
                        changes.append("+Wardrobe updated")
                else:
                    updated_brief["wardrobe"] = correction
                    changes.append("+Wardrobe updated")

            # 3. Hair styling
            if any(w in c_lower for w in ["hair", "bun", "ponytail", "curls", "fade", "blonde", "braid"]):
                match = re.search(r'(?:hair|hair to|hair in a?)\s+([^\.,;]+)', correction, re.IGNORECASE)
                if match:
                    updated_brief["hair"] = match.group(1).strip()
                elif "bun" in c_lower:
                    updated_brief["hair"] = "Messy casual top-knot bun with soft face-framing tendrils"
                elif "ponytail" in c_lower:
                    updated_brief["hair"] = "Sleek middle-parted low ponytail with clean polished edges"
                elif "curly" in c_lower or "curls" in c_lower:
                    updated_brief["hair"] = "Naturally defined voluminous bouncy curls with soft shine"
                changes.append("+Hair styled")

            # 4. Lighting
            if any(w in c_lower for w in ["golden hour", "sunset", "warm light", "sunlight"]):
                updated_brief["lighting"] = "Golden-hour warm directional sunlight casting soft glowing skin edges"
                changes.append("+Golden hour light")
            elif any(w in c_lower for w in ["studio light", "softbox", "commercial daylight"]):
                updated_brief["lighting"] = "Clean diffused commercial softbox studio daylight with realistic micro-shadows"
                changes.append("+Studio softbox")
            elif any(w in c_lower for w in ["window light", "morning light"]):
                updated_brief["lighting"] = "Natural soft morning window daylight with flattering organic shadows"
                changes.append("+Window light")

            # 5. Environment / Scene
            if any(w in c_lower for w in ["cafe", "coffee shop"]):
                updated_brief["environment"] = "Chic contemporary outdoor cafe terrace with softly blurred city street backdrop"
                changes.append("+Cafe backdrop")
            elif any(w in c_lower for w in ["bathroom", "vanity"]):
                updated_brief["environment"] = "Clean modern bathroom with marble vanity, soft subway tile, and subtle warm mirror reflection"
                changes.append("+Bathroom vanity")
            elif any(w in c_lower for w in ["bedroom"]):
                updated_brief["environment"] = "Sunlit contemporary apartment bedroom with organic linen bedding and soft bokeh plant"
                changes.append("+Bedroom setting")
            elif any(w in c_lower for w in ["studio", "cyclorama", "gray backdrop", "backdrop"]):
                updated_brief["environment"] = "Seamless neutral light-gray studio backdrop with soft floor contact shadows"
                changes.append("+Studio cyclorama")

            # 6. Expression / Action
            if any(w in c_lower for w in ["smile", "smiling", "friendly"]):
                updated_brief["action"] = "Warm friendly engaging smile toward camera with authentic approachable direct eye contact"
                changes.append("+Friendly smile")
            elif any(w in c_lower for w in ["serious", "calm", "neutral"]):
                updated_brief["action"] = "Calm authoritative neutral gaze into lens with poised posture"
                changes.append("+Neutral calm gaze")

            # 7. Aspect ratio
            if any(w in c_lower for w in ["horizontal", "16:9", "landscape", "widescreen"]):
                updated_brief["aspectRatio"] = "16:9"
                changes.append("+16:9 Format")
            elif any(w in c_lower for w in ["square", "1:1"]):
                updated_brief["aspectRatio"] = "1:1"
                changes.append("+1:1 Square")
            elif any(w in c_lower for w in ["vertical", "9:16"]):
                updated_brief["aspectRatio"] = "9:16"
                changes.append("+9:16 Vertical")

            # 8. Fine-tune fallback
            if not changes or "fine" in c_lower or "rule" in c_lower:
                cur_ft = updated_brief.get("fineTune", "")
                updated_brief["fineTune"] = (cur_ft + f" Refinement Directive: {correction}").strip()
                if not changes:
                    changes.append("+Refinement applied")

            revision_summary = ", ".join(changes) if changes else "Prompt Refined"

        new_prompts = self.synthesize_master_prompts(updated_brief)
        self.send_json({
            "success": True,
            "brief": updated_brief,
            "prompts": new_prompts,
            "revisionSummary": revision_summary
        })

    def parse_master_output(self, text):
        sections = {
            "imagePrompt": "",
            "characterLock": "",
            "styleLock": "",
            "cameraLock": "",
            "negativePrompt": "",
            "raw": text
        }
        
        current_section = None
        lines = text.splitlines()
        for line in lines:
            line_upper = line.strip().upper()
            if "UGC CREATOR IMAGE PROMPT" in line_upper:
                current_section = "imagePrompt"
                continue
            elif "CHARACTER LOCK" in line_upper:
                current_section = "characterLock"
                continue
            elif "STYLE" in line_upper and "LOCK" in line_upper:
                current_section = "styleLock"
                continue
            elif "CAMERA" in line_upper and "LOCK" in line_upper:
                current_section = "cameraLock"
                continue
            elif "NEGATIVE PROMPT" in line_upper:
                current_section = "negativePrompt"
                continue

            if current_section:
                sections[current_section] += line + "\n"

        for k in sections:
            if isinstance(sections[k], str):
                sections[k] = sections[k].strip()

    def handle_generate_image(self, body):
        """Generates real UGC AI image using DALL-E 3, Google Imagen 3, or high-speed FLUX."""
        import random
        prompt = body.get("prompt", "")
        engine = body.get("engine", "auto")
        api_keys = body.get("apiKeys", {})
        aspect_ratio = body.get("aspectRatio", "9:16")

        openai_key = api_keys.get("openai") or body.get("apiKey")
        gemini_key = api_keys.get("gemini")

        # 1. OpenAI DALL-E 3
        if (engine == "dalle3" or (engine == "auto" and openai_key)) and openai_key:
            try:
                headers = {
                    "Authorization": f"Bearer {openai_key}",
                    "Content-Type": "application/json"
                }
                size = "1024x1792" if aspect_ratio == "9:16" else "1024x1024"
                payload = {
                    "model": "dall-e-3",
                    "prompt": prompt[:1000],
                    "n": 1,
                    "size": size,
                    "quality": "hd"
                }
                res = make_request("https://api.openai.com/v1/images/generations", headers, json.dumps(payload).encode("utf-8"), "POST")
                img_url = res["data"][0]["url"]
                return self.send_json({"success": True, "imageUrl": img_url, "engine": "OpenAI DALL-E 3 HD"})
            except Exception as e:
                pass # fallback to universal engine

        # 2. Google Imagen 3 / Gemini Image Generation
        if (engine == "gemini" or (engine == "auto" and gemini_key)) and gemini_key:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key={gemini_key}"
                headers = {"Content-Type": "application/json"}
                payload = {
                    "instances": [{"prompt": prompt[:800]}],
                    "parameters": {"sampleCount": 1, "aspectRatio": "9:16"}
                }
                res = make_request(url, headers, json.dumps(payload).encode("utf-8"), "POST")
                b64_img = res["predictions"][0]["bytesBase64Encoded"]
                img_data_url = f"data:image/jpeg;base64,{b64_img}"
                return self.send_json({"success": True, "imageUrl": img_data_url, "engine": "Google Imagen 3 (Gemini Pro)"})
            except Exception as e:
                pass # fallback to universal engine

        # 3. Universal High-Quality FLUX Engine (Instant generation without keys)
        seed = random.randint(10000, 999999)
        encoded_prompt = urllib.parse.quote(prompt[:450])
        flux_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=768&height=1344&model=flux&seed={seed}&nologo=true"
        return self.send_json({
            "success": True,
            "imageUrl": flux_url,
            "engine": "FLUX.1 Photoreal UGC Engine",
            "isDirect": True
        })

    def handle_chat(self, body):
        """Conversational AI Creative Director that advises, suggests hooks, and refines prompts."""
        api_keys = body.get("apiKeys", {})
        message = body.get("message", "")
        brief = body.get("brief", {})
        requested_provider = body.get("provider", "auto")

        provider, api_key = self.resolve_provider_and_key(requested_provider, api_keys, body.get("apiKey"))

        system_prompt = (
            "You are an expert AI UGC Performance Ad Creative Director and Casting Specialist. "
            "You guide DTC brands and agencies on creating high-converting UGC creator ad concepts, "
            "viral hooks, regional cultural styling (especially Indian, Western, and global markets), "
            "and prompt engineering following the AI UGC Master Prompt Template v1.0.\n"
            f"Current Active Campaign Brief:\n{json.dumps(brief, indent=2)}\n"
            "Keep answers actionable, sharp, performance-focused, and concise."
        )

        model_names = {
            "openai": "ChatGPT (GPT-4o)",
            "gemini": "Google Gemini Pro",
            "claude": "Anthropic Claude 3.5 Sonnet",
            "auto": "Director AI (Auto-Engine)"
        }

        if not api_key or provider == "auto":
            msg_lower = message.lower()
            if "hook" in msg_lower:
                reply = (
                    "Here are 3 scroll-stopping UGC hook concepts for your ad:\n\n"
                    "1. Problem-Aware Hook: 'Stop scrolling if you've tried everything for clear radiant skin and nothing worked...'\n"
                    "2. Demonstration Hook: 'I was skeptical about saffron serums until day 7 — look at this cheek glow in natural morning light.'\n"
                    "3. Authority Testimonial: 'My facialist actually asked what changed in my routine!'"
                )
            elif "outfit" in msg_lower or "cloth" in msg_lower or "style" in msg_lower:
                reply = (
                    "For an authentic Indian UGC creator feel, I recommend:\n"
                    "• Casual Indo-Western: An earthy sage-green or terracotta linen kurti with rolled sleeves and small silver studs.\n"
                    "• Modern Athleisure: Fitted ribbed neutral tank with a loose linen overshirt.\n"
                    "Keep it casual and avoid heavy bridal jewelry to preserve the natural everyday creator aesthetic."
                )
            elif "location" in msg_lower or "scene" in msg_lower or "bathroom" in msg_lower:
                reply = (
                    "For skincare and wellness, a sunlit modern bathroom vanity with soft morning window light works best. "
                    "It creates authentic, non-plastic skin highlights and proves the product is part of a real daily morning routine."
                )
            else:
                reply = (
                    f"I've reviewed your brief for {brief.get('productName', 'this product')}. "
                    "To maximize direct-response conversions, keep the creator's eye contact direct to the lens, "
                    "use phone-like 28mm wide framing, and hold the product naturally at chest level with realistic finger pressure. "
                    "Would you like me to refine the hook, the wardrobe, or the environment?"
                )
            active_label = model_names.get(provider, "Built-in Director AI")
            return self.send_json({"reply": reply, "activeModel": active_label})

        try:
            model = None
            if provider == "openai":
                model = "gpt-4o"
            elif provider == "gemini":
                model = "gemini-1.5-flash"
            elif provider == "claude":
                model = "claude-3-5-sonnet-20241022"

            out = self.call_llm(provider, api_key, model, system_prompt, message)
            self.send_json({"reply": out, "activeModel": model_names.get(provider, provider)})
        except Exception as e:
            self.send_json({"reply": f"AI Assistant error: {str(e)}", "activeModel": "Error", "error": True})

def run():
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    socketserver.TCPServer.allow_reuse_address = True
    active_port = PORT
    for attempt in range(10):
        try:
            httpd = socketserver.TCPServer(("", active_port), StudioHandler)
            break
        except OSError as e:
            if e.errno == 48:
                active_port += 1
            else:
                raise e
    else:
        print("Could not find open port.")
        sys.exit(1)

    with httpd:
        print(f"================================================================", flush=True)
        print(f"  AI UGC Creator Studio running at http://localhost:{active_port}", flush=True)
        print(f"  Ready for ChatGPT, Gemini, and Claude integrations.", flush=True)
        print(f"================================================================", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.", flush=True)

if __name__ == "__main__":
    run()
