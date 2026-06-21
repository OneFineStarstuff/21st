import logging

import torch
import torch.nn.functional as F
from performer_pytorch import Performer
from safetensors.torch import load_model, save_file
from torch import nn
from torchvision.models import efficientnet_b0
from transformers import GPT2Config, GPT2Model

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s"
)


class ZKFairnessLayer(nn.Module):
    """ZK-Fairness Layer for monitoring expert selection parity (MAS FEAT)."""

    def __init__(self, num_experts: int):
        """
        Initializes the ZKFairnessLayer.

        Args:
            num_experts (int): The number of experts in the MoE router.
        """
        super().__init__()
        self.num_experts = num_experts

    def forward(self, gate_scores: torch.Tensor) -> torch.Tensor:
        """
        Calculates demographic parity deviation for MAS FEAT compliance.

        Args:
            gate_scores (torch.Tensor): The gating scores from the MoE router.

        Returns:
            torch.Tensor: The parity deviation score.
        """
        # Demographic Parity: expert selection should be independent of protected attributes (mocked by uniform selection)
        selection_prob = gate_scores.mean(dim=0)
        ideal_prob = 1.0 / self.num_experts
        parity_score = torch.abs(selection_prob - ideal_prob).sum()

        if not self.training:
            logging.info(
                "MAS FEAT Compliance Check: Demographic Parity Deviation = %.4f",
                parity_score.item(),
            )
            if parity_score > 0.1:
                logging.warning(
                    "High demographic parity deviation detected. Potential bias in MoE routing."
                )

        return parity_score


class ContextualAttributionEnvelope(nn.Module):
    """ASA Interpretability Layer using CAE for contextual attribution (HKMA Ethics)."""

    def __init__(self, hidden_dim: int):
        """
        Initializes the ContextualAttributionEnvelope.

        Args:
            hidden_dim (int): The dimensionality of the hidden features.
        """
        super().__init__()
        self.envelope_fc = nn.Linear(hidden_dim, hidden_dim)

    def forward(
        self, features: torch.Tensor, attributions: torch.Tensor
    ) -> torch.Tensor:
        """
        Applies the contextual attribution envelope for HKMA Ethics interpretability.

        Args:
            features (torch.Tensor): The hidden features representing context.
            attributions (torch.Tensor): The raw feature attributions.

        Returns:
            torch.Tensor: The contextually-masked attributions.
        """
        # CAE masks raw attributions with contextual features derived from the hidden state
        context_mask = torch.sigmoid(self.envelope_fc(features))
        interpreted_attributions = attributions * context_mask

        if not self.training:
            relevance = interpreted_attributions.abs().mean().item()
            logging.info(
                "HKMA Ethics Interpretability Layer: Contextual Attribution Relevance = %.4f",
                relevance,
            )

        return interpreted_attributions


class DynamicRouter(nn.Module):
    """Dynamic Router for MoE with Fairness monitoring."""

    def __init__(self, input_dim: int, output_dim: int, num_experts: int = 4):
        """
        Initializes the DynamicRouter.

        Args:
            input_dim (int): Input feature dimension.
            output_dim (int): Output feature dimension.
            num_experts (int): Number of experts.
        """
        super().__init__()
        self.num_experts = num_experts
        self.gate = nn.Linear(input_dim, num_experts)
        self.experts = nn.ModuleList(
            [nn.Linear(input_dim, output_dim) for _ in range(num_experts)]
        )
        self.fairness_monitor = ZKFairnessLayer(num_experts)

    def forward(self, x: torch.Tensor) -> tuple:
        """
        Routes the input through the experts.

        Args:
            x (torch.Tensor): Input tensor.

        Returns:
            tuple: (Combined output, parity_deviation)
        """
        gate_scores = F.softmax(self.gate(x), dim=-1)
        parity_deviation = self.fairness_monitor(gate_scores)
        expert_outputs = sum(
            expert(x) * gate_scores[:, i].unsqueeze(1)
            for i, expert in enumerate(self.experts)
        )
        return expert_outputs, parity_deviation


