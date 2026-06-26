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

        policy, value, compliance_data, next_state = self.model(text, image, sensor)

        self.assertEqual(policy.shape, (batch_size, 10))
        self.assertEqual(value.shape, (batch_size, 1))
        if not isinstance(compliance_data, dict):
            raise RuntimeError("compliance_data should be a dict")
        self.assertIn("parity_deviation", compliance_data)
        self.assertIn("gsri", compliance_data)
        self.assertIn("maturity_score", compliance_data)
        self.assertIn("proof", compliance_data)
        self.assertEqual(len(next_state), 3)

    def test_compliance_metrics(self):
        """Tests specifically for compliance metrics and maturity scoring."""
        batch_size = 1
        text = torch.randint(0, 100, (batch_size, 5))
        image = torch.randn(batch_size, 3, 224, 224)
        sensor = torch.randn(batch_size, 10)

        _, _, compliance_data, _ = self.model(
            text, image, sensor, compute_attributions=True
        )

        self.assertGreaterEqual(compliance_data["maturity_score"], 1)
        self.assertLessEqual(compliance_data["maturity_score"], 4)
        self.assertIn("is_compliant", compliance_data["proof"])
        self.assertIn("attestation", compliance_data["proof"])
        self.assertIn("attributions", compliance_data)

    def test_safetensors_serialization(self):
        """Tests saving and loading with safetensors."""
        # Save model
        self.model.save_to_safetensors(self.test_path)
        if not os.path.exists(self.test_path):
            raise RuntimeError("Model file not found after save")

        # Load model into a new instance
        new_model = UnifiedAGISystem(10, hidden_dim=self.hidden_dim)
        new_model.load_from_safetensors(self.test_path)

        # Check some parameters
        for p1, p2 in zip(self.model.parameters(), new_model.parameters()):
            if not torch.equal(p1, p2):
                raise RuntimeError("Parameters not equal after load")


if __name__ == "__main__":
    unittest.main()
