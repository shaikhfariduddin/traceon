import torch
import torch.nn as nn
import torch.nn.functional as F

class ConvBlock(nn.Module):
    def __init__(self, in_channels, out_channels):
        super().__init__()
        self.conv = nn.Conv2d(in_channels, out_channels, kernel_size=3, padding=1, bias=False)
        self.bn = nn.BatchNorm2d(out_channels)
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x):
        return self.relu(self.bn(self.conv(x)))

class ResBlock(nn.Module):
    def __init__(self, channels):
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(channels)
        self.relu = nn.ReLU(inplace=True)
        self.conv2 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(channels)

    def forward(self, x):
        residual = x
        out = self.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        return self.relu(out + residual)

class TileDefectClassifier(nn.Module):
    """
    Lightweight, high-accuracy Deep Residual Tile Classifier (TileResNet-18 Lite)
    Trained specifically for industrial surface inspection.
    Supports binary classification ('good' vs 'defective') and 5 defect subtypes:
    ['crack', 'glue_strip', 'gray_stroke', 'oil', 'rough']
    """
    def __init__(self, num_classes=6):
        super().__init__()
        # Stem
        self.stem = nn.Sequential(
            nn.Conv2d(3, 32, kernel_size=7, stride=2, padding=3, bias=False), # 112x112
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=3, stride=2, padding=1)                  # 56x56
        )

        # Residual Stages
        self.stage1 = nn.Sequential(
            ConvBlock(32, 64),
            ResBlock(64),
            nn.MaxPool2d(2) # 28x28
        )

        self.stage2 = nn.Sequential(
            ConvBlock(64, 128),
            ResBlock(128),
            nn.MaxPool2d(2) # 14x14
        )

        self.stage3 = nn.Sequential(
            ConvBlock(128, 256),
            ResBlock(256),
            nn.AdaptiveAvgPool2d((1, 1)) # 1x1
        )

        # Classification Head
        self.dropout = nn.Dropout(0.3)
        self.classifier = nn.Linear(256, num_classes)

    def forward(self, x):
        x = self.stem(x)
        x = self.stage1(x)
        x = self.stage2(x)
        x = self.stage3(x)
        x = torch.flatten(x, 1)
        x = self.dropout(x)
        logits = self.classifier(x)
        return logits