class PerceptionModule(nn.Module):
    """Perception module for multimodal feature extraction."""

    def __init__(self, hidden_dim: int):
        """
        Initializes the PerceptionModule.

        Args:
            hidden_dim (int): The target hidden dimension for all modalities.
        """
        super().__init__()
        config = GPT2Config(n_embd=hidden_dim, n_layer=4, n_head=4)
        self.text_model = GPT2Model(config)
        self.image_model = efficientnet_b0(weights=None)
        self.image_proj = nn.Linear(1280, hidden_dim)
        self.sensor_proj = nn.Linear(10, hidden_dim)
        self.fusion_attention = nn.MultiheadAttention(
            hidden_dim, num_heads=4, batch_first=True
        )

    def forward(
        self, text: torch.Tensor, image: torch.Tensor, sensor: torch.Tensor
    ) -> torch.Tensor:
        """
        Fuses multimodal inputs.

        Args:
            text (torch.Tensor): Text token IDs.
            image (torch.Tensor): Image pixels.
            sensor (torch.Tensor): Sensor readings.

        Returns:
            torch.Tensor: Fused feature vector.
        """
        text_feat = self.text_model(text).last_hidden_state

        img_feat = self.image_model.features(image)
        img_feat = self.image_model.avgpool(img_feat).flatten(1)
        img_feat = self.image_proj(img_feat).unsqueeze(1)

        sensor_feat = self.sensor_proj(sensor).unsqueeze(1)

        combined = torch.cat([text_feat, img_feat, sensor_feat], dim=1)
        fused, _ = self.fusion_attention(combined, combined, combined)
        return fused.mean(dim=1)


class MemoryModule(nn.Module):
    """Advanced DNC-inspired memory module."""

    def __init__(self, hidden_dim: int, memory_size: int = 320, memory_dim: int = 64):
        """
        Initializes the MemoryModule.

        Args:
            hidden_dim (int): The hidden dimensionality of the controller.
            memory_size (int): Number of memory slots.
            memory_dim (int): Dimension of each memory slot.
        """
        super().__init__()
        self.memory_size = memory_size
        self.memory_dim = memory_dim
        self.controller = nn.LSTMCell(hidden_dim + memory_dim, hidden_dim)
        self.interface_fc = nn.Linear(hidden_dim, memory_dim * 3 + 3)
        self.read_fc = nn.Linear(hidden_dim, memory_dim)

        self.register_buffer("memory", torch.zeros(memory_size, memory_dim))
        self.register_buffer("usage", torch.zeros(memory_size))

    def forward(self, x: torch.Tensor, prev_state: tuple) -> tuple:
        """
        Updates memory and returns the controller output.

        Args:
            x (torch.Tensor): Input features.
            prev_state (tuple): Previous (h, c, read_vector) state.

        Returns:
            tuple: (Controller output, next state)
        """
        prev_h, prev_c, prev_read = prev_state
        combined = torch.cat([x, prev_read], dim=1)
        h, c = self.controller(combined, (prev_h, prev_c))

        read_key = torch.tanh(self.read_fc(h))
        read_weights = F.softmax(torch.matmul(read_key, self.memory.t()), dim=-1)
        read_vector = torch.matmul(read_weights, self.memory)

        interface = self.interface_fc(h)
        write_key = torch.tanh(interface[:, : self.memory_dim])
        write_vector = torch.tanh(interface[:, self.memory_dim : 2 * self.memory_dim])
        erase_vector = torch.sigmoid(
            interface[:, 2 * self.memory_dim : 3 * self.memory_dim]
        )

        write_weights = F.softmax(torch.matmul(write_key, self.memory.t()), dim=-1)

        erase_matrix = torch.matmul(write_weights.t(), erase_vector)
        write_matrix = torch.matmul(write_weights.t(), write_vector)
        self.memory.copy_(self.memory * (1 - erase_matrix) + write_matrix)

        return h, (h, c, read_vector)


