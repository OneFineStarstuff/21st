import logging
import torch
import torch.nn.functional as F
from captum.attr import IntegratedGradients
from performer_pytorch import Performer
from safetensors.torch import save_file
from torch import nn
from torch.amp import GradScaler, autocast
from torch.distributions import Categorical
from torch.optim import AdamW
from torch.optim.lr_scheduler import OneCycleLR
from torch.utils.checkpoint import checkpoint
from torch.utils.data import DataLoader, Dataset
from torchvision import models
from transformers import GPT2Model

# --- Logger Setup ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)


# --- ZK-Fairness Monitoring (Demographic Parity) ---
class ZKFairnessLayer(nn.Module):
    """ZK-Fairness Layer for monitoring expert selection parity."""

    def __init__(self, num_experts: int):
        """Initializes the ZKFairnessLayer.

        Args:
            num_experts (int): The number of experts in the MoE.
        """
        super().__init__()
        self.num_experts = num_experts

    def forward(self, gate_scores: torch.Tensor) -> torch.Tensor:
        """Calculates demographic parity for expert selection.

        Args:
            gate_scores (torch.Tensor): Softmax output from MoE gate.

        Returns:
            torch.Tensor: Parity scores per expert.
        """
        selection_prob = gate_scores.mean(dim=0)
        ideal_prob = 1.0 / self.num_experts
        parity_score = torch.abs(selection_prob - ideal_prob)

        if not self.training:
            logging.info(
                "ZK-Fairness (Demographic Parity) Deviation: %s",
                parity_score
            )

        return parity_score


# --- Contextual Attribution Envelopes (CAE) ---
class ContextualAttributionEnvelope(nn.Module):
    """ASA Interpretability Layer using CAE for contextual attribution."""

    def __init__(self, hidden_dim: int):
        """Initializes the CAE layer.

        Args:
            hidden_dim (int): The hidden dimension size.
        """
        super().__init__()
        self.envelope_fc = nn.Linear(hidden_dim, hidden_dim)

    def forward(self, features: torch.Tensor,
                attributions: torch.Tensor) -> torch.Tensor:
        """Wraps raw attributions in a contextual envelope.

        Args:
            features (torch.Tensor): The input features.
            attributions (torch.Tensor): Raw attributions from IG.

        Returns:
            torch.Tensor: Contextually refined attributions.
        """
        context = torch.sigmoid(self.envelope_fc(features))
        refined_attr = attributions * context
        return refined_attr


