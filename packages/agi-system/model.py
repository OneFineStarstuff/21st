import logging
import torch
from torch import nn
import torch.nn.functional as F
from safetensors.torch import save_file
from torch.utils.data import DataLoader, Dataset
from torchvision import models
from transformers import GPT2Model
from torch.optim import AdamW
from torch.optim.lr_scheduler import OneCycleLR
from torch.amp import GradScaler, autocast
from captum.attr import IntegratedGradients
from performer_pytorch import Performer
from torch.distributions import Categorical
from torch.utils.checkpoint import checkpoint

# --- Logger Setup ---
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")

# --- Custom Dynamic Router (Mixture of Experts) ---
class DynamicRouter(nn.Module):
    def __init__(self, input_dim, output_dim, num_experts=4):
        super().__init__()
        self.num_experts = num_experts
        self.gate = nn.Linear(input_dim, num_experts)
        self.experts = nn.ModuleList([nn.Linear(input_dim, output_dim) for _ in range(num_experts)])

    def forward(self, x):
        gate_scores = F.softmax(self.gate(x), dim=-1)
        output = sum(expert(x) * gate_scores[:, i].unsqueeze(1) for i, expert in enumerate(self.experts))
        return output

# --- Unified Perception Module ---
class PerceptionModule(nn.Module):
    def __init__(self, sensor_dim, hidden_dim):
        super().__init__()
        # Pinning revision for security (CWE-494)
        self.text_model = GPT2Model.from_pretrained(
            "gpt2",
            revision="607a30d783dfa663caf39e06633721c8d4cfcd7e"
        )
        self.text_fc = nn.Linear(self.text_model.config.hidden_size, hidden_dim)

        self.image_model = models.efficientnet_b0(weights='IMAGENET1K_V1')
        num_ftrs = self.image_model.classifier[-1].in_features
        self.image_model.classifier = nn.Identity()
        self.image_fc = nn.Linear(num_ftrs, hidden_dim)

        self.sensor_fc = nn.Linear(sensor_dim, hidden_dim)
        self.cross_attention = nn.MultiheadAttention(embed_dim=hidden_dim, num_heads=2)

    def forward(self, text, image, sensor):
        text_features = self.text_fc(self.text_model(text).last_hidden_state.mean(dim=1))
        image_features = self.image_fc(self.image_model(image))
        sensor_features = self.sensor_fc(sensor)

        stacked_features = torch.stack([text_features, image_features, sensor_features], dim=1)
        cross_attn_output, _ = self.cross_attention(stacked_features, stacked_features, stacked_features)
        return cross_attn_output.mean(dim=1)

# --- Advanced DNC with Dynamic Memory and Gradient Checkpointing ---
class AdvancedDNC(nn.Module):
    def __init__(self, input_size, hidden_size, memory_size):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, batch_first=True)
        self.memory = nn.Parameter(torch.randn(memory_size, hidden_size))
        self.read_fc = nn.Linear(hidden_size + memory_size, hidden_size)
        self.dynamic_router = DynamicRouter(hidden_size, hidden_size)

    def forward(self, input_seq, hidden_state=None):
        def lstm_forward(x, h_s):
            return self.lstm(x, h_s)

        # Handle None hidden state for checkpointing
        if hidden_state is None:
            batch_size = input_seq.size(0)
            device = input_seq.device
            h0 = torch.zeros(1, batch_size, self.lstm.hidden_size, device=device)
            c0 = torch.zeros(1, batch_size, self.lstm.hidden_size, device=device)
            hidden_state = (h0, c0)

        out, (hidden, cell) = checkpoint(lstm_forward, input_seq, hidden_state, use_reentrant=False)

        # out: (batch, seq_len, hidden_size)
        # memory: (memory_size, hidden_size)
        read_memory = torch.matmul(out, self.memory.T) # (batch, seq_len, memory_size)
        combined = torch.cat([out, read_memory], dim=-1) # (batch, seq_len, hidden + memory)

        # We only take the last step or mean if seq_len > 1
        # In current UnifiedAGISystem, seq_len is always 1
        if combined.size(1) == 1:
            combined_flattened = combined.squeeze(1)
        else:
            combined_flattened = combined.mean(dim=1)

        routed_output = self.dynamic_router(F.relu(self.read_fc(combined_flattened)))
        return routed_output, (hidden, cell)

# --- Decision Making with RL ---
class DecisionMakingModule(nn.Module):
    def __init__(self, input_dim, output_dim):
        super().__init__()
        self.performer = Performer(dim=input_dim, dim_head=32, depth=1, heads=2)
        self.policy = nn.Linear(input_dim, output_dim)
        self.value = nn.Linear(input_dim, 1)

    def forward(self, features):
        # features: (batch, input_dim)
        features = self.performer(features.unsqueeze(1)) # (batch, 1, input_dim)
        features_sq = features.squeeze(1)
        policy_logits = self.policy(features_sq)
        value_estimate = self.value(features_sq)
        return policy_logits, value_estimate

    def select_action(self, features):
        policy_logits, _ = self.forward(features)
        probs = F.softmax(policy_logits, -1)
        dist = Categorical(probs)
        action = dist.sample()
        return action.item(), dist.log_prob(action)

