from fastapi import APIRouter
from backend.app.schemas.campus import ForecastRequest, ForecastResponse, ChatMessage, ChatResponse
from backend.app.ai.forecasting import CampusAIForecaster
from backend.app.ai.assistant import CampusAIAssistant

router = APIRouter()

@router.post("/forecast", response_model=ForecastResponse)
def get_ai_forecast(req: ForecastRequest):
    if req.module == "energy":
        res = CampusAIForecaster.predict_energy_consumption([1500, 1842, 1920, 1755, 1900])
        return ForecastResponse(
            module="energy",
            forecast_values=res["forecast_kwh"][:5],
            confidence_score=res["confidence_score"],
            insights=res["insights"]
        )
    elif req.module == "parking":
        res = CampusAIForecaster.predict_parking_occupancy(84)
        return ForecastResponse(
            module="parking",
            forecast_values=[float(x) for x in res["next_3h_occupancy"]],
            confidence_score=res["confidence_score"],
            insights=res["status"]
        )
    else:
        res = CampusAIForecaster.predict_crowd_density(2840)
        return ForecastResponse(
            module="crowd",
            forecast_values=[float(res["next_hour_count"])],
            confidence_score=0.90,
            insights=res["alert"]
        )

@router.post("/chat", response_model=ChatResponse)
def ai_assistant_chat(msg: ChatMessage):
    res = CampusAIAssistant.answer_query(msg.message)
    return ChatResponse(reply=res["reply"], sources=res["sources"])