# --- Custom Dynamic Router (Mixture of Experts) ---
class DynamicRouter(nn.Module):
    """Dynamic Router for MoE with Fairness monitoring."""

    def __init__(self, input_dim: int, output_dim: int, num_experts: int = 4):
        """Initializes the DynamicRouter.

        Args:
            input_dim (int): Dimension of the input features.
            output_dim (int): Dimension of the output features.
            num_experts (int): Number of experts to route to.
        """
        super().__init__()
        self.num_experts = num_experts
        self.gate = nn.Linear(input_dim, num_experts)
        self.experts = nn.ModuleList(
            [nn.Linear(input_dim, output_dim) for _ in range(num_experts)]
        )
        self.fairness_monitor = ZKFairnessLayer(num_experts)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Routes input through experts based on gate scores.

        Args:
            x (torch.Tensor): Input tensor.

        Returns:
            torch.Tensor: Weighted sum of expert outputs.
        """
        gate_scores = F.softmax(self.gate(x), dim=-1)
        self.fairness_monitor(gate_scores)
        output = sum(
            expert(x) * gate_scores[:, i].unsqueeze(1)
            for i, expert in enumerate(self.experts)
        )
        return output


# --- Unified Perception Module ---
class PerceptionModule(nn.Module):
    """Unified module for processing text, image, and sensor data."""

    def __init__(self, sensor_dim: int, hidden_dim: int):
        """Initializes the PerceptionModule.

        Args:
            sensor_dim (int): Dimension of sensor data.
            hidden_dim (int): Hidden dimension size.
        """
        super().__init__()
        # Pinning revision for security (CWE-494)
        self.text_model = GPT2Model.from_pretrained(
            "gpt2",
            revision="607a30d783dfa663caf39e06633721c8d4cfcd7e"
        )
        self.text_fc = nn.Linear(
            self.text_model.config.hidden_size, hidden_dim
        )

        self.image_model = models.efficientnet_b0(
            weights='IMAGENET1K_V1'
        )
        num_ftrs = self.image_model.classifier[-1].in_features
        self.image_model.classifier = nn.Identity()
        self.image_fc = nn.Linear(num_ftrs, hidden_dim)

        self.sensor_fc = nn.Linear(sensor_dim, hidden_dim)
        self.cross_attention = nn.MultiheadAttention(
            embed_dim=hidden_dim, num_heads=2
        )

    def forward(self, text: torch.Tensor, image: torch.Tensor,
                sensor: torch.Tensor) -> torch.Tensor:
        """Processes text, image, and sensor data.

        Args:
            text (torch.Tensor): Tokenized text input.
            image (torch.Tensor): Image tensor input.
            sensor (torch.Tensor): Sensor data tensor.

        Returns:
            torch.Tensor: Fused multimodal features.
        """
        text_features = self.text_fc(
            self.text_model(text).last_hidden_state.mean(dim=1)
        )
        image_features = self.image_fc(self.image_model(image))
        sensor_features = self.sensor_fc(sensor)

        stacked_features = torch.stack(
            [text_features, image_features, sensor_features], dim=1
        )
        cross_attn_output, _ = self.cross_attention(
            stacked_features, stacked_features, stacked_features
        )
        return cross_attn_output.mean(dim=1)


# --- Advanced DNC with Dynamic Memory and Gradient Checkpointing ---
class AdvancedDNC(nn.Module):
    """Differentiable Neural Computer module with dynamic memory."""

    def __init__(self, input_size: int, hidden_size: int, memory_size: int):
        """Initializes the AdvancedDNC.

        Args:
            input_size (int): Dimension of input features.
            hidden_size (int): Hidden dimension size.
            memory_size (int): Size of the memory matrix.
        """
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, batch_first=True)
        self.memory = nn.Parameter(torch.randn(memory_size, hidden_size))
        self.read_fc = nn.Linear(hidden_size + memory_size, hidden_size)
        self.dynamic_router = DynamicRouter(hidden_size, hidden_size)

    def forward(self, input_seq: torch.Tensor,
                hidden_state: tuple = None) -> tuple:
        """Processes sequence through LSTM and routes to memory.

        Args:
            input_seq (torch.Tensor): Input sequence tensor.
            hidden_state (tuple, optional): Initial hidden state.

        Returns:
            tuple: (routed_output, hidden_state)
        """
        def lstm_forward(x, h_s):
            return self.lstm(x, h_s)

        # Handle None hidden state for checkpointing
        if hidden_state is None:
            batch_size = input_seq.size(0)
            device = input_seq.device
            h0 = torch.zeros(
                1, batch_size, self.lstm.hidden_size, device=device
            )
            c0 = torch.zeros(
                1, batch_size, self.lstm.hidden_size, device=device
            )
            hidden_state = (h0, c0)

        out, (hidden, cell) = checkpoint(
            lstm_forward, input_seq, hidden_state, use_reentrant=False
        )

        # out: (batch, seq_len, hidden_size)
        read_memory = torch.matmul(out, self.memory.T)
        combined = torch.cat([out, read_memory], dim=-1)

        # Take last step or mean if seq_len > 1
        if combined.size(1) == 1:
            combined_flattened = combined.squeeze(1)
        else:
            combined_flattened = combined.mean(dim=1)

        routed_output = self.dynamic_router(
            F.relu(self.read_fc(combined_flattened))
        )
        return routed_output, (hidden, cell)


# --- Decision Making with RL ---
class DecisionMakingModule(nn.Module):
    """Module for decision making using Reinforcement Learning."""

    def __init__(self, input_dim: int, output_dim: int):
        """Initializes the DecisionMakingModule.

        Args:
            input_dim (int): Dimension of input features.
            output_dim (int): Number of possible actions.
        """
        super().__init__()
        self.performer = Performer(
            dim=input_dim, dim_head=32, depth=1, heads=2
        )
        self.policy = nn.Linear(input_dim, output_dim)
        self.value = nn.Linear(input_dim, 1)

    def forward(self, features: torch.Tensor) -> tuple:
        """Computes policy logits and value estimates.

        Args:
            features (torch.Tensor): Input features.

        Returns:
            tuple: (policy_logits, value_estimate)
        """
        # features: (batch, input_dim)
        features = self.performer(features.unsqueeze(1))
        features_sq = features.squeeze(1)
        policy_logits = self.policy(features_sq)
        value_estimate = self.value(features_sq)
        return policy_logits, value_estimate

    def select_action(self, features: torch.Tensor) -> tuple:
        """Selects an action based on the current policy.

        Args:
            features (torch.Tensor): Input features.

        Returns:
            tuple: (action, log_prob)
        """
        policy_logits, _ = self.forward(features)
        probs = F.softmax(policy_logits, -1)
        dist = Categorical(probs)
        action = dist.sample()
        return action.item(), dist.log_prob(action)


# --- Unified AGI System ---
class UnifiedAGISystem(nn.Module):
    """Complete AGI system integrating perception, memory, and decision making."""

    def __init__(self, sensor_dim: int, hidden_dim: int,
                 memory_size: int = 320, output_dim: int = 10):
        """Initializes the UnifiedAGISystem.

        Args:
            sensor_dim (int): Dimension of sensor data.
            hidden_dim (int): Hidden dimension size.
            memory_size (int): Size of the memory matrix.
            output_dim (int): Number of output classes/actions.
        """
        super().__init__()
        self.perception_module = PerceptionModule(sensor_dim, hidden_dim)
        self.memory_module = AdvancedDNC(hidden_dim, hidden_dim, memory_size)
        self.decision_making_module = DecisionMakingModule(
            hidden_dim, output_dim
        )
        self.cae_layer = ContextualAttributionEnvelope(hidden_dim)

    def forward(self, text: torch.Tensor, image: torch.Tensor,
                sensor: torch.Tensor) -> tuple:
        """Forward pass through the entire system.

        Args:
            text (torch.Tensor): Text input tokens.
            image (torch.Tensor): Image input tensor.
            sensor (torch.Tensor): Sensor input tensor.

        Returns:
            tuple: (policy_logits, value_estimate)
        """
        features = self.perception_module(text, image, sensor)
        memory_output, _ = self.memory_module(features.unsqueeze(1))
        policy_logits, value_estimate = self.decision_making_module(
            memory_output
        )
        return policy_logits, value_estimate

    def explain_decision(self, text_input: torch.Tensor,
                         image_tensor: torch.Tensor,
                         sensor_tensor: torch.Tensor,
                         target_class: int = 0) -> torch.Tensor:
        """Explains the system's decision using CAE.

        Args:
            text_input (torch.Tensor): Text input.
            image_tensor (torch.Tensor): Image input.
            sensor_tensor (torch.Tensor): Sensor input.
            target_class (int): Target class for attribution.

        Returns:
            torch.Tensor: Contextually refined attributions.
        """
        features = self.perception_module(
            text_input, image_tensor, sensor_tensor
        )

        def forward_path(feat):
            mem_out, _ = self.memory_module(feat.unsqueeze(1))
            logits, _ = self.decision_making_module(mem_out)
            return logits

        ig = IntegratedGradients(forward_path)
        attributions = ig.attribute(features, target=target_class)
        refined_attr = self.cae_layer(features, attributions)
        return refined_attr


# --- CustomDataset ---
class CustomDataset(Dataset):
    """Custom dataset for multimodal data."""

    def __init__(self, text_data: list, image_data: list,
                 sensor_data: list, targets: torch.Tensor):
        """Initializes the dataset.

        Args:
            text_data (list): List of text tokens.
            image_data (list): List of image tensors.
            sensor_data (list): List of sensor tensors.
            targets (torch.Tensor): Target labels.
        """
        self.text_data = text_data
        self.image_data = image_data
        self.sensor_data = sensor_data
        self.targets = targets

    def __len__(self) -> int:
        """Returns the length of the dataset."""
        return len(self.targets)

    def __getitem__(self, idx: int) -> tuple:
        """Returns a single item from the dataset.

        Args:
            idx (int): Index of the item.

        Returns:
            tuple: (text, image, sensor, target)
        """
        return (self.text_data[idx], self.image_data[idx],
                self.sensor_data[idx], self.targets[idx])


# --- Training Function ---
def train(model: nn.Module, train_loader: DataLoader,
          optimizer: AdamW, scheduler: OneCycleLR,
          criterion: nn.Module, epochs: int = 10,
          device: str = 'cpu',
          save_path: str = './model_checkpoint.safetensors'):
    """Trains the UnifiedAGISystem model.

    Args:
        model (nn.Module): The model to train.
        train_loader (DataLoader): DataLoader for training.
        optimizer (AdamW): Optimizer.
        scheduler (OneCycleLR): Learning rate scheduler.
        criterion (nn.Module): Loss function.
        epochs (int): Number of epochs.
        device (str): Device to run training on.
        save_path (str): Path to save the model.
    """
    model.to(device)
    # Check for cuda for GradScaler
    is_cuda = 'cuda' in str(device)
    scaler = GradScaler(enabled=is_cuda)
    accumulation_steps = 4

    for epoch in range(epochs):
        model.train()
        epoch_loss = 0
        optimizer.zero_grad()
        for i, batch in enumerate(train_loader):
            text, images, sensors, labels = batch
            text, images, sensors, labels = (
                text.to(device), images.to(device),
                sensors.to(device), labels.to(device)
            )

            # Map 'cuda:0' to 'cuda' etc for autocast
            autocast_device = 'cuda' if is_cuda else 'cpu'

            with autocast(device_type=autocast_device):
                logits, _ = model(text, images, sensors)
                loss = criterion(logits, labels)
                # Scale loss for accumulation
                scaled_loss = loss / accumulation_steps

            scaler.scale(scaled_loss).backward()

            if (i + 1) % accumulation_steps == 0 or \
               (i + 1) == len(train_loader):
                scaler.step(optimizer)
                scaler.update()
                optimizer.zero_grad()

            epoch_loss += loss.item()
            scheduler.step()

        avg_loss = epoch_loss / len(train_loader)
        logging.info("Epoch [%d/%d] Average Loss: %.4f",
                     epoch + 1, epochs, avg_loss)

        if (epoch + 1) % 5 == 0:
            # Note: Use safetensors for secure saving.
            # We clone tensors to avoid issues with shared memory.
            state_dict = {
                k: v.clone().contiguous()
                for k, v in model.state_dict().items()
            }
            save_file(state_dict, save_path)
            logging.info("Checkpoint saved to %s", save_path)


# --- Main Execution ---
def main():
    """Main execution function for training and evaluation."""
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    logging.info("Using device: %s", device)

    # Synthetic data generation
    num_samples = 1000
    text_dim = 256  # Sequence length for GPT2 input
    sensor_dim = 10

    text_data = [
        torch.randint(0, 50257, (text_dim,)) for _ in range(num_samples)
    ]
    image_data = [torch.randn(3, 224, 224) for _ in range(num_samples)]
    sensor_data = [torch.randn(sensor_dim) for _ in range(num_samples)]
    targets = torch.randint(0, 10, (num_samples,))

    dataset = CustomDataset(text_data, image_data, sensor_data, targets)
    train_loader = DataLoader(dataset, batch_size=4, shuffle=True)

    model = UnifiedAGISystem(sensor_dim=sensor_dim, hidden_dim=512)
    optimizer = AdamW(model.parameters(), lr=1e-4)
    scheduler = OneCycleLR(
        optimizer, max_lr=1e-3, total_steps=len(train_loader) * 10
    )
    criterion = nn.CrossEntropyLoss()

    # Train the model
    train(
        model, train_loader, optimizer, scheduler, criterion,
        epochs=10, device=device
    )

    # Example of explanation
    model.eval()
    t, img, sens, _ = dataset[0]
    t, img, sens = (
        t.unsqueeze(0).to(device),
        img.unsqueeze(0).to(device),
        sens.unsqueeze(0).to(device)
    )
    attr = model.explain_decision(t, img, sens)
    logging.info("Attributions shape: %s", attr.shape)


if __name__ == "__main__":
    main()
