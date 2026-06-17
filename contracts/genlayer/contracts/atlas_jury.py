# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from dataclasses import dataclass
import typing

from genlayer import *


@allow_storage
@dataclass
class ClaimVerdict:
    claim_key: str
    category: str
    approved: bool
    payout_amount: u256
    confidence: u32
    summary: str
    rationale: str
    evidence_uri: str
    jury_reference: str


class AtlasJury(gl.Contract):
    protocol_name: str
    claims: TreeMap[str, ClaimVerdict]
    last_claim_key: str
    last_summary: str

    def __init__(self, protocol_name: str = "Atlas"):
        self.protocol_name = protocol_name
        self.last_claim_key = ""
        self.last_summary = ""

    @gl.public.write
    def evaluate_claim(
        self,
        claim_key: str,
        category: str,
        description: str,
        evidence_uri: str,
        evidence_manifest: str,
        requested_amount: int,
    ) -> typing.Any:
        prompt = f"""
        You are AtlasJury, the decentralized AI claims court for the Atlas consumer
        protection protocol.

        This verdict must be produced inside a GenLayer intelligent contract and
        finalized through StudioNet validator consensus. Review this claim strictly
        from the evidence package supplied to this contract call. Do not invent
        external facts, do not rely on hidden rules, and do not approve a payout
        unless the submitted proof materially supports the claimed loss. When the
        evidence is incomplete or ambiguous, reject conservatively.

        Claim key: {claim_key}
        Category: {category}
        Requested amount in micro-USDC: {requested_amount}
        Description: {description}
        Evidence URI: {evidence_uri}
        Evidence manifest: {evidence_manifest}

        Return strict JSON only:
        {{
          "approved": true or false,
          "payout_amount": integer micro-USDC between 0 and requested_amount,
          "confidence": integer between 0 and 100,
          "summary": "single-sentence member-facing verdict",
          "rationale": "short explanation for auditors"
        }}
        """

        def leader_fn():
            return gl.nondet.exec_prompt(prompt, response_format="json")

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False

            verdict = leaders_res.calldata
            if not isinstance(verdict, dict):
                return False

            try:
                approved = verdict["approved"]
                payout_amount = int(verdict["payout_amount"])
                confidence = int(verdict["confidence"])
                summary = str(verdict["summary"]).strip()
                rationale = str(verdict["rationale"]).strip()
            except Exception:
                return False

            if type(approved) is not bool:
                return False
            if payout_amount < 0 or payout_amount > requested_amount:
                return False
            if confidence < 0 or confidence > 100:
                return False
            if len(summary) == 0 or len(rationale) == 0:
                return False

            return True

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        approved = bool(result["approved"])
        payout_amount = int(result["payout_amount"])
        confidence = int(result["confidence"])
        summary = str(result["summary"]).strip()
        rationale = str(result["rationale"]).strip()

        if payout_amount < 0:
            payout_amount = 0
        if payout_amount > requested_amount:
            payout_amount = requested_amount
        if not approved:
            payout_amount = 0

        jury_reference = f"studionet:{claim_key}"

        self.claims[claim_key] = ClaimVerdict(
            claim_key=claim_key,
            category=category,
            approved=approved,
            payout_amount=u256(payout_amount),
            confidence=u32(confidence),
            summary=summary,
            rationale=rationale,
            evidence_uri=evidence_uri,
            jury_reference=jury_reference,
        )
        self.last_claim_key = claim_key
        self.last_summary = summary

        return {
            "claim_key": claim_key,
            "approved": approved,
            "payout_amount": payout_amount,
            "confidence": confidence,
            "summary": summary,
            "rationale": rationale,
            "jury_reference": jury_reference,
        }

    @gl.public.view
    def get_claim(self, claim_key: str) -> typing.Any:
        verdict = self.claims.get(
            claim_key,
            ClaimVerdict(
                claim_key=claim_key,
                category="",
                approved=False,
                payout_amount=u256(0),
                confidence=u32(0),
                summary="Claim not found",
                rationale="No StudioNet verdict has been stored for this claim key yet.",
                evidence_uri="",
                jury_reference=f"studionet:{claim_key}",
            ),
        )

        return {
            "claim_key": verdict.claim_key,
            "category": verdict.category,
            "approved": verdict.approved,
            "payout_amount": int(verdict.payout_amount),
            "confidence": int(verdict.confidence),
            "summary": verdict.summary,
            "rationale": verdict.rationale,
            "evidence_uri": verdict.evidence_uri,
            "jury_reference": verdict.jury_reference,
        }

    @gl.public.view
    def get_last_summary(self) -> str:
        return self.last_summary

    @gl.public.view
    def get_protocol_name(self) -> str:
        return self.protocol_name
