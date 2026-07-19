"""
Storage Service
===============
Uploads a finished video file to cloud object storage and returns a
public (or pre-signed) URL.

Provider selection (checked at call time):
  1. AWS S3      — if AWS_S3_BUCKET is set
  2. Azure Blob  — if AZURE_STORAGE_CONNECTION_STRING + AZURE_STORAGE_CONTAINER are set
  3. Local       — falls back to returning the local file path as-is (dev / no-cloud)
"""

import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


# ── S3 ───────────────────────────────────────────────────────────────────────

async def _upload_s3(local_path: str, object_key: str) -> str:
    import boto3  # type: ignore
    bucket = os.environ["AWS_S3_BUCKET"]
    region = os.getenv("AWS_REGION", "us-east-1")
    client = boto3.client("s3", region_name=region)
    client.upload_file(
        local_path,
        bucket,
        object_key,
        ExtraArgs={"ContentType": "video/mp4"},
    )
    url = f"https://{bucket}.s3.{region}.amazonaws.com/{object_key}"
    logger.info("StorageService: uploaded to S3 → %s", url)
    return url


# ── Azure Blob ───────────────────────────────────────────────────────────────

async def _upload_azure(local_path: str, blob_name: str) -> str:
    from azure.storage.blob import BlobServiceClient, ContentSettings  # type: ignore
    conn_str  = os.environ["AZURE_STORAGE_CONNECTION_STRING"]
    container = os.environ["AZURE_STORAGE_CONTAINER"]
    client    = BlobServiceClient.from_connection_string(conn_str)
    blob_client = client.get_blob_client(container=container, blob=blob_name)
    with open(local_path, "rb") as data:
        blob_client.upload_blob(
            data,
            overwrite=True,
            content_settings=ContentSettings(content_type="video/mp4"),
        )
    url = blob_client.url
    logger.info("StorageService: uploaded to Azure Blob → %s", url)
    return url


# ── Public interface ─────────────────────────────────────────────────────────

class StorageService:
    """
    Upload a local video file to the configured cloud provider.

    Returns a public URL (or the local path if no cloud is configured).
    """

    async def upload(self, local_path: str, filename: Optional[str] = None) -> str:
        """
        Upload *local_path* and return a public URL.

        :param local_path: absolute path to the MP4 on the local filesystem.
        :param filename:   desired remote filename; defaults to the basename.
        """
        if not os.path.exists(local_path):
            raise FileNotFoundError(f"StorageService: file not found: {local_path}")

        remote_name = filename or Path(local_path).name

        # ── Provider selection ────────────────────────────────────────────
        if os.getenv("AWS_S3_BUCKET"):
            try:
                return await _upload_s3(local_path, remote_name)
            except ImportError:
                logger.warning(
                    "StorageService: boto3 not installed — falling back to Azure/local"
                )

        if os.getenv("AZURE_STORAGE_CONNECTION_STRING") and os.getenv("AZURE_STORAGE_CONTAINER"):
            return await _upload_azure(local_path, remote_name)

        # ── Local fallback ────────────────────────────────────────────────
        logger.info(
            "StorageService: no cloud provider configured — returning local path %s",
            local_path,
        )
        return local_path

    def provider_name(self) -> str:
        """Human-readable active provider (for health checks / logs)."""
        if os.getenv("AWS_S3_BUCKET"):
            return "S3"
        if os.getenv("AZURE_STORAGE_CONNECTION_STRING"):
            return "AzureBlob"
        return "local"

# Made with Bob
