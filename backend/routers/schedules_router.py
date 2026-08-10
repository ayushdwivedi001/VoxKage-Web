from fastapi import APIRouter, Depends

from auth import get_current_user
from database import list_schedules, create_schedule, update_schedule, delete_schedule
from models_schemas import CreateScheduleRequest, UpdateScheduleRequest

router = APIRouter(tags=["schedules"])


@router.get("/schedules")
def get_user_schedules(user: str = Depends(get_current_user)):
    return list_schedules(user)


@router.post("/schedules")
def post_schedule(req: CreateScheduleRequest, user: str = Depends(get_current_user)):
    return create_schedule(
        user_id=user,
        name=req.name,
        instruction=req.instruction,
        cron_expression=req.cron_expression,
        interval_hours=req.interval_hours,
        timezone=req.timezone,
        retrieval_method=req.retrieval_method
    )


@router.put("/schedules/{schedule_id}")
def put_schedule(schedule_id: str, req: UpdateScheduleRequest, user: str = Depends(get_current_user)):
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    return update_schedule(schedule_id, user, update_data)


@router.delete("/schedules/{schedule_id}")
def delete_user_schedule(schedule_id: str, user: str = Depends(get_current_user)):
    return delete_schedule(schedule_id, user)
