def track_chatbot_cost(draft_id: str, response, model: str, step_name: str):
    if not draft_id:
        return
    try:
        from ai_metering.token_tracker import record_completion_usage
        from database import add_chatbot_draft_cost
        
        # Calculate cost
        record = record_completion_usage(
            response=response,
            model=model,
            content_type="text",
            step_name=step_name,
            content_id=draft_id
        )
        cost = record.get("cost", {}).get("total_cost", 0.0)
        if cost > 0:
            add_chatbot_draft_cost(draft_id, cost)
            print(f"[METERING] Added cost ${cost} for draft {draft_id} ({step_name}) using model {model}")
    except Exception as e:
        print(f"[METERING ERROR] Failed to track cost: {e}")
