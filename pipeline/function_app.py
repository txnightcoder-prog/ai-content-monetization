"""
Azure Function App — Timer + HTTP triggers

Timer (6 AM UTC daily):  Recreates the ACI container to run the pipeline
HTTP /api/queue:          Returns the current approval queue
HTTP /api/approve:        Approve or reject a video
HTTP /api/run:            Manually trigger a pipeline run (from dashboard)
"""

import os
import json
import logging
import asyncio
from datetime import datetime, timezone, timedelta
import httpx
import azure.functions as func
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

app = func.FunctionApp()

# ── Config ─────────────────────────────────────────────────────────────────────
SUBSCRIPTION_ID  = os.environ.get("AZURE_SUBSCRIPTION_ID", "0624b0c7-bc20-40a1-8156-b33b8f52e951")
RESOURCE_GROUP   = os.environ.get("AZURE_RESOURCE_GROUP",  "ai-video-pipeline")
CONTAINER_GROUP  = os.environ.get("ACI_CONTAINER_GROUP",   "txnightcoder-pipeline")
AZURE_CONN_STR   = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "")
AZURE_CONTAINER  = os.environ.get("AZURE_STORAGE_CONTAINER", "videos")
QUEUE_BLOB_NAME  = "pending_queue.json"
BUFFER_TOKEN     = os.environ.get("BUFFER_ACCESS_TOKEN", "")
BUFFER_PROFILE_IDS = [p.strip() for p in os.environ.get("BUFFER_PROFILE_IDS", "").split(",") if p.strip()]
_raw = os.environ.get("BUFFER_CHANNEL_SERVICES", "")
BUFFER_CHANNEL_SERVICES: dict[str, str] = {}
for _e in _raw.split(","):
    if ":" in _e:
        _cid, _svc = _e.strip().split(":", 1)
        BUFFER_CHANNEL_SERVICES[_cid.strip()] = _svc.strip()
POST_HOURS = [8, 11, 14, 17, 20]

CORS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


# ── Timer: fires daily at 6 AM UTC — starts the ACI container ─────────────────

