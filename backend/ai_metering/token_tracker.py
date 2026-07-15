import logging
import json
from .pricing_service import get_model_pricing

logger = logging.getLogger(__name__)

def extract_usage(response):
    usage = getattr(response, "usage", None)
    if not usage:
        return {
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
        }
    return {
        "input_tokens": int(getattr(usage, "prompt_tokens", 0)),
        "output_tokens": int(getattr(usage, "completion_tokens", 0)),
        "total_tokens": int(getattr(usage, "total_tokens", 0)),
    }

def calculate_dynamic_cost(model: str, input_tokens: int, output_tokens: int):
    pricing = get_model_pricing(model)
    if not pricing:
        return {
            "input_cost": 0.0,
            "output_cost": 0.0,
            "total_cost": 0.0,
        }
    input_price = pricing.get("input_cost_per_million", 0.15)
    output_price = pricing.get("output_cost_per_million", 0.60)
    input_cost = (input_tokens / 1_000_000) * input_price
    output_cost = (output_tokens / 1_000_000) * output_price
    total_cost = input_cost + output_cost
    return {
        "input_cost": round(input_cost, 8),
        "output_cost": round(output_cost, 8),
        "total_cost": round(total_cost, 8),
    }

def record_completion_usage(response, model, content_type="unknown", step_name="unknown", content_id=None):
    usage = extract_usage(response)
    cost_data = calculate_dynamic_cost(
        model=model,
        input_tokens=usage["input_tokens"],
        output_tokens=usage["output_tokens"],
    )
    token_record = {
        "content_id": content_id,
        "content_type": content_type,
        "step_name": step_name,
        "model": model,
        "input_tokens": usage["input_tokens"],
        "output_tokens": usage["output_tokens"],
        "total_tokens": usage["total_tokens"],
        "cost": cost_data,
    }
    logger.info(f"[TOKEN_TRACKER] Calculated cost: {cost_data['total_cost']} for step: {step_name}, model: {model}")
    return token_record
