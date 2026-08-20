"""Cloudflare R2 storage service for PDF uploads and signed URL generation."""

from typing import Optional

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

from ..core.config import get_settings


def _get_s3_client():
    """Create an S3-compatible client for Cloudflare R2."""
    settings = get_settings()
    if not settings.R2_ENDPOINT_URL:
        return None

    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=BotoConfig(
            signature_version="s3v4",
            retries={"max_attempts": 3, "mode": "standard"},
        ),
    )


async def upload_pdf(file_bytes: bytes, key: str) -> Optional[str]:
    """
    Upload a PDF to Cloudflare R2.
    Returns the object key on success, None on failure.
    """
    settings = get_settings()
    client = _get_s3_client()
    if not client:
        # R2 not configured — store locally or skip
        return None

    try:
        client.put_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=key,
            Body=file_bytes,
            ContentType="application/pdf",
        )
        return key
    except ClientError as e:
        print(f"R2 upload error: {e}")
        return None


async def get_signed_url(key: str, expires_in: int = 300) -> Optional[str]:
    """
    Generate a pre-signed URL for downloading a PDF from R2.
    Default expiry: 5 minutes.
    """
    settings = get_settings()
    client = _get_s3_client()
    if not client:
        return None

    try:
        url = client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": settings.R2_BUCKET_NAME,
                "Key": key,
            },
            ExpiresIn=expires_in,
        )
        return url
    except ClientError as e:
        print(f"R2 signed URL error: {e}")
        return None


async def delete_file(key: str) -> bool:
    """Delete a file from R2."""
    settings = get_settings()
    client = _get_s3_client()
    if not client:
        return False

    try:
        client.delete_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=key,
        )
        return True
    except ClientError as e:
        print(f"R2 delete error: {e}")
        return False
