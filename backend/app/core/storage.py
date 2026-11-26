"""Where uploaded and downloaded files live: the local disk, or an S3-compatible bucket (Cloudflare R2).

Free hosts (Render's free plan) wipe their disk on every restart and deploy, so in production files go
to a bucket. Every file is addressed by a key such as "locker/<user>/<uuid>.pdf":

    STORAGE_BACKEND=local (default)  keys are paths under PRIVATE_UPLOADS_DIR (default ./private_uploads),
                                     except "media/..." which stays in ./media_uploads (public room photos).
    STORAGE_BACKEND=s3               keys are objects in S3_BUCKET at S3_ENDPOINT_URL (R2:
                                     https://<account id>.r2.cloudflarestorage.com), using S3_ACCESS_KEY_ID /
                                     S3_SECRET_ACCESS_KEY. The bucket stays private: files are streamed through
                                     the API, after its own permission checks, never linked to directly.

Move existing files with:  python -m backend.app.core.storage_migrate
"""
from __future__ import annotations

import hashlib
import os
import re
import tempfile
import threading
from pathlib import Path
from typing import Iterator, Optional

from fastapi import HTTPException
from fastapi.responses import FileResponse, Response, StreamingResponse

from backend.app.core.config import ROOT_DIR, settings

PRIVATE_ROOT = Path(os.getenv("PRIVATE_UPLOADS_DIR", ROOT_DIR / "private_uploads"))
MEDIA_ROOT = Path("media_uploads")          # relative to the working directory, as it always was
_KEY = re.compile(r"[A-Za-z0-9_\-]+(/[A-Za-z0-9_\-]+)*(\.[A-Za-z0-9]{1,8})?")
CHUNK = 1024 * 1024


class TooLarge(ValueError):
    """The upload is bigger than the caller's limit (nothing was stored)."""


def key(*parts: str) -> str:
    """Join parts into a key, refusing anything that could escape its folder (.., slashes, odd characters)."""
    k = "/".join(str(p) for p in parts)
    if not _KEY.fullmatch(k) or ".." in k:
        raise HTTPException(status_code=400, detail="Invalid file reference")
    return k


# ── Backends ─────────────────────────────────────────────────────────────────
class LocalStorage:
    name = "local"

    def _path(self, k: str) -> Path:
        if k.startswith("media/"):
            return MEDIA_ROOT / k[len("media/"):]
        return PRIVATE_ROOT / k

    def put_file(self, k: str, fileobj, content_type: str) -> None:
        path = self._path(k)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(path.name + ".part")
        with open(tmp, "wb") as f:
            while chunk := fileobj.read(CHUNK):
                f.write(chunk)
        os.replace(tmp, path)

    def exists(self, k: str) -> bool:
        return self._path(k).is_file()

    def delete(self, k: str) -> None:
        self._path(k).unlink(missing_ok=True)

    def read_bytes(self, k: str) -> bytes:
        try:
            return self._path(k).read_bytes()
        except FileNotFoundError:
            raise FileNotFoundError(k) from None

    def response(self, k: str, media_type: Optional[str], headers: dict, filename: Optional[str]) -> Response:
        path = self._path(k)
        if not path.is_file():
            raise FileNotFoundError(k)
        return FileResponse(path, media_type=media_type, headers=headers, filename=filename)

    def keys(self, prefix: str = "") -> Iterator[str]:
        roots = [("", PRIVATE_ROOT)] + ([("media/", MEDIA_ROOT)] if MEDIA_ROOT.is_dir() else [])
        for pre, root in roots:
            if not root.is_dir():
                continue
            for p in root.rglob("*"):
                if p.is_file() and not p.name.endswith(".part"):
                    k = pre + p.relative_to(root).as_posix()
                    if k.startswith(prefix) and _KEY.fullmatch(k):
                        yield k