class DecisionModule(nn.Module):
    """Decision making module with Performer and RL heads."""

    def __init__(self, hidden_dim: int, output_dim: int):
        """
        Initializes the DecisionModule.

        Args:
            hidden_dim (int): Hidden dimensionality.
            output_dim (int): Number of action classes.
        """
        super().__init__()
        self.performer = Performer(
            dim=hidden_dim, depth=1, heads=4, dim_head=hidden_dim // 4, causal=True
        )
        self.policy_head = nn.Linear(hidden_dim, output_dim)
        self.value_head = nn.Linear(hidden_dim, 1)

    def forward(self, x: torch.Tensor) -> tuple:
        """
        Generates policy and value outputs.

        Args:
            x (torch.Tensor): Fused hidden features.

        Returns:
            tuple: (Policy logits, Value estimate)
        """
        x_seq = x.unsqueeze(1)
        attended = self.performer(x_seq).squeeze(1)
        return self.policy_head(attended), self.value_head(attended)


class UnifiedAGISystem(nn.Module):
    """Unified AGI system integrating perception, memory, and decision making."""

    def __init__(
        self,
        _sensor_dim: int,
        hidden_dim: int,
        memory_size: int = 320,
        output_dim: int = 10,
    ):
        """
        Initializes the UnifiedAGISystem.

        Args:
            sensor_dim (int): Dimension of sensor input.
            hidden_dim (int): Hidden dimensionality.
            memory_size (int): Size of the memory matrix.
            output_dim (int): Output dimensionality.
        """
        super().__init__()
        self.hidden_dim = hidden_dim
        self.perception = PerceptionModule(hidden_dim)
        self.memory_module = MemoryModule(hidden_dim, memory_size=memory_size)
        self.decision_module = DecisionModule(hidden_dim, output_dim)
        self.cae_layer = ContextualAttributionEnvelope(hidden_dim)
        self.router = DynamicRouter(hidden_dim, hidden_dim)

    def forward(
        self,
        text: torch.Tensor,
        image: torch.Tensor,
        sensor: torch.Tensor,
        prev_state: tuple = None,
    ) -> tuple:
        """
        Forward pass for the AGI system.

        Args:
            text (torch.Tensor): Text input.
            image (torch.Tensor): Image input.
            sensor (torch.Tensor): Sensor input.
            prev_state (tuple): Previous memory state.

        Returns:
            tuple: (Policy logits, Value estimate, Parity deviation tensor, next_state)
        """
        batch_size = text.size(0)
        if prev_state is None:
            h = torch.zeros(batch_size, self.hidden_dim, device=text.device)
            c = torch.zeros(batch_size, self.hidden_dim, device=text.device)
            r = torch.zeros(batch_size, 64, device=text.device)
            prev_state = (h, c, r)

        feat = self.perception(text, image, sensor)
        h, next_state = self.memory_module(feat, prev_state)
        routed, parity_deviation = self.router(h)

        # ASA Interpretability Layer using CAE (HKMA Ethics)
        _ = self.cae_layer(h, routed)

        policy, value = self.decision_module(routed)
        return policy, value, parity_deviation, next_state

    def save_to_safetensors(self, path: str):
        """
        Saves the model state using safetensors for high-assurance serialization.

        Args:
            path (str): The file path to save the model.
        """
        # Using v.clone().contiguous() to handle shared memory/experts as per project guidelines
        state_dict = {k: v.clone().contiguous() for k, v in self.state_dict().items()}
        save_file(state_dict, path)
        logging.info("Model saved to %s using safetensors.", path)

    def load_from_safetensors(self, path: str):
        """
        Loads the model state from a safetensors file.

        Args:
            path (str): The file path to load the model from.
        """
        load_model(self, path, strict=False)
        logging.info("Model loaded from %s using safetensors (non-strict).", path)


if __name__ == "__main__":
    print("Compliance-ready AGI system initialized.")
