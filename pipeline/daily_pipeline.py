"""
Daily Video Pipeline — Azure Function Timer Trigger
Runs once per day at 6 AM UTC.

APPROVAL WORKFLOW:
  1. Timer fires at 6 AM -> generates scripts + videos -> uploads to Azure Blob
  2. Saves a pending_queue.json to Blob — status = "pending"
  3. You open the dashboard, preview each video, click Approve or Reject
  4. Approve -> HTTP trigger fires -> schedules that video to Buffer immediately
  5. Reject -> removed from queue, video deleted from Blob
"""

import os
import asyncio
import logging
import json
from datetime import datetime, timezone, timedelta
from typing import Optional
import httpx
from openai import AsyncOpenAI
from dotenv import load_dotenv
import azure.functions as func
from video_generator import create_video_local

# Load .env
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=_env_path, override=True)
logger = logging.getLogger(__name__)

# ── Config ─────────────────────────────────────────────────────────────────────

OPENAI_API_KEY      = os.environ["OPENAI_API_KEY"]
BUFFER_ACCESS_TOKEN = os.environ["BUFFER_ACCESS_TOKEN"]
NICHE               = os.environ.get("NICHE", "AI tools and productivity")
VIDEOS_PER_DAY      = int(os.environ.get("VIDEOS_PER_DAY", "5"))

BUFFER_PROFILE_IDS  = [p.strip() for p in os.environ.get("BUFFER_PROFILE_IDS", "").split(",") if p.strip()]

_raw_services = os.environ.get("BUFFER_CHANNEL_SERVICES", "")
BUFFER_CHANNEL_SERVICES: dict[str, str] = {}
for _entry in _raw_services.split(","):
    _entry = _entry.strip()
    if ":" in _entry:
        _cid, _svc = _entry.split(":", 1)
        BUFFER_CHANNEL_SERVICES[_cid.strip()] = _svc.strip()

POST_HOURS = [8, 11, 14, 17, 20]

AZURE_CONN_STR  = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "")
AZURE_CONTAINER = os.environ.get("AZURE_STORAGE_CONTAINER", "videos")
QUEUE_BLOB_NAME = "pending_queue.json"

# ── Azure Function App ─────────────────────────────────────────────────────────

app = func.FunctionApp()


# ── Timer trigger: runs daily at 6 AM UTC ─────────────────────────────────────

