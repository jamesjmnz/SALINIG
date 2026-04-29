from typing import Literal
from pydantic import BaseModel

class AnalyzeRequest(BaseModel):
    channel: Literal["web_search"] = "web_search"
    monitoring_window: str = "past 24 hours"
    prioritize_themes: list[str]
    place: str
