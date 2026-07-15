import json
import os

PRICING_FILE = os.path.join(
    os.path.dirname(__file__),
    "pricing.json"
)

def load_pricing_cache():
    if not os.path.exists(PRICING_FILE):
        return {}
    with open(
        PRICING_FILE,
        "r",
        encoding="utf-8"
    ) as f:
        return json.load(f)

def get_model_pricing(model: str):
    pricing = load_pricing_cache()
    # Support direct matching or match default fallback
    return pricing.get(model) or pricing.get("default")