class S3Storage:
    name = "s3"

    def __init__(self):
        missing = [n for n in ("S3_ENDPOINT_URL", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY") if not getattr(settings, n)]
        if missing:
            raise RuntimeError(f"STORAGE_BACKEND=s3 needs {', '.join(missing)}")
        self.bucket = settings.S3_BUCKET
        self._client = None
        self._lock = threading.Lock()

    @property
    def client(self):
        # boto3 (~25 MB) is loaded on first use, not at startup
        with self._lock:
            if self._client is None:
                import boto3
                from botocore.config import Config
                self._client = boto3.client(
                    "s3", endpoint_url=settings.S3_ENDPOINT_URL, region_name=settings.S3_REGION,
                    aws_access_key_id=settings.S3_ACCESS_KEY_ID, aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
                    config=Config(retries={"max_attempts": 3, "mode": "standard"}, connect_timeout=10, read_timeout=60,
                                  s3={"addressing_style": "path"}),
                )
            return self._client

    def put_file(self, k: str, fileobj, content_type: str) -> None:
        self.client.upload_fileobj(fileobj, self.bucket, k, ExtraArgs={"ContentType": content_type or "application/octet-stream"})

    def exists(self, k: str) -> bool:
        from botocore.exceptions import ClientError
        try:
            self.client.head_object(Bucket=self.bucket, Key=k)
            return True
        except ClientError as e:
            if e.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
                return False
            raise

    def delete(self, k: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=k)
        # Backblaze B2 keeps every version, and a plain delete only hides the file, so a student's deleted document
        # would stay in the bucket. Remove each version too. R2 has no versions, so the listing comes back empty.
        try:
            listing = self.client.list_object_versions(Bucket=self.bucket, Prefix=k)
        except Exception:
            return
        for v in listing.get("Versions", []) + listing.get("DeleteMarkers", []):
            if v.get("Key") == k and v.get("VersionId"):
                self.client.delete_object(Bucket=self.bucket, Key=k, VersionId=v["VersionId"])

    def _get(self, k: str):
        from botocore.exceptions import ClientError
        try:
            return self.client.get_object(Bucket=self.bucket, Key=k)
        except ClientError as e:
            if e.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
                raise FileNotFoundError(k) from None
            raise

    def read_bytes(self, k: str) -> bytes:
        return self._get(k)["Body"].read()

    def response(self, k: str, media_type: Optional[str], headers: dict, filename: Optional[str]) -> Response:
        obj = self._get(k)
        body = obj["Body"]
        headers = dict(headers)
        if filename and "content-disposition" not in {h.lower() for h in headers}:
            safe = filename.replace('"', "")[:150]
            headers["Content-Disposition"] = f'attachment; filename="{safe}"'
        if obj.get("ContentLength") is not None:
            headers["Content-Length"] = str(obj["ContentLength"])

        def stream():
            try:
                yield from body.iter_chunks(CHUNK)
            finally:
                body.close()
        return StreamingResponse(stream(), media_type=media_type or obj.get("ContentType"), headers=headers)

    def keys(self, prefix: str = "") -> Iterator[str]:
        for page in self.client.get_paginator("list_objects_v2").paginate(Bucket=self.bucket, Prefix=prefix):
            for o in page.get("Contents", []):
                yield o["Key"]


_backend = None
_backend_lock = threading.Lock()


def backend():
    global _backend
    with _backend_lock:
        if _backend is None:
            kind = (settings.STORAGE_BACKEND or "local").lower()
            if kind not in ("local", "s3"):
                raise RuntimeError(f"STORAGE_BACKEND must be 'local' or 's3', not {kind!r}")
            _backend = S3Storage() if kind == "s3" else LocalStorage()
        return _backend


# ── What the features call ───────────────────────────────────────────────────
def save_upload(k: str, head: bytes, fileobj, max_bytes: int, content_type: str) -> dict:
    """Store `head` + the rest of `fileobj` at key k, refusing more than max_bytes (raises TooLarge, nothing kept).
    Buffered in a temporary file (memory up to 1 MB) so a large upload never sits in RAM."""
    digest = hashlib.sha256(head)
    size = len(head)
    with tempfile.SpooledTemporaryFile(max_size=CHUNK) as buf:
        buf.write(head)
        while chunk := fileobj.read(CHUNK):
            size += len(chunk)
            if size > max_bytes:
                raise TooLarge(k)
            digest.update(chunk)
            buf.write(chunk)
        buf.seek(0)
        backend().put_file(k, buf, content_type)
    return {"size": size, "sha256": digest.hexdigest()}


def save_bytes(k: str, data: bytes, content_type: str) -> None:
    import io
    backend().put_file(k, io.BytesIO(data), content_type)


def exists(k: str) -> bool:
    return backend().exists(k)


def delete(k: str) -> None:
    """Remove a file; a missing file is not an error."""
    try:
        backend().delete(k)
    except FileNotFoundError:
        pass


def read_bytes(k: str) -> bytes:
    """The file's contents (raises FileNotFoundError)."""
    return backend().read_bytes(k)


def send(k: str, media_type: Optional[str] = None, headers: Optional[dict] = None, filename: Optional[str] = None,
         missing_status: int = 404, missing_detail: str = "File not found") -> Response:
    """An HTTP response with the file (streamed from the bucket in s3 mode), or HTTPException if it's gone."""
    try:
        return backend().response(k, media_type, headers or {}, filename)
    except FileNotFoundError:
        raise HTTPException(status_code=missing_status, detail=missing_detail) from None
