"""Visual anomaly detection for tiles (PatchCore-style, simplified).

Idea: a pretrained CNN turns every small patch of an image into a feature vector. We store the patches of
NORMAL tiles only (memory bank). A new image is scored by how far its patches are from the closest normal
patch. A far-away patch = unusual appearance. No defect images are used for training.

The score is a distance, NOT a probability. The decision threshold is calibrated on held-out normal images.
"""
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
import torchvision
from PIL import Image

from .viz import render_heatmap

IMG_SIZE = 224
MEAN = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
STD = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)


def load_rgb(path) -> Image.Image:
    return Image.open(path).convert("RGB")


def to_tensor(img: Image.Image) -> torch.Tensor:
    arr = np.asarray(img.resize((IMG_SIZE, IMG_SIZE), Image.BILINEAR), dtype=np.float32) / 255.0
    return (torch.from_numpy(arr).permute(2, 0, 1) - MEAN) / STD


class FeatureExtractor(torch.nn.Module):
    """ImageNet-pretrained ResNet; mid-level layers 2+3 capture texture/local structure."""

    def __init__(self, backbone: str = "resnet18", pretrained: bool = True):
        super().__init__()
        self.backbone_name = backbone
        net = getattr(torchvision.models, backbone)(weights="DEFAULT" if pretrained else None)
        self.net = net.eval()
        for p in self.net.parameters():
            p.requires_grad_(False)

    @torch.no_grad()
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        n = self.net
        x = n.maxpool(n.relu(n.bn1(n.conv1(x))))
        x = n.layer1(x)
        f2 = n.layer2(x)
        f3 = n.layer3(f2)
        f2 = F.avg_pool2d(f2, 3, 1, 1)                        # local neighbourhood aggregation
        f3 = F.avg_pool2d(f3, 3, 1, 1)
        f3 = F.interpolate(f3, size=f2.shape[-2:], mode="bilinear", align_corners=False)
        return torch.cat([f2, f3], dim=1)                     # B, C, H, W


class TileAnomalyModel:
    def __init__(self, extractor, bank, threshold=None, band=0.10, meta=None):
        self.extractor = extractor
        self.bank = bank                                       # (N, C) normal patch features
        self.threshold = threshold
        self.band = band                                       # +/- fraction around threshold = "uncertain"
        self.meta = meta or {}

    # ---- scoring -------------------------------------------------------------------------------
    @torch.no_grad()
    def anomaly_map(self, img: Image.Image) -> np.ndarray:
        feats = self.extractor(to_tensor(img).unsqueeze(0))   # 1, C, H, W
        _, c, h, w = feats.shape
        q = feats.permute(0, 2, 3, 1).reshape(-1, c)
        out = [torch.cdist(chunk, self.bank).min(dim=1).values for chunk in q.split(512)]
        return torch.cat(out).reshape(h, w).cpu().numpy()

    def score_image(self, img: Image.Image) -> float:
        return float(self.anomaly_map(img).max())

    def score_file(self, path) -> float:
        return self.score_image(load_rgb(path))

    def label_for(self, score: float) -> str:
        if self.threshold is None:
            raise RuntimeError("Model has no calibrated threshold")
        if score > self.threshold * (1 + self.band):
            return "defective"
        if score < self.threshold * (1 - self.band):
            return "good"
        return "uncertain"

    def predict_file(self, path, heatmap_path=None) -> dict:
        t0 = time.perf_counter()
        img = load_rgb(path)
        amap = self.anomaly_map(img)
        score = float(amap.max())
        if heatmap_path is not None:
            render_heatmap(img, amap, self.threshold).save(heatmap_path, format="PNG")
        return {
            "score": score, "threshold": float(self.threshold), "label": self.label_for(score),
            "model_name": self.meta.get("name", "tile-patchcore-lite"),
            "model_version": self.meta.get("version", "unknown"),
            "processing_ms": int((time.perf_counter() - t0) * 1000),
        }

    # ---- persistence ---------------------------------------------------------------------------
    def save(self, path) -> None:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        torch.save({
            "backbone": self.extractor.backbone_name,
            "state_dict": self.extractor.net.state_dict(),
            "bank": self.bank, "threshold": self.threshold, "band": self.band, "meta": self.meta,
        }, path)

    @classmethod
    def load(cls, path):
        blob = torch.load(path, map_location="cpu", weights_only=False)
        ext = FeatureExtractor(blob["backbone"], pretrained=False)   # weights come from the artifact: no download
        ext.net.load_state_dict(blob["state_dict"])
        ext.net.eval()
        return cls(ext, blob["bank"], blob["threshold"], blob["band"], blob["meta"])


@torch.no_grad()
def build_memory_bank(extractor, files, max_patches=60000, batch_size=16, seed=0) -> torch.Tensor:
    chunks = []
    for i in range(0, len(files), batch_size):
        batch = torch.stack([to_tensor(load_rgb(f)) for f in files[i:i + batch_size]])
        feats = extractor(batch)
        chunks.append(feats.permute(0, 2, 3, 1).reshape(-1, feats.shape[1]))
    bank = torch.cat(chunks)
    if bank.shape[0] > max_patches:                           # simple random subsampling (documented limitation)
        g = torch.Generator().manual_seed(seed)
        bank = bank[torch.randperm(bank.shape[0], generator=g)[:max_patches]]
    return bank.contiguous()
