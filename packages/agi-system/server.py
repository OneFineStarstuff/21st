import logging
import torch
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from PIL import Image
import io
from torchvision import transforms
from model import UnifiedAGISystem

# --- Logger Setup ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Unified AGI Inference Server", version="1.0.0")

# --- Model Initialization ---
# In a real production environment, you would load weights from a volume
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
SENSOR_DIM = 10
HIDDEN_DIM = 512
model = UnifiedAGISystem(sensor_dim=SENSOR_DIM, hidden_dim=HIDDEN_DIM)
model.to(device)
model.eval()

# --- Preprocessing ---
image_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])


class InferenceResponse(BaseModel):
    action: int
    action_probability: float
    value_estimate: float


@app.get("/health")
async def health_check():
    return {"status": "healthy", "device": str(device)}


@app.post("/predict", response_model=InferenceResponse)
async def predict(
    text_ids: str = Form(...),  # Expect comma-separated integers
    sensor_data: str = Form(...),  # Expect comma-separated floats
    image: UploadFile = File(...)
):
    try:
        # 1. Process Text
        text_list = [int(i) for i in text_ids.split(",")]
        # Truncate or pad to model's expected sequence length (e.g., 256)
        if len(text_list) > 256:
            text_list = text_list[:256]
        else:
            text_list += [0] * (256 - len(text_list))
        text_tensor = torch.tensor([text_list]).to(device)

        # 2. Process Sensor Data
        sensor_list = [float(s) for s in sensor_data.split(",")]
        if len(sensor_list) != SENSOR_DIM:
            raise HTTPException(
                status_code=400,
                detail=f"Sensor data must have {SENSOR_DIM} values"
            )
        sensor_tensor = torch.tensor([sensor_list]).to(device)

        # 3. Process Image
        image_data = await image.read()
        img = Image.open(io.BytesIO(image_data)).convert("RGB")
        image_tensor = image_transform(img).unsqueeze(0).to(device)

        # 4. Inference
        with torch.no_grad():
            logits, value = model(text_tensor, image_tensor, sensor_tensor)
            probs = torch.softmax(logits, dim=-1)
            action_prob, action = torch.max(probs, dim=-1)

        return {
            "action": int(action.item()),
            "action_probability": float(action_prob.item()),
            "value_estimate": float(value.item())
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error("Inference failed: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    # binding to all interfaces is expected in container (B104)
    uvicorn.run(app, host="0.0.0.0", port=8000)  # nosec
