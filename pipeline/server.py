"""
Pipeline Web Server — runs on Azure App Service (Linux)
Exposes HTTP endpoints the dashboard calls to trigger video generation.
FFmpeg is installed via startup.sh on first boot.
"""

import os
import asyncio
import logging
import json
import threading
from datetime import datetime, timezone
from flask import Flask, jsonify, request
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Track running state
_pipeline_running = False
_last_run = None
_last_result = None


# ── Health check ───────────────────────────────────────────────────────────────

@app.route("/", methods=["GET"])
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "TxNightCoder Pipeline",
        "running": _pipeline_running,
        "last_run": _last_run,
    })


# ── Get approval queue ────────────────────────────────────────────────────────

@app.route("/api/queue", methods=["GET"])
def get_queue():
    from daily_pipeline import _load_queue
    cors(response := jsonify(_load_queue()))
    return response


# ── Approve / reject a video ──────────────────────────────────────────────────

@app.route("/api/approve", methods=["POST", "OPTIONS"])
def approve():
    if request.method == "OPTIONS":
        return _cors(jsonify({}), 204)
    body     = request.get_json(force=True)
    video_id = body.get("video_id")
    action   = body.get("action")
    if not video_id or action not in ("approve", "reject"):
        return _cors(jsonify({"error": "Missing video_id or invalid action"}), 400)

    from daily_pipeline import _load_queue, _save_queue, _delete_blob, _schedule_buffer_post
    from datetime import timedelta
    from daily_pipeline import POST_HOURS

    queue = _load_queue()
    item  = next((v for v in queue if v["id"] == video_id), None)
    if not item:
        return _cors(jsonify({"error": "Video not found"}), 404)

    if action == "approve":
        try:
            now       = datetime.now(timezone.utc)
            tomorrow  = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            idx       = next(i for i, v in enumerate(queue) if v["id"] == video_id)
            post_time = tomorrow + timedelta(hours=POST_HOURS[idx % len(POST_HOURS)])
            asyncio.run(_schedule_buffer_post(item["caption"], item["url"], post_time))
            item["status"]    = "approved"
            item["posted_at"] = now.isoformat()
        except Exception:
            logger.error("Failed to approve video %s", video_id, exc_info=True)
            return _cors(jsonify({"error": "Failed to approve video"}), 500)
    else:
        _delete_blob(item.get("blob_name", ""))
        queue = [v for v in queue if v["id"] != video_id]

    _save_queue(queue)
    return _cors(jsonify({"ok": True, "action": action, "title": item["title"]}))


# ── Trigger pipeline run ──────────────────────────────────────────────────────

@app.route("/api/run", methods=["POST", "OPTIONS"])
def trigger_run():
    if request.method == "OPTIONS":
        return _cors(jsonify({}), 204)

    global _pipeline_running
    if _pipeline_running:
        return _cors(jsonify({"error": "Pipeline already running"}), 409)

    body  = request.get_json(force=True, silent=True) or {}
    niche = body.get("niche", os.environ.get("NICHE", "AI tools and coding"))
    count = int(body.get("count", os.environ.get("VIDEOS_PER_DAY", 5)))

    # Run in background thread so HTTP returns immediately
    def run():
        global _pipeline_running, _last_run, _last_result
        _pipeline_running = True
        _last_run = datetime.now(timezone.utc).isoformat()
        try:
            import daily_pipeline as dp
            dp.NICHE          = niche
            dp.VIDEOS_PER_DAY = count
            result = asyncio.run(dp.run_pipeline())
            _last_result = result
            logger.info(f"Pipeline complete: {result}")
        except Exception as e:
            _last_result = {"error": "Pipeline run failed"}
            logger.error("Pipeline error: %s", e, exc_info=True)
        finally:
            _pipeline_running = False

    thread = threading.Thread(target=run, daemon=True)
    thread.start()

    return _cors(jsonify({
        "ok": True,
        "message": f"Pipeline started — generating {count} videos for niche: {niche}",
        "niche": niche,
        "count": count,
    }))


# ── Pipeline status ───────────────────────────────────────────────────────────

@app.route("/api/status", methods=["GET"])
def status():
    return _cors(jsonify({
        "running":     _pipeline_running,
        "last_run":    _last_run,
        "last_result": _last_result,
    }))


# ── CORS helper ───────────────────────────────────────────────────────────────

def _cors(response, status=200):
    response.status_code = status
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


@app.after_request
def after_request(response):
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
