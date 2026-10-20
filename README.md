<div align="center">

# Traceon
### Tile Quality Inspection & Defect Tracking System

**From isolated defect images to traceable quality decisions.**

A Buildathon 2.0 project bringing tile inspection evidence, AI-assisted defect suggestions, human review, corrective actions, and reinspection into one traceable workflow.

</div>

---

## Project at a Glance

| Item | Details |
|---|---|
| **Project Name** | Traceon |
| **Domain** | Tile Quality Inspection and Defect Tracking |
| **Primary Users** | Inspectors, Supervisors, Managers |
| **Frontend** | React, JavaScript, CSS |
| **Backend** | Python, FastAPI |
| **Database** | PostgreSQL |
| **AI/ML** | PyTorch, OpenCV |
| **GenAI** | Grounded Quality Intelligence with optional Gemini API integration |
| **Event** | Buildathon 2.0 |

**Team Name:** `Team Rocket`  
**Team Members:** `Farid Shaikh, Piyush Shah, Sharvari Pujari, Shraddha Wannare`  
**Institution:** `Walchand Institute of Technology, Solapur`

---

## 1. Problem Context

Tile quality inspection is an important part of maintaining product quality and identifying surface defects. However, inspection photographs, inspection results, defect reports, and corrective-action records can be stored separately across different systems or files.

When this information is disconnected, it becomes difficult to understand the complete history of an inspection, determine whether a reported defect was reviewed, track corrective actions, and verify whether an issue was resolved after reinspection.

This creates several challenges:

- **Disconnected inspection evidence:** Images, inspection results, and repair records are difficult to connect.
- **Slow quality reviews:** Inspectors and supervisors may need to search multiple records before making decisions.
- **Limited traceability:** It can be difficult to identify who reviewed a defect and what action was taken.
- **Recurring defects:** Historical records may not be easy to analyze for repeated quality issues.
- **Manual reporting:** Preparing inspection summaries and quality reports can require repetitive work.

## 2. Problem Statement

Develop a centralized, AI-assisted tile quality inspection and defect tracking system that connects inspection images, model predictions, human review decisions, corrective actions, and reinspection records.

The system should improve traceability, support faster evidence-based reviews, help prioritize quality issues, and provide useful summaries of recorded inspection data.

The solution must maintain a clear distinction between AI-generated suggestions and decisions confirmed by authorized users.

## 3. Proposed Solution

**Traceon** is a full-stack web application designed to manage the tile quality inspection lifecycle in one place.

It combines image-based defect classification, image-quality checks, structured inspection records, human review, corrective-action tracking, reinspection, and grounded quality intelligence.

Instead of treating each inspection image as an isolated file, Traceon connects the image to its inspection, product, batch, review outcome, and subsequent actions.

### Our approach

- Centralize products, batches, inspections, images, and defect records.
- Use computer vision and machine learning to assist with image inspection.
- Allow authorized users to review AI suggestions before confirming outcomes.
- Track corrective actions and follow-up inspections.
- Prioritize cases using explainable rules.
- Generate summaries from available inspection records with supporting references where implemented.

> **Important:** Traceon is a decision-support system. An ML prediction is a suggestion, not a confirmed defect or proof that an entire tile installation or batch is defect-free.

## 4. End-to-End Workflow

```mermaid
flowchart TD
    A["Register Product and Batch"] --> B["Create Inspection"]
    B --> C["Upload Tile Images and Notes"]
    C --> D["Image Quality Checks"]
    D --> E["ML Defect Classification"]
    E --> F["Human Review"]

    F --> G{"Review Outcome"}

    G -->|Defect Confirmed| H["Create or Update Defect"]
    G -->|More Evidence Needed| I["Request Follow-up"]
    G -->|No Defect Identified| J["Record Review Decision"]

    H --> K["Assign Corrective Action"]
    K --> L["Record Completion Evidence"]
    L --> M["Reinspection"]
    I --> M

    M --> N{"Resolved?"}
    N -->|Yes| O["Close with Traceable Evidence"]
    N -->|No| H

    J --> P["Dashboard and Reports"]
    O --> P
    P --> Q["Grounded Quality Intelligence"]