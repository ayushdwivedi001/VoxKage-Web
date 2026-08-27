from typing import List, Dict, Optional, Any
from pydantic import BaseModel, EmailStr


class SendOtpRequest(BaseModel):
    email: EmailStr


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str
    user_name: Optional[str] = None


class GoogleAuthRequest(BaseModel):
    credential: str


class OAuthCallbackRequest(BaseModel):
    code: str
    state: Optional[str] = None
    redirect_uri: str


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    user_name: str


class LoginPasswordRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    email: EmailStr
    refresh_token: str


class SendSignupOtpRequest(BaseModel):
    email: EmailStr
    password: str
    confirm_password: str
    user_name: str


class SignUpOtpVerifyRequest(BaseModel):
    email: EmailStr
    password: str
    user_name: str
    otp: str


class SendResetCodeRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    reset_code: str
    new_password: str


class SaveFavoritesRequest(BaseModel):
    favorites: List[str]


class SaveSettingsProfileRequest(BaseModel):
    settings_profile: dict


class PreparePayloadRequest(BaseModel):
    message: str
    attachments: Optional[List[dict]] = []
    model: Optional[str] = "deepseek-flash"
    variant: Optional[str] = "High"
    client_time: Optional[str] = None
    skip_tools: Optional[bool] = False
    plan_mode: Optional[bool] = False


class ExecuteToolsRequest(BaseModel):
    tool_calls: List[dict]


class LogAssistantResponseRequest(BaseModel):
    content: str
    created_files: Optional[dict] = None


class EditMessageRequest(BaseModel):
    new_content: str


class FeedbackRequest(BaseModel):
    feedback_type: str
    comments: Optional[str] = None


class CreateScheduleRequest(BaseModel):
    name: str
    instruction: str
    cron_expression: str
    interval_hours: int
    timezone: str
    retrieval_method: str


class UpdateScheduleRequest(BaseModel):
    name: Optional[str] = None
    instruction: Optional[str] = None
    cron_expression: Optional[str] = None
    interval_hours: Optional[int] = None
    timezone: Optional[str] = None
    retrieval_method: Optional[str] = None
    is_active: Optional[bool] = None


class WordDocCreateRequest(BaseModel):
    doc_id: str
    title: str
    sections: List[Dict[str, Any]]
    author: Optional[str] = None
    header_text: Optional[str] = None
    footer_text: Optional[str] = "Page {page} of {pages}"
    style: Optional[Dict[str, Any]] = None


class WordDocEditRequest(BaseModel):
    doc_id: str
    target_heading_or_index: str
    action: str  # 'replace', 'append', 'insert_after', 'delete'
    new_content: Dict[str, Any]


class ConnectCustomMCPRequest(BaseModel):
    provider: str
    name: Optional[str] = None


class DisconnectRequest(BaseModel):
    provider: str


class RefreshMCPRequest(BaseModel):
    provider: str
