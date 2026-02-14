# Unified AGI System

This package contains the Unified AGI System, a multimodal model combining text, image, and sensor data using a Mixture of Experts (MoE) router and a Differentiable Neural Computer (DNC) inspired memory module.

## Architecture

- **Perception Module**: Uses GPT-2 for text, EfficientNet-B0 for images, and a linear layer for sensors, combined with multi-head cross-attention.
- **Memory Module**: An Advanced DNC using LSTM and a dynamic memory matrix.
- **Decision Making Module**: Uses a Performer (Fast Attention) and Reinforcement Learning policy/value heads.

## Deployment

### Local Installation

```bash
pip install -r requirements.txt
```

### Running the Inference Server

```bash
# Start the FastAPI server
uvicorn server:app --host 0.0.0.0 --port 8000
```

### API Usage

**POST /predict**

Accepts multipart/form-data:
- `text_ids`: Comma-separated token IDs (e.g., "1,2,3,4")
- `sensor_data`: Comma-separated floats (e.g., "0.1,0.5,0.9,1.0,0.2,0.3,0.4,0.5,0.6,0.7")
- `image`: Image file (PNG/JPEG)

Example using `curl`:
```bash
curl -X POST "http://localhost:8000/predict" \
     -H "Content-Type: multipart/form-data" \
     -F "text_ids=1,2,3,4" \
     -F "sensor_data=0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0" \
     -F "image=@preview.png"
```

### Docker Deployment

```bash
# Build the image
docker build -t agi-inference-server .

# Run the container
docker run -p 8000:8000 agi-inference-server
```

## Automation & Monorepo Integration

This package is integrated into the workspace monorepo and can be managed via `pnpm` and `turbo`.

- **Test**: `pnpm test` (Runs automated unit tests)
- **Benchmark**: `pnpm run benchmark` (Measures inference performance)
- **Lint**: `pnpm run lint` (Static analysis and security scanning)
- **Train**: `pnpm run train` (Standard training pipeline)

## Features

- **Multimodal Integration**: Unified processing of text, vision, and sensor inputs.
- **Dynamic Routing**: Mixture of Experts for efficient computation.
- **Gradient Checkpointing**: Memory-efficient training.
- **Explainability**: Integrated Gradients for decision attribution.
- **Production-Ready API**: FastAPI serving layer with container support.
