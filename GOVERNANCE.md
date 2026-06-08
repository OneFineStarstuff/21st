# Omni-Sentinel Cognitive Governance Framework

This repository is powered by **Omni-Sentinel**, a high-assurance governance and execution framework designed for cognitive agents and AI systems. It provides a multi-layered defense-in-depth architecture anchored in hardware trust, Bayesian risk monitoring, and post-quantum cryptographic audit trails.

## The G-Stack Architecture

1.  **Hardware Root of Trust**: TEE/TPM with PCR_MATCH enforcement. Verifies the integrity of the execution environment.
2.  **Cognitive Control Plane**: Bayesian G-SRI (Global Systemic Risk Index) scoring engine regulating model execution based on real-time telemetry.
3.  **Immutable Evidence Store**: PQC-signed (ML-DSA) WORM (Write-Once-Read-Many) audit logs stored in an immutable bucket (e.g., AWS S3 Object Lock).

## Regulatory Compliance

- **MAS FEAT Compliance**: Implemented ZK-Fairness proofs (Demographic Parity) for expert nodes.
- **HKMA Ethics Compliance**: Developed ASA Interpretability Layer using Contextual Attribution Envelopes (CAE).
- **Maturity**: Targeting Ethics Maturity score 3 by Q4 2026.

For more details, refer to the individual module documentation in `packages/agi-system`.
