from fastapi import APIRouter
from backend.app.schemas.campus import ForecastRequest, ForecastResponse
from backend.app.ai.forecasting import CampusAIForecaster

router = APIRouter()

@router.post("/forecast", response_model=ForecastResponse)
def get_ai_forecast(req: ForecastRequest):
    if req.module == "parking":
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
