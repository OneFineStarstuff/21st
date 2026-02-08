import unittest
import torch
from model import DynamicRouter, PerceptionModule, AdvancedDNC, DecisionMakingModule, UnifiedAGISystem

class TestAGISystem(unittest.TestCase):
    def test_dynamic_router(self):
        input_dim = 16
        output_dim = 8
        router = DynamicRouter(input_dim, output_dim)
        x = torch.randn(2, input_dim)
        output = router(x)
        self.assertEqual(output.shape, (2, output_dim))

    def test_perception_module(self):
        # Reduced dims for testing
        hidden_dim = 32
        sensor_dim = 10
        perception = PerceptionModule(sensor_dim, hidden_dim)

        text = torch.randint(0, 100, (2, 16))
        image = torch.randn(2, 3, 224, 224)
        sensor = torch.randn(2, sensor_dim)

        output = perception(text, image, sensor)
        self.assertEqual(output.shape, (2, hidden_dim))

    def test_advanced_dnc(self):
        input_size = 16
        hidden_size = 32
        memory_size = 10
        dnc = AdvancedDNC(input_size, hidden_size, memory_size)

        input_seq = torch.randn(2, 1, input_size)
        output, (h, c) = dnc(input_seq)

        self.assertEqual(output.shape, (2, hidden_size))
        self.assertEqual(h.shape, (1, 2, hidden_size))

    def test_unified_system(self):
        sensor_dim = 10
        hidden_dim = 32
        model = UnifiedAGISystem(sensor_dim, hidden_dim)

        text = torch.randint(0, 100, (1, 16))
        image = torch.randn(1, 3, 224, 224)
        sensor = torch.randn(1, sensor_dim)

        logits, value = model(text, image, sensor)
        self.assertEqual(logits.shape, (1, 10))
        self.assertEqual(value.shape, (1, 1))

if __name__ == '__main__':
    unittest.main()
