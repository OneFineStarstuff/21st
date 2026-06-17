import logging
from typing import List, Optional

import torch
import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from model import UnifiedAGISystem
from pydantic import BaseModel

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s"
)

app = FastAPI(
    title="Unified AGI System API",
    description="MAS FEAT and HKMA Ethics compliant AGI system.",
)

# Global model instance
model = UnifiedAGISystem(sensor_dim=10, hidden_dim=256)
model.eval()


class PredictionRequest(BaseModel):
    """Request model for AGI prediction."""

    text_tokens: List[int]
    sensor_data: List[float]
    prev_h: Optional[List[float]] = None
    prev_c: Optional[List[float]] = None
    prev_r: Optional[List[float]] = None


class PredictionResponse(BaseModel):
    """Response model for AGI prediction."""

    policy: List[float]
    value: float
    parity_deviation: float
    next_h: List[float]
    next_c: List[float]
    next_r: List[float]


@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """
    Exposes the AGI system's forward pass via HTTP.

    Args:
        request (PredictionRequest): Input data for the model.

    Returns:
        PredictionResponse: Model outputs and compliance metrics.
    """
    try:
        text = torch.tensor([request.text_tokens])
        sensor = torch.tensor([request.sensor_data])
        # Image is mocked here for simple text/sensor requests
        image = torch.zeros(1, 3, 224, 224)

        prev_state = None
        if request.prev_h and request.prev_c and request.prev_r:
            prev_state = (
                torch.tensor([request.prev_h]),
                torch.tensor([request.prev_c]),
                torch.tensor([request.prev_r]),
            )

        with torch.no_grad():
            policy, value, parity_deviation, next_state = model(
                text, image, sensor, prev_state
            )

        next_h, next_c, next_r = next_state

        return PredictionResponse(
            policy=policy[0].tolist(),
            value=value[0].item(),
            parity_deviation=parity_deviation.item(),
            next_h=next_h[0].tolist(),
            next_c=next_c[0].tolist(),
            next_r=next_r[0].tolist(),
        )
    except Exception as e:
        logging.error("Prediction error: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy", "compliance": "active"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
