import torch
import torch.nn as nn
import numpy as np
import os

class QNet(nn.Module):
    def __init__(self, s, a, h):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(s, h), nn.ReLU(),
            nn.Linear(h, h), nn.ReLU(),
            nn.Linear(h, a)
        )

    def forward(self, x):
        return self.net(x)

class DRLService:
    def __init__(self):
        # Default state dimension based on train_adaptive_tls.py
        # 4 lanes * 3 features (queue, total_veh, wait) + 2 actions + 1 time = 15
        self.state_dim = 15
        self.n_actions = 2
        self.hidden = 64
        
        self.agent = QNet(self.state_dim, self.n_actions, self.hidden)
        
        # Load pre-trained weights
        model_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))),
            "ml_models", "RL_adaptiveTraffic", "dqn_tls.pt"
        )
        
        if os.path.exists(model_path):
            try:
                ckpt = torch.load(model_path, map_location="cpu")
                # Override dimensions from checkpoint if available
                if "state_dim" in ckpt:
                    self.state_dim = ckpt["state_dim"]
                if "n_actions" in ckpt:
                    self.n_actions = ckpt["n_actions"]
                if "hidden" in ckpt and ckpt["hidden"] is not None:
                    self.hidden = ckpt["hidden"]
                    
                self.agent = QNet(self.state_dim, self.n_actions, self.hidden)
                self.agent.load_state_dict(ckpt["state"])
                print(f"[DRLService] Successfully loaded trained DQN from {model_path}")
            except Exception as e:
                print(f"[DRLService] Error loading DQN: {e}. Using initialized weights.")
        else:
            print(f"[DRLService] Warning: {model_path} not found. Using randomly initialized weights.")
            
        self.agent.eval()

    def get_action(self, metrics: dict, active_approach: str, elapsed_time: float) -> int:
        """
        Returns the DQN action: 0 (Phase 0, e.g., NS) or 1 (Phase 1, e.g., EW)
        metrics: Dictionary containing queue and wait time for NORTH, EAST, SOUTH, WEST
        """
        # Order expected by model (N, S, E, W as created in build_network())
        approaches = ["NORTH", "SOUTH", "EAST", "WEST"]
        
        feats = []
        for app in approaches:
            m = metrics.get(app, {})
            queue = float(m.get("queue", 0))
            wait = float(m.get("wait", 0.0))
            
            # Normalization logic from observe()
            # cap was 300m / 7.5 = 40.0
            cap = 40.0
            feats.append(min(1.0, queue / cap)) # halting
            feats.append(min(1.0, queue / cap)) # total veh (approximated as queue)
            feats.append(min(1.0, wait / 300.0)) # waiting time
            
        # One-hot active phase
        # active_approach usually is LANE_1_NORTH or similar
        cur = 0 if "NORTH" in active_approach or "SOUTH" in active_approach else 1
        onehot = [1.0 if i == cur else 0.0 for i in range(self.n_actions)]
        feats.extend(onehot)
        
        # Time since last change
        feats.append(min(1.0, elapsed_time / 60.0))
        
        state_tensor = torch.FloatTensor(feats).unsqueeze(0)
        
        with torch.no_grad():
            q_values = self.agent(state_tensor)
            action = int(q_values.argmax(1).item())
            
        return action

# Singleton
drl_service = DRLService()
