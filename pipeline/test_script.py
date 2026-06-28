import asyncio, os
from dotenv import load_dotenv
load_dotenv(".env", override=True)
from openai import AsyncOpenAI
import httpx

async def test():
    client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    resp = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are an expert short-form video scriptwriter. Scripts are 30-60 seconds: Hook (5s) -> Value (20-30s) -> CTA (5s)."},
            {"role": "user", "content": (
                "Write a viral script for: \"5 AI Tools\"\n"
                "Niche: AI tools and productivity\n\n"
                "Format EXACTLY:\n"
                "HOOK: [attention-grabbing opener]\n"
                "BODY: [main value, specific and actionable]\n"
                "CTA: [clear next step for viewer]"
            )},
        ],
        temperature=0.8,
        max_tokens=400,
    )
    raw = resp.choices[0].message.content.strip()
    # encode to ascii replacing non-printable chars so Windows terminal doesn't crash
    print("=== RAW OUTPUT ===")
    print(raw.encode("ascii", "replace").decode("ascii"))
    print()

    parts = {"hook": "", "body": "", "cta": "Follow for more!"}
    current = None
    for line in raw.splitlines():
        line = line.strip().lstrip("*# ").rstrip("*# ")  # strip **bold** markdown
        if not line:
            continue
        uline = line.upper()
        if uline.startswith("HOOK:"):
            current = "hook"; parts["hook"] = line[5:].lstrip("* ").strip()
        elif uline.startswith("BODY:"):
            current = "body"; parts["body"] = line[5:].lstrip("* ").strip()
        elif uline.startswith("CTA:"):
            current = "cta"; parts["cta"] = line[4:].lstrip("* ").strip()
        elif current:
            parts[current] += " " + line

    full = f"{parts['hook']} {parts['body']} {parts['cta']}".strip()
    print("=== PARSED ===")
    print(f"HOOK ({len(parts['hook'])} chars): {parts['hook'][:80].encode('ascii','replace').decode()}")
    print(f"BODY ({len(parts['body'])} chars): {parts['body'][:80].encode('ascii','replace').decode()}")
    print(f"CTA  ({len(parts['cta'])} chars): {parts['cta'][:80].encode('ascii','replace').decode()}")
    print(f"FULL ({len(full)} chars)")

    if not parts["hook"] or not parts["body"]:
        print("\nERROR: hook or body is empty!")
        return

    print("\n=== Submitting to JSON2Video ===")
    movie = {
        "resolution": "instagram-story",
        "quality": "high",
        "scenes": [{
            "background-color": "#0f0f0f",
            "duration": -1,
            "elements": [
                {
                    "type": "voice",
                    "text": full,
                    "voice": "en-US-JennyNeural",
                },
                {
                    "type": "text",
                    "text": full,
                    "font-family": "Montserrat",
                    "font-size": 42, "font-weight": "bold",
                    "fill-color": "#FFFFFF",
                    "stroke-color": "#000000", "stroke-width": 3,
                    "width": 900, "x": 90, "y": 1400,
                    "word-wrap": True, "word-wrap-width": 900,
                },
            ],
        }],
    }

    async with httpx.AsyncClient(timeout=30.0) as c:
        r = await c.post(
            "https://api.json2video.com/v2/movies",
            headers={"x-api-key": os.environ["JSON2VIDEO_API_KEY"]},
            json=movie,
        )
        print(f"Submit status: {r.status_code}")
        data = r.json()
        print(f"Response: {data}")
        if r.status_code == 200:
            project_id = data.get("project") or data.get("movie", {}).get("project")
            print(f"\nProject ID: {project_id}")
            print("Polling for result (wait up to 3 min)...")
            import time
            deadline = time.time() + 180
            while time.time() < deadline:
                await asyncio.sleep(10)
                r2 = await c.get(
                    f"https://api.json2video.com/v2/movies?project={project_id}",
                    headers={"x-api-key": os.environ["JSON2VIDEO_API_KEY"]},
                )
                d2 = r2.json()
                movie_data = d2.get("movie", {})
                status = movie_data.get("status")
                print(f"  Status: {status} | msg: {movie_data.get('message','')}")
                if status == "done":
                    print(f"\nSUCCESS! Video URL: {movie_data['url']}")
                    break
                if status == "error":
                    print(f"\nFAILED: {movie_data.get('message')}")
                    break

asyncio.run(test())
