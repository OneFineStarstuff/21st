import time

import torch
from model import UnifiedAGISystem


def test_benchmark_inference():
    """Benchmarks the inference latency of the UnifiedAGISystem."""
    hidden_dim = 256
    model = UnifiedAGISystem(10, hidden_dim=hidden_dim)
    model.eval()

    batch_size = 1
    text = torch.randint(0, 100, (batch_size, 5))
    image = torch.randn(batch_size, 3, 224, 224)
    sensor = torch.randn(batch_size, 10)

    # Warmup
    for _ in range(5):
        with torch.no_grad():
            _ = model(text, image, sensor)

    start_time = time.time()
    iterations = 10
    for _ in range(iterations):
        with torch.no_grad():
            _ = model(text, image, sensor)
    end_time = time.time()

    avg_latency = (end_time - start_time) / iterations
    print(f"\nAverage Inference Latency: {avg_latency:.4f} seconds")

    if avg_latency >= 1.0:
        raise RuntimeError(
            f"Benchmark failed: Average latency {avg_latency:.4f}s exceeds threshold of 1.0s"
        )


if __name__ == "__main__":
    test_benchmark_inference()