# --- Unified AGI System ---
class UnifiedAGISystem(nn.Module):
    def __init__(self, sensor_dim, hidden_dim, memory_size=320, output_dim=10):
        super().__init__()
        self.perception_module = PerceptionModule(sensor_dim, hidden_dim)
        self.memory_module = AdvancedDNC(hidden_dim, hidden_dim, memory_size)
        self.decision_making_module = DecisionMakingModule(hidden_dim, output_dim)

    def forward(self, text, image, sensor):
        features = self.perception_module(text, image, sensor)
        memory_output, _ = self.memory_module(features.unsqueeze(1))
        policy_logits, value_estimate = self.decision_making_module(memory_output)
        return policy_logits, value_estimate

    def explain_decision(self, text_input, image_tensor, sensor_tensor, target_class=0):
        features = self.perception_module(text_input, image_tensor, sensor_tensor)

        # Define a wrapper for IntegratedGradients to attribute from perception features to policy output
        def forward_path(feat):
            mem_out, _ = self.memory_module(feat.unsqueeze(1))
            logits, _ = self.decision_making_module(mem_out)
            return logits

        ig = IntegratedGradients(forward_path)
        attributions = ig.attribute(features, target=target_class)
        return attributions

# --- CustomDataset ---
class CustomDataset(Dataset):
    def __init__(self, text_data, image_data, sensor_data, targets):
        self.text_data = text_data
        self.image_data = image_data
        self.sensor_data = sensor_data
        self.targets = targets

    def __len__(self):
        return len(self.targets)

    def __getitem__(self, idx):
        return self.text_data[idx], self.image_data[idx], self.sensor_data[idx], self.targets[idx]

# --- Training Function ---
def train(model, train_loader, optimizer, scheduler, criterion, epochs=10, device='cpu', save_path='./model_checkpoint.safetensors'):
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
            text, images, sensors, labels = text.to(device), images.to(device), sensors.to(device), labels.to(device)

            # Map 'cuda:0' to 'cuda' etc for autocast
            autocast_device = 'cuda' if is_cuda else 'cpu'

            with autocast(device_type=autocast_device):
                logits, _ = model(text, images, sensors)
                loss = criterion(logits, labels)
                # Scale loss for accumulation
                scaled_loss = loss / accumulation_steps

            scaler.scale(scaled_loss).backward()

            if (i + 1) % accumulation_steps == 0 or (i + 1) == len(train_loader):
                scaler.step(optimizer)
                scaler.update()
                optimizer.zero_grad()

            epoch_loss += loss.item()
            scheduler.step()

        avg_loss = epoch_loss / len(train_loader)
        logging.info("Epoch [%d/%d] Average Loss: %.4f", epoch + 1, epochs, avg_loss)

        if (epoch + 1) % 5 == 0:
            # Note: Use safetensors for secure saving.
            # We clone tensors to avoid issues with shared memory.
            state_dict = {k: v.clone().contiguous() for k, v in model.state_dict().items()}
            save_file(state_dict, save_path)
            logging.info("Checkpoint saved to %s", save_path)

# --- Main Execution ---
def main():
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    logging.info("Using device: %s", device)

    # Synthetic data generation
    num_samples = 1000
    text_dim = 256 # Sequence length for GPT2 input
    sensor_dim = 10

    text_data = [torch.randint(0, 50257, (text_dim,)) for _ in range(num_samples)]
    image_data = [torch.randn(3, 224, 224) for _ in range(num_samples)]
    sensor_data = [torch.randn(sensor_dim) for _ in range(num_samples)]
    targets = torch.randint(0, 10, (num_samples,))

    dataset = CustomDataset(text_data, image_data, sensor_data, targets)
    train_loader = DataLoader(dataset, batch_size=4, shuffle=True)

    model = UnifiedAGISystem(sensor_dim=sensor_dim, hidden_dim=512)
    optimizer = AdamW(model.parameters(), lr=1e-4)
    scheduler = OneCycleLR(optimizer, max_lr=1e-3, total_steps=len(train_loader) * 10)
    criterion = nn.CrossEntropyLoss()

    # Train the model
    train(model, train_loader, optimizer, scheduler, criterion, epochs=10, device=device)

    # Example of explanation
    model.eval()
    t, img, sens, _ = dataset[0]
    t, img, sens = t.unsqueeze(0).to(device), img.unsqueeze(0).to(device), sens.unsqueeze(0).to(device)
    attr = model.explain_decision(t, img, sens)
    logging.info("Attributions shape: %s", attr.shape)

if __name__ == "__main__":
    main()
