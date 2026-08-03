from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from transformers import BertTokenizer, BertForSequenceClassification
import torch
import torch.nn.functional as F

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Correct absolute path
MODEL_PATH = r"C:\Users\user\Desktop\Phishing_email\model\final_model"

model     = BertForSequenceClassification.from_pretrained(MODEL_PATH)
tokenizer = BertTokenizer.from_pretrained(MODEL_PATH)
model.eval()

def get_category(predicted_class, confidence):
    if predicted_class == 0:
        if confidence >= 0.90:
            return "Legitimate", "green", "safe"
        else:
            return "Suspicious", "orange", "warning"
    elif predicted_class == 1:
        return "Human Phishing", "red", "danger"
    elif predicted_class == 2:
        return "AI Phishing", "red", "danger"

@app.post("/predict")
async def predict(data: dict):
    email_text = data.get("text", "").strip()

    if not email_text:
        return {"error": "No text provided"}

    inputs = tokenizer(
        email_text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=512
    )

    with torch.no_grad():
        outputs = model(**inputs)

    probs           = F.softmax(outputs.logits, dim=1)[0]
    predicted_class = torch.argmax(probs).item()
    confidence      = probs[predicted_class].item()

    category, color, status = get_category(predicted_class, confidence)

    return {
        "category"   : category,
        "confidence" : round(confidence * 100, 2),
        "color"      : color,
        "status"     : status,
        "is_safe"    : predicted_class == 0 and confidence >= 0.90,
        "scores"     : {
            "legitimate"     : round(probs[0].item() * 100, 2),
            "human_phishing" : round(probs[1].item() * 100, 2),
            "ai_phishing"    : round(probs[2].item() * 100, 2),
        }
    }

@app.get("/health")
async def health():
    return {"status": "running"}