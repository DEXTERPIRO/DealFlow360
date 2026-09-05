import uuid, os
from io import BytesIO
from fastapi import UploadFile, HTTPException
from PIL import Image

UPLOAD_DIR = "app/uploads/products"
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE = 5 * 1024 * 1024

async def process_image(file: UploadFile | None) -> str | None:
    if file is None:
        return None
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Only JPEG, PNG and WebP images allowed")
    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(400, "File too large (max 5MB)")

    filename = f"{uuid.uuid4()}.webp"
    output_path = os.path.join(UPLOAD_DIR, filename)

    img = Image.open(BytesIO(contents))
    img.thumbnail((800, 600))          # equivalent to sharp .resize(fit: inside)
    img.convert("RGB").save(output_path, "WEBP", quality=85)

    return f"/uploads/products/{filename}"
