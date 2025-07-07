from fastapi import APIRouter, Request, HTTPException
import hmac
import hashlib
from app.core.config import settings

router = APIRouter()

@router.post("/n8n")
async def n8n_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("X-Webhook-Signature")
    
    if signature:
        expected_signature = hmac.new(
            settings.WEBHOOK_SECRET.encode(),
            body,
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(signature, expected_signature):
            raise HTTPException(status_code=401, detail="Invalid signature")
    
    return {"status": "received"}