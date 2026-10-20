import os
import json
import random
from typing import Dict, List

CLASSES = ["good", "crack", "glue_strip", "gray_stroke", "oil", "rough"]
CLASS_TO_IDX = {c: i for i, c in enumerate(CLASSES)}
IDX_TO_CLASS = {i: c for i, c in enumerate(CLASSES)}

def build_dataset_manifest(
    dataset_dir: str = r"c:\Users\PIYUSH\Downloads\tile\tile",
    output_path: str = r"c:\Users\PIYUSH\Desktop\Defect Tracking\model_artifacts\dataset_manifest.json",
    seed: int = 42
) -> Dict:
    random.seed(seed)
    manifest = {
        "dataset_name": "MVTec AD Tile Dataset",
        "random_seed": seed,
        "classes": CLASSES,
        "class_to_idx": CLASS_TO_IDX,
        "splits": {
            "train": [],
            "val": [],
            "test": []
        },
        "stats": {}
    }

    # 1. Gather all good images
    # train/good: 230, test/good: 33 -> Total 263 good images
    good_files = []
    train_good_dir = os.path.join(dataset_dir, "train", "good")
    if os.path.exists(train_good_dir):
        for f in os.listdir(train_good_dir):
            if f.lower().endswith(('.png', '.jpg', '.jpeg')):
                good_files.append((os.path.join(train_good_dir, f), "good", 0))

    test_good_dir = os.path.join(dataset_dir, "test", "good")
    if os.path.exists(test_good_dir):
        for f in os.listdir(test_good_dir):
            if f.lower().endswith(('.png', '.jpg', '.jpeg')):
                good_files.append((os.path.join(test_good_dir, f), "good", 0))

    random.shuffle(good_files)
    # Split good: 70% train (184), 15% val (39), 15% test (40)
    n_good = len(good_files)
    n_good_train = int(n_good * 0.70)
    n_good_val = int(n_good * 0.15)

    train_goods = good_files[:n_good_train]
    val_goods = good_files[n_good_train:n_good_train + n_good_val]
    test_goods = good_files[n_good_train + n_good_val:]

    manifest["splits"]["train"].extend([{"path": p, "class": c, "label": l} for p, c, l in train_goods])
    manifest["splits"]["val"].extend([{"path": p, "class": c, "label": l} for p, c, l in val_goods])
    manifest["splits"]["test"].extend([{"path": p, "class": c, "label": l} for p, c, l in test_goods])

    # 2. Defect classes (from test folder)
    defect_classes = ["crack", "glue_strip", "gray_stroke", "oil", "rough"]
    for d_cls in defect_classes:
        d_dir = os.path.join(dataset_dir, "test", d_cls)
        if not os.path.exists(d_dir):
            continue
        d_files = []
        for f in os.listdir(d_dir):
            if f.lower().endswith(('.png', '.jpg', '.jpeg')):
                d_files.append((os.path.join(d_dir, f), d_cls, CLASS_TO_IDX[d_cls]))
        random.shuffle(d_files)
        # Split defect samples: ~60% train, ~20% val, ~20% test
        n_d = len(d_files)
        n_d_train = max(int(n_d * 0.6), 1)
        n_d_val = max(int(n_d * 0.2), 1)

        d_train = d_files[:n_d_train]
        d_val = d_files[n_d_train:n_d_train + n_d_val]
        d_test = d_files[n_d_train + n_d_val:]

        manifest["splits"]["train"].extend([{"path": p, "class": c, "label": l} for p, c, l in d_train])
        manifest["splits"]["val"].extend([{"path": p, "class": c, "label": l} for p, c, l in d_val])
        manifest["splits"]["test"].extend([{"path": p, "class": c, "label": l} for p, c, l in d_test])

    # Compute summary stats
    for split_name in ["train", "val", "test"]:
        split_items = manifest["splits"][split_name]
        class_counts = {}
        for item in split_items:
            cls = item["class"]
            class_counts[cls] = class_counts.get(cls, 0) + 1
        manifest["stats"][split_name] = {
            "total_samples": len(split_items),
            "class_distribution": class_counts
        }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"Manifest written to {output_path}")
    print(f"Train samples: {len(manifest['splits']['train'])}")
    print(f"Val samples:   {len(manifest['splits']['val'])}")
    print(f"Test samples:  {len(manifest['splits']['test'])}")
    return manifest

if __name__ == "__main__":
    build_dataset_manifest()