@app.timer_trigger(schedule="0 0 6 * * *", arg_name="timer", run_on_startup=False)
async def daily_pipeline(timer: func.TimerRequest) -> None:
    """Fires every day at 6:00 AM UTC — starts the Azure Container Instance."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logger.info("=== Daily timer fired — starting pipeline container ===")
    try:
        await _start_container()
        logger.info("=== Container started successfully ===")
    except Exception as exc:
        logger.error(f"Failed to start container: {exc}", exc_info=True)
        raise


# ── HTTP: manually trigger a run from the dashboard ───────────────────────────

@app.route(route="run", methods=["POST", "OPTIONS"])
async def trigger_run(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers=CORS)
    try:
        await _start_container()
        return func.HttpResponse(
            json.dumps({"ok": True, "message": "Pipeline container started"}),
            mimetype="application/json", headers=CORS,
        )
    except Exception as exc:
        return func.HttpResponse(
            json.dumps({"error": str(exc)}),
            status_code=500, mimetype="application/json", headers=CORS,
        )


# ── HTTP: get approval queue ───────────────────────────────────────────────────

@app.route(route="queue", methods=["GET", "OPTIONS"])
async def get_queue(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers=CORS)
    queue = _load_queue()
    return func.HttpResponse(json.dumps(queue), mimetype="application/json", headers=CORS)


# ── HTTP: approve or reject a video ───────────────────────────────────────────

@app.route(route="approve", methods=["POST", "OPTIONS"])
async def approve_video(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers=CORS)
    try:
        body = req.get_json()
    except Exception:
        return func.HttpResponse("Invalid JSON", status_code=400, headers=CORS)

    video_id = body.get("video_id")
    action   = body.get("action")
    if not video_id or action not in ("approve", "reject"):
        return func.HttpResponse("Missing video_id or invalid action", status_code=400, headers=CORS)

    queue = _load_queue()
    item  = next((v for v in queue if v["id"] == video_id), None)
    if not item:
        return func.HttpResponse("Video not found", status_code=404, headers=CORS)

    if action == "approve":
        try:
            now       = datetime.now(timezone.utc)
            tomorrow  = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            idx       = next(i for i, v in enumerate(queue) if v["id"] == video_id)
            post_time = tomorrow + timedelta(hours=POST_HOURS[idx % len(POST_HOURS)])
            await _schedule_buffer(item["caption"], item["url"], post_time)
            item["status"]    = "approved"
            item["posted_at"] = now.isoformat()
        except Exception as exc:
            return func.HttpResponse(
                json.dumps({"error": str(exc)}),
                status_code=500, mimetype="application/json", headers=CORS,
            )
    else:
        _delete_blob(item.get("blob_name", ""))
        queue = [v for v in queue if v["id"] != video_id]

    _save_queue(queue)
    return func.HttpResponse(
        json.dumps({"ok": True, "action": action, "title": item["title"]}),
        mimetype="application/json", headers=CORS,
    )


# ── ACI container start via Azure REST API ────────────────────────────────────

async def _start_container() -> None:
    """
    Recreates the ACI container group via Azure REST API.
    Uses the Function App's Managed Identity for auth (no secrets needed).
    """
    # Get access token via Managed Identity (IMDS endpoint)
    token = await _get_managed_identity_token("https://management.azure.com/")
    base  = f"https://management.azure.com/subscriptions/{SUBSCRIPTION_ID}/resourceGroups/{RESOURCE_GROUP}"
    url   = f"{base}/providers/Microsoft.ContainerInstance/containerGroups/{CONTAINER_GROUP}/start?api-version=2023-05-01"

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, headers={"Authorization": f"Bearer {token}"})
        if resp.status_code not in (200, 202, 204):
            raise RuntimeError(f"ACI start failed: {resp.status_code} {resp.text[:300]}")
    logger.info(f"Container '{CONTAINER_GROUP}' started via REST API")


async def _get_managed_identity_token(resource: str) -> str:
    """Get an access token from Azure Managed Identity (IMDS)."""
    url = f"http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource={resource}"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, headers={"Metadata": "true"})
        resp.raise_for_status()
        return resp.json()["access_token"]


# ── Buffer scheduling ──────────────────────────────────────────────────────────

async def _schedule_buffer(caption: str, video_url: str, scheduled_at: datetime) -> None:
    yt_title = caption.split("\n")[0].strip()[:97]
    _meta = {
        "instagram": {"instagram": {"type": "reel", "shouldShareToFeed": True}},
        "youtube":   {"youtube":   {"title": yt_title, "privacy": "public", "categoryId": "22"}},
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
    async with httpx.AsyncClient(timeout=30) as client:
        for cid in BUFFER_PROFILE_IDS:
            svc  = BUFFER_CHANNEL_SERVICES.get(cid, "instagram")
            meta = _meta.get(svc, {})
            resp = await client.post(
                "https://api.buffer.com/graphql",
                headers={"Authorization": f"Bearer {BUFFER_TOKEN}", "Content-Type": "application/json"},
                json={"query": query, "variables": {"input": {
                    "channelId": cid, "text": caption,
                    "schedulingType": "automatic", "dueAt": scheduled_at.isoformat(),
                    "mode": "customScheduled",
                    "assets": [{"video": {"url": video_url}}],
                    "metadata": meta,
                }}},
            )
            resp.raise_for_status()
            result = resp.json().get("data", {}).get("createPost", {})
            if not result.get("post"):
                raise RuntimeError(f"Buffer failed for {cid}: {result.get('message', result)}")


# ── Queue helpers ──────────────────────────────────────────────────────────────

def _load_queue() -> list:
    if not AZURE_CONN_STR:
        return []
    try:
        from azure.storage.blob import BlobServiceClient
        blob = BlobServiceClient.from_connection_string(AZURE_CONN_STR) \
                   .get_blob_client(container=AZURE_CONTAINER, blob=QUEUE_BLOB_NAME)
        return json.loads(blob.download_blob().readall())
    except Exception:
        return []


def _save_queue(queue: list) -> None:
    if not AZURE_CONN_STR:
        return
    from azure.storage.blob import BlobServiceClient, ContentSettings
    blob = BlobServiceClient.from_connection_string(AZURE_CONN_STR) \
               .get_blob_client(container=AZURE_CONTAINER, blob=QUEUE_BLOB_NAME)
    blob.upload_blob(
        json.dumps(queue, indent=2).encode(),
        overwrite=True,
        content_settings=ContentSettings(content_type="application/json"),
    )


def _delete_blob(blob_name: str) -> None:
    if not AZURE_CONN_STR or not blob_name:
        return
    try:
        from azure.storage.blob import BlobServiceClient
        BlobServiceClient.from_connection_string(AZURE_CONN_STR) \
            .get_blob_client(container=AZURE_CONTAINER, blob=blob_name).delete_blob()
    except Exception:
        pass
