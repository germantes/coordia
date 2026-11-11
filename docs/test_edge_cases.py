import math
from typing import List, Dict

class AdvancedReportTesting:
    def __init__(self):
        self.VERIFIED_THRESHOLD = 0.70
        self.REJECTION_THRESHOLD = 0.40

    def evaluate_report(
        self, 
        base_score: float, 
        negative_votes: int, 
        is_duplicate: bool
    ) -> Dict:
        score = base_score

        # 1. Handling Duplicate Reports (Consolidation boost)
        duplicate_merged = False
        if is_duplicate:
            score += 0.15
            duplicate_merged = True

        # 2. Applying Penalties for Rejections / Downvotes
        if negative_votes > 0:
            penalty = 0.25 * math.pow(negative_votes, 1.2)
            score -= penalty

        score = max(0.0, min(1.0, score))

        # 3. Boundary & Threshold Analysis
        if score >= self.VERIFIED_THRESHOLD:
            status = "VERIFIED"
        elif score >= self.REJECTION_THRESHOLD:
            status = "UNDER_REVIEW"
        else:
            status = "REJECTED"

        return {
            "final_score": round(score, 2),
            "status": status,
            "duplicate_consolidated": duplicate_merged,
            "rejections_applied": negative_votes
        }

if __name__ == "__main__":
    tester = AdvancedReportTesting()

    print("--- TEST 1: Boundary Case (Score exactly at 0.69 vs 0.70) ---")
    print("Borderline 0.69:", tester.evaluate_report(0.69, negative_votes=0, is_duplicate=False))
    print("Threshold reached 0.70:", tester.evaluate_report(0.70, negative_votes=0, is_duplicate=False))

    print("\n--- TEST 2: Rejection Impact (Report dropping below 0.40 due to downvotes) ---")
    print("Initial 0.65 with 2 rejections:", tester.evaluate_report(0.65, negative_votes=2, is_duplicate=False))

    print("\n--- TEST 3: Duplicate Consolidation (Merging incident within 150m radius) ---")
    print("Merged duplicate boost:", tester.evaluate_report(0.58, negative_votes=0, is_duplicate=True))