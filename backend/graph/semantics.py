from typing import List, Dict, Any, Set

def calculate_h_categorizer(nodes: List[Any], category_weights: Dict[str, float], max_iterations: int = 100, epsilon: float = 1e-6) -> Dict[str, float]:
    active_ids = {n.id for n in nodes if n.cat == 'state' or not n.inactive}
    node_cats = {n.id: n.cat for n in nodes if n.id in active_ids}

    # Pre-build link structure
    attacked_by = {id: [] for id in active_ids}
    supported_by = {id: [] for id in active_ids}
    
    for n in nodes:
        if n.id not in active_ids: continue
        for tid in n.attacks:
            if tid in active_ids: attacked_by[tid].append(n.id)
        for tid in n.supports:
            if tid in active_ids: supported_by[tid].append(n.id)

    # Initial guess
    current_scores = {n.id: (n.value if n.cat == 'state' else 1.0) for n in nodes if n.id in active_ids}

    for iter in range(max_iterations):
        next_scores = {}
        max_diff = 0.0

        for n in nodes:
            if n.id not in active_ids:
                next_scores[n.id] = 0.0
                continue

            attack_sum = 0.0
            support_sum = 0.0
            state_support_sum = 0.0
            state_support_count = 0

            for src_id in attacked_by.get(n.id, []):
                weight = category_weights.get(node_cats[src_id], 1.0)
                attack_sum += weight * current_scores.get(src_id, 0.0)

            for src_id in supported_by.get(n.id, []):
                weight = category_weights.get(node_cats[src_id], 1.0)
                val = weight * current_scores.get(src_id, 0.0)
                if node_cats[src_id] == 'state':
                    state_support_sum += val
                    state_support_count += 1
                else:
                    support_sum += val

            if n.cat == 'state':
                base_value = n.value or 0.0
                next_scores[n.id] = (base_value + support_sum) / (1 + attack_sum + support_sum)
            else:
                base_value = (state_support_sum / state_support_count) if state_support_count > 0 else 1.0
                next_scores[n.id] = (base_value + support_sum) / (1 + attack_sum + support_sum)

            diff = abs(next_scores[n.id] - current_scores.get(n.id, 0.0))
            if diff > max_diff: max_diff = diff

        current_scores = next_scores
        if max_diff < epsilon: break

    return current_scores

def calculate_max_based(nodes: List[Any], category_weights: Dict[str, float], max_iterations: int = 100, epsilon: float = 1e-6) -> Dict[str, float]:
    active_ids = {n.id for n in nodes if n.cat == 'state' or not n.inactive}
    node_cats = {n.id: n.cat for n in nodes if n.id in active_ids}

    attacked_by = {id: [] for id in active_ids}
    supported_by = {id: [] for id in active_ids}
    
    for n in nodes:
        if n.id not in active_ids: continue
        for tid in n.attacks:
            if tid in active_ids: attacked_by[tid].append(n.id)
        for tid in n.supports:
            if tid in active_ids: supported_by[tid].append(n.id)

    current_scores = {n.id: (n.value if n.cat == 'state' else 1.0) for n in nodes if n.id in active_ids}

    for iter in range(max_iterations):
        next_scores = {}
        max_diff = 0.0

        for n in nodes:
            if n.id not in active_ids:
                next_scores[n.id] = 0.0
                continue

            max_attack = 0.0
            max_support = 0.0
            state_support_sum = 0.0
            state_support_count = 0

            for src_id in attacked_by.get(n.id, []):
                weight = category_weights.get(node_cats[src_id], 1.0)
                val = weight * current_scores.get(src_id, 0.0)
                if val > max_attack: max_attack = val

            for src_id in supported_by.get(n.id, []):
                weight = category_weights.get(node_cats[src_id], 1.0)
                val = weight * current_scores.get(src_id, 0.0)
                if node_cats[src_id] == 'state':
                    state_support_sum += val
                    state_support_count += 1
                else:
                    if val > max_support: max_support = val

            if n.cat == 'state':
                base_value = n.value or 0.0
                next_scores[n.id] = (base_value + max_support) / (1 + max_attack + max_support)
            else:
                base_value = (state_support_sum / state_support_count) if state_support_count > 0 else 1.0
                next_scores[n.id] = (base_value + max_support) / (1 + max_attack + max_support)

            diff = abs(next_scores[n.id] - current_scores.get(n.id, 0.0))
            if diff > max_diff: max_diff = diff

        current_scores = next_scores
        if max_diff < epsilon: break

    return current_scores
