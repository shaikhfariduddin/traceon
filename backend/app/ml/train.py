import os
import sys
import json
import time
import random
import numpy as np
from PIL import Image

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.ml.model import TileDefectClassifier

class TileDataset(Dataset):
    def __init__(self, items, is_train=False, img_size=(224, 224)):
        self.items = items
        self.is_train = is_train
        self.img_size = img_size
        self.mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        self.std = np.array([0.229, 0.224, 0.225], dtype=np.float32)

    def __len__(self):
        return len(self.items)

    def __getitem__(self, idx):
        item = self.items[idx]
        img_path = item["path"]
        label = item["label"]

        with Image.open(img_path) as img:
            img = img.convert("RGB")
            img = img.resize(self.img_size, Image.BILINEAR)

            if self.is_train:
                if random.random() > 0.5:
                    img = img.transpose(Image.FLIP_LEFT_RIGHT)
                if random.random() > 0.5:
                    img = img.transpose(Image.FLIP_TOP_BOTTOM)
                if random.random() > 0.5:
                    rot = random.choice([Image.ROTATE_90, Image.ROTATE_180, Image.ROTATE_270])
                    img = img.transpose(rot)

            img_np = np.array(img, dtype=np.float32) / 255.0
            # Normalize
            img_np = (img_np - self.mean) / self.std
            # HWC to CHW
            img_tensor = torch.from_numpy(img_np.transpose((2, 0, 1)))

        return img_tensor, torch.tensor(label, dtype=torch.long)

def train_model(
    manifest_path: str = r"c:\Users\PIYUSH\Desktop\Defect Tracking\model_artifacts\dataset_manifest.json",
    save_path: str = r"c:\Users\PIYUSH\Desktop\Defect Tracking\model_artifacts\tile_defect_classifier.pt",
    metadata_path: str = r"c:\Users\PIYUSH\Desktop\Defect Tracking\model_artifacts\training_metadata.json",
    epochs: int = 12,
    batch_size: int = 16,
    lr: float = 0.001
):
    print("Loading dataset manifest...")
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    train_items = manifest["splits"]["train"]
    val_items = manifest["splits"]["val"]

    train_dataset = TileDataset(train_items, is_train=True)
    val_dataset = TileDataset(val_items, is_train=False)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Training on device: {device}")

    # Compute class weights for imbalanced classes
    class_counts = [0] * len(manifest["classes"])
    for item in train_items:
        class_counts[item["label"]] += 1
    total_train = len(train_items)
    weights = [total_train / (len(class_counts) * max(c, 1)) for c in class_counts]
    class_weights = torch.tensor(weights, dtype=torch.float32).to(device)

    model = TileDefectClassifier(num_classes=len(manifest["classes"])).to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-3)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    best_val_acc = 0.0
    best_loss = float("inf")
    history = []

    start_time = time.time()
    for epoch in range(1, epochs + 1):
        # Training Phase
        model.train()
        running_loss = 0.0
        correct_train = 0
        total_train_samples = 0

        for inputs, labels in train_loader:
            inputs, labels = inputs.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item() * inputs.size(0)
            preds = torch.argmax(outputs, dim=1)
            correct_train += (preds == labels).sum().item()
            total_train_samples += inputs.size(0)

        scheduler.step()
        train_loss = running_loss / total_train_samples
        train_acc = correct_train / total_train_samples

        # Validation Phase
        model.eval()
        val_loss = 0.0
        correct_val = 0
        total_val_samples = 0

        with torch.no_grad():
            for inputs, labels in val_loader:
                inputs, labels = inputs.to(device), labels.to(device)
                outputs = model(inputs)
                loss = criterion(outputs, labels)

                val_loss += loss.item() * inputs.size(0)
                preds = torch.argmax(outputs, dim=1)
                correct_val += (preds == labels).sum().item()
                total_val_samples += inputs.size(0)

        val_loss = val_loss / total_val_samples
        val_acc = correct_val / total_val_samples

        print(f"Epoch {epoch:02d}/{epochs:02d} | Train Loss: {train_loss:.4f} Acc: {train_acc:.3f} | Val Loss: {val_loss:.4f} Acc: {val_acc:.3f}")

        history.append({
            "epoch": epoch,
            "train_loss": round(train_loss, 4),
            "train_acc": round(train_acc, 4),
            "val_loss": round(val_loss, 4),
            "val_acc": round(val_acc, 4)
        })

        if val_acc >= best_val_acc:
            best_val_acc = val_acc
            best_loss = val_loss
            torch.save({
                "model_state_dict": model.state_dict(),
                "classes": manifest["classes"],
                "class_to_idx": manifest["class_to_idx"],
                "architecture": "TileDefectClassifier_ResNetLite",
                "val_acc": val_acc,
                "val_loss": val_loss,
                "epoch": epoch
            }, save_path)

    training_time_sec = round(time.time() - start_time, 2)
    print(f"Training completed in {training_time_sec}s. Best Val Acc: {best_val_acc:.4f}")

    metadata = {
        "model_name": "TileDefectClassifier",
        "version": "v1.0.0",
        "architecture": "TileDefectClassifier_ResNetLite",
        "num_classes": len(manifest["classes"]),
        "classes": manifest["classes"],
        "class_to_idx": manifest["class_to_idx"],
        "input_resolution": [224, 224],
        "epochs": epochs,
        "batch_size": batch_size,
        "learning_rate": lr,
        "optimizer": "AdamW",
        "training_time_seconds": training_time_sec,
        "best_val_accuracy": best_val_acc,
        "best_val_loss": best_loss,
        "history": history
    }

    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"Saved metadata to {metadata_path}")

if __name__ == "__main__":
    train_model(epochs=12)