@app.timer_trigger(schedule="0 0 6 * * *", arg_name="timer", run_on_startup=False)
async def daily_pipeline(timer: func.TimerRequest) -> None:
    """Fires every day at 6:00 AM UTC — generates videos and saves to approval queue."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logger.info("=== Daily pipeline started (approval mode) ===")
    try:
        result = await run_pipeline()
        logger.info(f"=== Pipeline complete: {result['videos_ready']} videos waiting for approval ===")
    except Exception as exc:
        logger.error(f"Pipeline failed: {exc}", exc_info=True)
        raise


# ── HTTP trigger: approve a single video ──────────────────────────────────────

@app.route(route="approve", methods=["POST", "OPTIONS"])
async def approve_video(req: func.HttpRequest) -> func.HttpResponse:
    """
    POST /api/approve
    Body: { "video_id": "abc123", "action": "approve" | "reject" }
    Approving immediately schedules the video to Buffer.
    """
    # CORS preflight
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers=cors_headers)

    try:
        body = req.get_json()
    except Exception:
        return func.HttpResponse("Invalid JSON", status_code=400, headers=cors_headers)

    video_id = body.get("video_id")
    action   = body.get("action")  # "approve" or "reject"

    if not video_id or action not in ("approve", "reject"):
        return func.HttpResponse("Missing video_id or invalid action", status_code=400, headers=cors_headers)

    # Load queue
    queue = _load_queue()
    item  = next((v for v in queue if v["id"] == video_id), None)
    if not item:
        return func.HttpResponse("Video not found in queue", status_code=404, headers=cors_headers)

    if action == "approve":
        try:
            # Schedule to Buffer now (post in next available slot)
            now      = datetime.now(timezone.utc)
            tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            # Find which slot index this video is in the queue
            idx       = next(i for i, v in enumerate(queue) if v["id"] == video_id)
            post_time = tomorrow + timedelta(hours=POST_HOURS[idx % len(POST_HOURS)])
            caption   = item["caption"]
            video_url = item["url"]
            await _schedule_buffer_post(caption, video_url, post_time)
            item["status"]    = "approved"
            item["posted_at"] = now.isoformat()
            logger.info(f"Approved + scheduled: {item['title']}")
        except Exception as exc:
            logger.error(f"Approve failed: {exc}")
            return func.HttpResponse(f"Scheduling failed: {exc}", status_code=500, headers=cors_headers)
    else:
        # Reject — delete blob, remove from queue
        _delete_blob(item.get("blob_name", ""))
        queue = [v for v in queue if v["id"] != video_id]
        logger.info(f"Rejected + deleted: {item['title']}")

    _save_queue(queue)
    return func.HttpResponse(
        json.dumps({"ok": True, "action": action, "title": item["title"]}),
        mimetype="application/json",
        headers=cors_headers,
    )


# ── HTTP trigger: get current queue ───────────────────────────────────────────

@app.route(route="queue", methods=["GET", "OPTIONS"])
async def get_queue(req: func.HttpRequest) -> func.HttpResponse:
    """GET /api/queue — returns the current approval queue as JSON."""
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers=cors_headers)

    queue = _load_queue()
    return func.HttpResponse(
        json.dumps(queue),
        mimetype="application/json",
        headers=cors_headers,
    )


# ── Main pipeline (generate + upload, NO auto-post) ───────────────────────────

async def run_pipeline() -> dict:
    openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)

    logger.info(f"Step 1: Generating {VIDEOS_PER_DAY} topics...")
    topics = await generate_topics(openai_client, NICHE, VIDEOS_PER_DAY)
    logger.info(f"  Topics: {topics}")

    logger.info("Step 2: Generating scripts...")
    scripts = await generate_scripts(openai_client, topics, NICHE)

    logger.info("Step 3: Creating videos...")
    videos = await create_videos(scripts)

    logger.info("Step 4: Saving to approval queue (NOT auto-posting)...")
    queue = _load_queue()
    # Keep already-pending items, add new ones
    existing_ids = {v["id"] for v in queue}

    import uuid
    for script, video in zip(scripts, videos):
        if not video:
            continue
        vid_id = str(uuid.uuid4())[:8]
        if vid_id in existing_ids:
            continue
        caption = _build_caption(script)
        queue.append({
            "id":        vid_id,
            "title":     script.get("topic", "Untitled"),
            "hook":      script.get("hook", ""),
            "caption":   caption,
            "url":       video["url"],
            "blob_name": video.get("blob_name", ""),
            "size_kb":   video.get("size_kb", 0),
            "status":    "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    _save_queue(queue)
    pending = [v for v in queue if v["status"] == "pending"]
    logger.info(f"  {len(pending)} videos waiting for your approval in the dashboard")
    return {"videos_ready": len(pending)}


# ── Topic + script generation ──────────────────────────────────────────────────

async def generate_topics(client: AsyncOpenAI, niche: str, count: int) -> list[str]:
    resp = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a viral short-form video content strategist."},
            {"role": "user",   "content": (
                f"Generate {count} viral video topic ideas for the '{niche}' niche.\n"
                "Rules: specific, curiosity-driven, suitable for 30-60 second videos.\n"
                "Return ONLY a JSON array of strings. Example: [\"Topic 1\", \"Topic 2\"]"
            )},
        ],
        temperature=0.9, max_tokens=300,
    )
    raw = resp.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    try:
        return json.loads(raw)[:count]
    except json.JSONDecodeError:
        return [l.strip().strip('"\'- ') for l in raw.splitlines() if l.strip()][:count]


async def generate_scripts(client: AsyncOpenAI, topics: list[str], niche: str) -> list[dict]:
    scripts = []
    for i, topic in enumerate(topics, 1):
        try:
            script = await _generate_single_script(client, topic, niche)
            scripts.append(script)
            logger.info(f"  OK Script {i}/{len(topics)}: '{topic}'")
        except Exception as exc:
            logger.error(f"  FAIL Script {i} failed: {exc}")
    return scripts


async def _generate_single_script(client: AsyncOpenAI, topic: str, niche: str) -> dict:
    resp = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": (
                "You are an expert short-form video scriptwriter. "
                "Scripts are 30-60 seconds: Hook (5s) -> Value (20-30s) -> CTA (5s)."
            )},
            {"role": "user", "content": (
                f"Write a viral script for: \"{topic}\"\nNiche: {niche}\n\n"
                "Format EXACTLY:\n"
                "HOOK: [attention-grabbing opener]\n"
                "BODY: [main value, specific and actionable]\n"
                "CTA: [clear next step for viewer]"
            )},
        ],
        temperature=0.8, max_tokens=400,
    )
    raw  = resp.choices[0].message.content.strip()
    parts = {"hook": "", "body": "", "cta": "Follow for more!", "topic": topic}
    current = None
    for line in raw.splitlines():
        line  = line.strip().lstrip("*# ").rstrip("*# ")
        if not line:
            continue
        uline = line.upper()
        if uline.startswith("HOOK:"):
            current = "hook"; parts["hook"] = line[5:].lstrip("* ").strip()
        elif uline.startswith("BODY:"):
            current = "body"; parts["body"] = line[5:].lstrip("* ").strip()
        elif uline.startswith("CTA:"):
            current = "cta";  parts["cta"]  = line[4:].lstrip("* ").strip()
        elif current:
            parts[current] += " " + line
    return parts


# ── Video creation ─────────────────────────────────────────────────────────────

async def create_videos(scripts: list[dict]) -> list[Optional[dict]]:
    videos = []
    for i, script in enumerate(scripts, 1):
        try:
            video = await create_video_local(script, i)
            videos.append(video)
            logger.info(f"  OK Video {i}/{len(scripts)}: {video['url']}")
        except Exception as exc:
            logger.error(f"  FAIL Video {i} failed: {exc}")
            videos.append(None)
    return videos


# ── Buffer scheduling ──────────────────────────────────────────────────────────

def _build_caption(script: dict) -> str:
    tag = script.get("topic", "").replace(" ", "")
    return f"{script.get('hook','')}\n\n{script.get('cta','Follow for more!')}\n\n#{tag} #AItools #productivity #txnightcoder"


async def _schedule_buffer_post(caption: str, video_url: str, scheduled_at: datetime) -> dict:
    if not BUFFER_PROFILE_IDS:
        raise ValueError("BUFFER_PROFILE_IDS is empty")

    _yt_title_raw = caption.split("\n")[0].strip()
    _yt_title     = _yt_title_raw[:97] + ("..." if len(_yt_title_raw) > 97 else "")

    _service_metadata = {
        "instagram": {"instagram": {"type": "reel", "shouldShareToFeed": True}},
        "youtube":   {"youtube":   {"title": _yt_title, "privacy": "public", "categoryId": "22"}},
        "facebook":  {"facebook":  {"type": "reel"}},
        "tiktok":    {"tiktok":    {}},
    }

    query = """
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess { post { id status dueAt } }
        ... on NotFoundError     { message }
        ... on UnauthorizedError { message }
        ... on InvalidInputError { message }
        ... on LimitReachedError { message }
        ... on UnexpectedError   { message }
      }
    }
    """
    results = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        for channel_id in BUFFER_PROFILE_IDS:
            service  = BUFFER_CHANNEL_SERVICES.get(channel_id, "instagram")
            metadata = _service_metadata.get(service, {})
            variables = {"input": {
                "channelId": channel_id,
                "text": caption,
                "schedulingType": "automatic",
                "dueAt": scheduled_at.isoformat(),
                "mode": "customScheduled",
                "assets": [{"video": {"url": video_url}}],
                "metadata": metadata,
            }}
            resp = await client.post(
                "https://api.buffer.com/graphql",
                headers={"Authorization": f"Bearer {BUFFER_ACCESS_TOKEN}", "Content-Type": "application/json"},
                json={"query": query, "variables": variables},
            )
            resp.raise_for_status()
            data   = resp.json()
            result = data.get("data", {}).get("createPost", {})
            if not result.get("post"):
                raise RuntimeError(f"Buffer post failed for {channel_id}: {result.get('message', result)}")
            results.append(result["post"])
    return {"results": results}


# ── Queue helpers (stored in Azure Blob as pending_queue.json) ─────────────────

def _load_queue() -> list:
    """Load the approval queue from Azure Blob Storage."""
    if not AZURE_CONN_STR:
        return []
    try:
        from azure.storage.blob import BlobServiceClient
        client = BlobServiceClient.from_connection_string(AZURE_CONN_STR)
        blob   = client.get_blob_client(container=AZURE_CONTAINER, blob=QUEUE_BLOB_NAME)
        data   = blob.download_blob().readall()
        return json.loads(data)
    except Exception:
        return []  # Empty queue if not found yet


def _save_queue(queue: list) -> None:
    """Save the approval queue back to Azure Blob Storage."""
    if not AZURE_CONN_STR:
        return
    from azure.storage.blob import BlobServiceClient, ContentSettings
    client = BlobServiceClient.from_connection_string(AZURE_CONN_STR)
    blob   = client.get_blob_client(container=AZURE_CONTAINER, blob=QUEUE_BLOB_NAME)
    blob.upload_blob(
        json.dumps(queue, indent=2).encode(),
        overwrite=True,
        content_settings=ContentSettings(content_type="application/json"),
    )


def _delete_blob(blob_name: str) -> None:
    """Delete a video blob when rejected."""
    if not AZURE_CONN_STR or not blob_name:
        return
    try:
        from azure.storage.blob import BlobServiceClient
        client = BlobServiceClient.from_connection_string(AZURE_CONN_STR)
        client.get_blob_client(container=AZURE_CONTAINER, blob=blob_name).delete_blob()
    except Exception:
        pass


# ── Local test runner ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    asyncio.run(run_pipeline())
