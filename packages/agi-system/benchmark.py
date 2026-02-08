import torch
import time
import logging
from model import UnifiedAGISystem

logging.basicConfig(level=logging.INFO)

def benchmark():
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = UnifiedAGISystem(sensor_dim=10, hidden_dim=512).to(device)
    model.eval()

    # Inputs
    text = torch.randint(0, 50257, (1, 256)).to(device)
    image = torch.randn(1, 3, 224, 224).to(device)
    sensor = torch.randn(1, 10).to(device)

    # Warmup
    for _ in range(5):
        with torch.no_grad():
            _ = model(text, image, sensor)

    # Benchmark
    num_runs = 50
    start_time = time.time()
    for _ in range(num_runs):
        with torch.no_grad():
            _ = model(text, image, sensor)

    end_time = time.time()
    avg_time = (end_time - start_time) / num_runs

    logging.info(f"Average inference time over {num_runs} runs: {avg_time*1000:.2f} ms")

if __name__ == "__main__":
    benchmark()
