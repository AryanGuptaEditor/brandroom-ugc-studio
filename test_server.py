"""
Unit tests for AI UGC Creator Studio API handlers
"""
import unittest
import json
from io import BytesIO
from server import StudioHandler

class MockRequest:
    def __init__(self, body_bytes):
        self.body_bytes = body_bytes

    def makefile(self, *args, **kwargs):
        return BytesIO(self.body_bytes)

def test_api():
    print("Testing Studio API Endpoints...")
    handler = StudioHandler.__new__(StudioHandler)

    # 1. Test handle_suggest_character for India
    print("1. Testing handle_suggest_character...")
    test_suggest_body = {
        "provider": "openai",
        "productName": "Ayurvedic Hair Oil",
        "productCategory": "Haircare",
        "productOrigin": "India",
        "targetCustomer": "Men and women with thinning hair"
    }
    
    # Run simulation path
    captured_json = []
    handler.send_json = lambda data, status=200: captured_json.append((data, status))
    handler.handle_suggest_character(test_suggest_body)
    
    res, status = captured_json[0]
    assert status == 200, f"Expected 200, got {status}"
    assert "suggestions" in res, "Expected suggestions key"
    assert len(res["suggestions"]) >= 2, "Expected at least 2 suggestions"
    print(f"   ✓ Suggestion test passed: Got {len(res['suggestions'])} creator archetypes for India.")

    # 2. Test handle_analyze_character (simulated vision)
    print("2. Testing handle_analyze_character...")
    captured_json.clear()
    test_analyze_body = {
        "provider": "openai",
        "imageBase64": "dummybase64string",
        "productCategory": "Beauty / Skincare",
        "productOrigin": "India"
    }
    handler.handle_analyze_character(test_analyze_body)
    res, status = captured_json[0]
    assert status == 200, f"Expected 200, got {status}"
    assert "origin" in res, "Expected origin key"
    assert "outfitRecommendations" in res, "Expected outfitRecommendations key"
    assert len(res["outfitRecommendations"]) >= 3, "Expected 3 outfit recommendations"
    print(f"   ✓ Vision analysis test passed: Detected '{res['origin']}' and {len(res['outfitRecommendations'])} outfits.")

    # 3. Test handle_generate_prompt (Template v1.0 5-part locked output)
    print("3. Testing handle_generate_prompt...")
    captured_json.clear()
    test_prompt_body = {
        "provider": "openai",
        "brief": {
            "brandName": "Kaya Botanical",
            "productName": "Saffron Glow Serum",
            "productCategory": "Beauty / Skincare",
            "productOrigin": "India",
            "platform": "Instagram Reels",
            "moment": "SCROLL-STOPPING HOOK",
            "gender": "Female",
            "age": "26",
            "ethnicity": "South Asian / Indian"
        }
    }
    handler.handle_generate_prompt(test_prompt_body)
    res, status = captured_json[0]
    assert status == 200, f"Expected 200, got {status}"
    # 4. Test handle_generate_image
    print("4. Testing handle_generate_image...")
    captured_json.clear()
    test_img_body = {
        "prompt": "Photorealistic UGC photo of Indian creator holding saffron serum",
        "engine": "auto",
        "apiKeys": {}
    }
    handler.handle_generate_image(test_img_body)
    res, status = captured_json[0]
    assert status == 200, f"Expected 200, got {status}"
    # 5. Test handle_chat
    print("5. Testing handle_chat...")
    captured_json.clear()
    test_chat_body = {
        "message": "Give me 3 viral hooks for saffron serum",
        "brief": {"productName": "Saffron Glow Serum"}
    }
    handler.handle_chat(test_chat_body)
    res, status = captured_json[0]
    assert status == 200, f"Expected 200, got {status}"
    assert "reply" in res, "Expected reply key"
    assert "activeModel" in res, "Expected activeModel key"
    print(f"   ✓ Chat test passed: Received response from '{res['activeModel']}'")

    # 6. Test handle_quick_prompt
    print("6. Testing handle_quick_prompt...")
    captured_json.clear()
    test_qp_body = {
        "prompt": "I need a 22yo Indian female creator in a white linen shirt reviewing skincare serum, vertical format"
    }
    handler.handle_quick_prompt(test_qp_body)
    res, status = captured_json[0]
    assert status == 200, f"Expected 200, got {status}"
    assert "brief" in res, "Expected brief key"
    brief = res["brief"]
    assert brief["gender"] == "Female", f"Expected Female, got {brief['gender']}"
    assert brief["age"] == "22", f"Expected 22, got {brief['age']}"
    assert brief["aspectRatio"] == "9:16", f"Expected 9:16, got {brief['aspectRatio']}"
    assert "Indian" in brief["ethnicity"], f"Expected Indian ethnicity, got {brief['ethnicity']}"
    print(f"   ✓ Quick Prompt test passed: Parsed {brief['gender']}, {brief['age']}yo, {brief['aspectRatio']}, {brief['ethnicity'][:25]}...")

    # 7. Test handle_generate_prompt with Horizontal 16:9
    print("7. Testing handle_generate_prompt with Horizontal 16:9...")
    captured_json.clear()
    test_h_body = {
        "provider": "openai",
        "brief": {
            "gender": "Female",
            "age": "22",
            "ethnicity": "South Asian / Indian",
            "productName": "Saffron Serum",
            "aspectRatio": "16:9"
        }
    }
    handler.handle_generate_prompt(test_h_body)
    res, status = captured_json[0]
    assert status == 200, f"Expected 200, got {status}"
    assert "--ar 16:9" in res["shot1Face"], f"Expected --ar 16:9 in prompt"
    assert res["aspectRatio"] == "16:9"
    print(f"   ✓ Aspect Ratio 16:9 test passed: Prompt contains '--ar 16:9' and horizontal framing.")

    # 8. Test handle_quick_prompt with Korean female horizontal
    print("8. Testing handle_quick_prompt with Korean female horizontal...")
    captured_json.clear()
    test_qp_body2 = {
        "prompt": "I need a 25yo Korean female creator in minimalist oversized tee reviewing glow moisturizer, horizontal format"
    }
    handler.handle_quick_prompt(test_qp_body2)
    res, status = captured_json[0]
    assert status == 200
    brief2 = res["brief"]
    assert brief2["gender"] == "Female", f"Expected Female, got {brief2['gender']}"
    assert brief2["age"] == "25", f"Expected 25, got {brief2['age']}"
    assert brief2["aspectRatio"] == "16:9", f"Expected 16:9, got {brief2['aspectRatio']}"
    assert "East Asian" in brief2["ethnicity"], f"Expected East Asian ethnicity, got {brief2['ethnicity']}"
    print(f"   ✓ Korean female horizontal test passed: {brief2['gender']}, {brief2['age']}yo, {brief2['aspectRatio']}, {brief2['ethnicity'][:30]}")

    # 9. Test handle_quick_prompt with Black male square
    print("9. Testing handle_quick_prompt with Black male square...")
    captured_json.clear()
    test_qp_body3 = {
        "prompt": "I need a 30yo black male creator in a sharp suit reviewing luxury perfume, square format"
    }
    handler.handle_quick_prompt(test_qp_body3)
    res, status = captured_json[0]
    assert status == 200
    brief3 = res["brief"]
    assert brief3["gender"] == "Male", f"Expected Male, got {brief3['gender']}"
    assert brief3["age"] == "30", f"Expected 30, got {brief3['age']}"
    assert brief3["aspectRatio"] == "1:1", f"Expected 1:1, got {brief3['aspectRatio']}"
    assert "Afro" in brief3["ethnicity"] or "Black" in brief3["ethnicity"]
    print(f"   ✓ Black male square test passed: {brief3['gender']}, {brief3['age']}yo, {brief3['aspectRatio']}")

    # 10. Test handle_generate_prompt with Square 1:1
    print("10. Testing handle_generate_prompt with Square 1:1...")
    captured_json.clear()
    test_s_body = {
        "provider": "openai",
        "brief": {
            "gender": "Male",
            "age": "30",
            "ethnicity": "Afro-descendant / Black",
            "productName": "Luxury Perfume",
            "aspectRatio": "1:1"
        }
    }
    handler.handle_generate_prompt(test_s_body)
    res, status = captured_json[0]
    assert status == 200
    assert "--ar 1:1" in res["shot1Face"], "Expected --ar 1:1 in prompt"
    assert res["aspectRatio"] == "1:1"
    print(f"   ✓ Aspect Ratio 1:1 test passed: Prompt contains '--ar 1:1' and square framing.")

    # 11. Test handle_refine_prompt (In-place prompt corrections)
    print("11. Testing handle_refine_prompt (In-place prompt refinement)...")
    captured_json.clear()
    test_refine_body = {
        "correction": "add thin gold wireframe glasses and change wardrobe to white silk button-down shirt and beige trousers",
        "brief": {
            "gender": "Female",
            "age": "24",
            "ethnicity": "South Asian / Indian",
            "faceFeatures": "Soft oval face, warm almond eyes",
            "hair": "Long dark brown hair",
            "wardrobe": "Sage green linen kurti",
            "aspectRatio": "9:16"
        }
    }
    handler.handle_refine_prompt(test_refine_body)
    res, status = captured_json[0]
    assert status == 200, f"Expected 200, got {status}"
    assert res.get("success") is True, "Expected success: True"
    assert "glasses" in res["brief"]["faceFeatures"].lower(), "Expected glasses in faceFeatures"
    assert "white silk" in res["brief"]["wardrobe"].lower(), "Expected white silk in wardrobe"
    assert "glasses" in res["prompts"]["shot1Face"].lower(), "Expected glasses in shot1Face prompt"
    assert "white silk" in res["prompts"]["shot2Front"].lower(), "Expected white silk in shot2Front prompt"
    assert "--ar 9:16" in res["prompts"]["shot1Face"], "Expected --ar 9:16 in shot1Face prompt"
    print(f"   ✓ In-Place Refinement test passed: Glasses & wardrobe applied, revision: {res.get('revisionSummary')}")

    # 11b. Test handle_refine_prompt with aspect ratio change
    captured_json.clear()
    test_refine_ar = {
        "correction": "change to horizontal 16:9 format with golden hour sunlight",
        "brief": res["brief"]
    }
    handler.handle_refine_prompt(test_refine_ar)
    res2, status2 = captured_json[0]
    assert status2 == 200
    assert res2["brief"]["aspectRatio"] == "16:9", f"Expected 16:9, got {res2['brief']['aspectRatio']}"
    assert "--ar 16:9" in res2["prompts"]["shot1Face"], "Expected --ar 16:9 in prompt"
    assert "golden-hour" in res2["prompts"]["shot1Face"].lower() or "golden" in res2["prompts"]["shot1Face"].lower()
    print(f"   ✓ In-Place AR Refinement test passed: Aspect ratio updated to 16:9 with golden hour lighting.")

    # 12. Test handle_analyze_product (Product image upload & vision character suggestions)
    print("12. Testing handle_analyze_product (Product Photo -> Creator Recommendation)...")
    captured_json.clear()
    test_prod_body = {
        "imageBase64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "productName": "Saffron Botanical Glow Serum",
        "productCategory": "Beauty / Clean Skincare & Serums",
        "productOrigin": "India — Urban Metro (Mumbai / Delhi / Bengaluru)",
        "brandName": "Lumina Skincare"
    }
    handler.handle_analyze_product(test_prod_body)
    res3, status3 = captured_json[0]
    assert status3 == 200, f"Expected 200, got {status3}"
    assert res3.get("success") is True, "Expected success: True"
    assert "creators" in res3, "Expected creators key in response"
    assert len(res3["creators"]) == 3, f"Expected 3 creators, got {len(res3['creators'])}"
    first_creator = res3["creators"][0]
    assert "archetype" in first_creator, "Expected archetype in creator"
    assert first_creator["gender"] in ["Female", "Male", "Non-Binary"], f"Invalid gender {first_creator['gender']}"
    assert "age" in first_creator, "Expected age in creator"
    assert "wardrobe" in first_creator, "Expected wardrobe in creator"
    assert "matchReason" in first_creator, "Expected matchReason in creator"
    assert "South Asian" in first_creator["ethnicity"] or "Indian" in first_creator["ethnicity"]
    assert "action" in first_creator, "Expected action field in creator recommendation"
    assert "fineTune" in first_creator, "Expected fineTune field in creator recommendation"
    print(f"   ✓ Product Vision Casting test passed: Recommended 3 creators for '{res3['detectedProduct']['name']}' (Top: {first_creator['archetype']}, {first_creator['gender']}, {first_creator['age']}yo).")

    # 12b. Test handle_analyze_product with cycle=2 (Suggest More / Refresh Creators)
    print("12b. Testing handle_analyze_product with cycle=2 (Suggest More / Alternate Creators)...")
    captured_json.clear()
    test_prod_cycle2 = {
        "imageBase64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "productName": "Saffron Botanical Glow Serum",
        "productCategory": "Beauty / Clean Skincare & Serums",
        "productOrigin": "India — Urban Metro (Mumbai / Delhi / Bengaluru)",
        "brandName": "Lumina Skincare",
        "cycle": 2,
        "excludeArchetypes": [first_creator["archetype"]]
    }
    handler.handle_analyze_product(test_prod_cycle2)
    res4, status4 = captured_json[0]
    assert status4 == 200, f"Expected 200, got {status4}"
    assert res4.get("batch") == 2, f"Expected batch 2, got {res4.get('batch')}"
    assert len(res4["creators"]) == 3, f"Expected 3 creators in batch 2, got {len(res4['creators'])}"
    batch2_archetypes = [c["archetype"] for c in res4["creators"]]
    assert first_creator["archetype"] not in batch2_archetypes, "Expected batch 2 to contrast with batch 1"
    print(f"   ✓ Suggest More / Batch 2 test passed: Got {batch2_archetypes} (contrasting with '{first_creator['archetype']}').")

    # 13. Test dynamic AI Provider Switching (Gemini vs ChatGPT vs Claude)
    print("13. Testing dynamic AI Provider Switching (Gemini, ChatGPT, Claude)...")
    for target_prov, expected_tag in [
        ("gemini", "Gemini"),
        ("openai", "ChatGPT"),
        ("claude", "Claude")
    ]:
        captured_json.clear()
        handler.handle_generate_prompt({
            "provider": target_prov,
            "brief": {"productName": "Linen Kurti", "aspectRatio": "9:16"}
        })
        res_gp, status_gp = captured_json[0]
        assert status_gp == 200
        assert expected_tag in res_gp.get("activeModel", ""), f"Expected {expected_tag} in activeModel for provider={target_prov}, got: {res_gp.get('activeModel')}"

        captured_json.clear()
        handler.handle_chat({
            "provider": target_prov,
            "message": "Give me a hook",
            "brief": {"productName": "Linen Kurti"}
        })
        res_c, status_c = captured_json[0]
        assert status_c == 200
        assert expected_tag in res_c.get("activeModel", ""), f"Expected {expected_tag} in chat activeModel for provider={target_prov}, got: {res_c.get('activeModel')}"
        print(f"   ✓ Switched to {target_prov.upper()}: Prompt generator and Chat both active on '{res_c.get('activeModel')}'")

    print("\nALL BACKEND API & PROVIDER SWITCHING TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_api()
