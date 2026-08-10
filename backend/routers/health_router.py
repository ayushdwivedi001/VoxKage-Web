from datetime import datetime
from fastapi import APIRouter
from database import get_db

router = APIRouter(tags=["health"])


@router.get("/")
def get_root():
    return {"message": "VoxKage Web API operational.", "timestamp": datetime.utcnow().isoformat()}


@router.get("/health")
def health_check():
    try:
        get_db().table("user_settings").select("user_id").limit(1).execute()
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {e}"
    return {"status": "alive", "database": db_status, "engine": "VoxKage Web Backend"}
