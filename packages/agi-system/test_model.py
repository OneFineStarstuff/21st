import os
import unittest

import torch

from model import UnifiedAGISystem


class TestUnifiedAGISystem(unittest.TestCase):
    """Unit tests for the UnifiedAGISystem."""

    def setUp(self):
        """Sets up the test environment."""
        self.hidden_dim = 256
        self.model = UnifiedAGISystem(10, hidden_dim=self.hidden_dim)
        self.test_path = "test_model.safetensors"

    def tearDown(self):
        """Cleans up after tests."""
        if os.path.exists(self.test_path):
            os.remove(self.test_path)

    def test_forward_pass(self):
        """Tests the model forward pass."""
        batch_size = 2
        text = torch.randint(0, 100, (batch_size, 5))
        image = torch.randn(batch_size, 3, 224, 224)
        sensor = torch.randn(batch_size, 10)

        policy, value, parity, next_state = self.model(text, image, sensor)

        self.assertEqual(policy.shape, (batch_size, 10))
        self.assertEqual(value.shape, (batch_size, 1))
        self.assertIsInstance(parity, torch.Tensor)
        self.assertEqual(len(next_state), 3)

    def test_safetensors_serialization(self):
        """Tests saving and loading with safetensors."""
        # Save model
        self.model.save_to_safetensors(self.test_path)
        self.assertTrue(os.path.exists(self.test_path))

        # Load model into a new instance
        new_model = UnifiedAGISystem(10, hidden_dim=self.hidden_dim)
        new_model.load_from_safetensors(self.test_path)

        # Check some parameters
        for p1, p2 in zip(self.model.parameters(), new_model.parameters()):
            self.assertTrue(torch.equal(p1, p2))


if __name__ == "__main__":
    unittest.main()
