/// Verification & Attestation Module
/// Provides cryptographic verification and attestation for skills and events
/// Links to Walrus blob IDs for large data storage

module shieldclaw::verification {
    use sui::object::{Self, UID};
    use sui::tx_context::TxContext;
    use sui::transfer;
    use std::string::String;
    use std::vector;
    use std::hash;

    /// Error codes
    const E_INVALID_SIGNATURE: u64 = 0;
    const E_EXPIRED_ATTESTATION: u64 = 1;
    const E_ALREADY_VERIFIED: u64 = 2;

    /// Skill attestation record
    struct SkillAttestation has key, store {
        id: UID,
        skill_name: String,
        skill_version: String,
        skill_hash: vector<u8>,        // SHA-256 hash of skill code
        signature: vector<u8>,         // Digital signature
        signer_address: address,        // Address of entity that signed
        verified: bool,
        verification_timestamp: u64,
        expiry_epoch: u64,
        walrus_blob_id: String,        // Walrus blob with full skill data
        metadata: vector<u8>
    }

    /// Execution attestation
    struct ExecutionAttestation has key, store {
        id: UID,
        execution_id: vector<u8>,
        skill_name: String,
        executor_address: address,
        input_hash: vector<u8>,
        output_hash: vector<u8>,
        success: bool,
        resource_usage: vector<u8>,    // Encoded usage stats
        timestamp: u64,
        walrus_blob_id: String         // Walrus blob with full execution details
    }

    /// Verification certificate
    struct VerificationCertificate has key, store {
        id: UID,
        certificate_id: String,
        entity_type: u8,               // 1: Skill, 2: Agent, 3: System
        entity_id: String,
        verification_level: u8,        // 1-5 verification levels
        verified_by: address,
        verification_timestamp: u64,
        expiry_epoch: u64,
        status: u8,                     // 1: Valid, 2: Revoked, 3: Expired
        evidence: vector<u8>
    }

    /// Certificate registry
    struct CertificateRegistry has key {
        id: UID,
        owner: address,
        certificates: vector<String>   // List of certificate IDs
    }

    /// Attestation chain (for multi-step verification)
    struct AttestationChain has key, store {
        id: UID,
        chain_id: String,
        attestations: vector<vector<u8>>,  // List of attestation IDs
        root_attestation: vector<u8>,
        created_epoch: u64,
        last_updated: u64
    }

    /// Create skill attestation
    public entry fun create_skill_attestation(
        skill_name: String,
        skill_version: String,
        skill_hash: vector<u8>,
        signature: vector<u8>,
        signer_address: address,
        expiry_epoch: u64,
        walrus_blob_id: String,
        metadata: vector<u8>,
        ctx: &mut TxContext
    ) {
        let attestation = SkillAttestation {
            id: object::new(ctx),
            skill_name,
            skill_version,
            skill_hash,
            signature,
            signer_address,
            verified: false,  // Needs verification by verifier
            verification_timestamp: 0,
            expiry_epoch,
            walrus_blob_id,
            metadata
        };
        transfer::transfer(attestation, tx_context::sender(ctx));
    }

    /// Verify skill attestation
    public entry fun verify_skill_attestation(
        attestation: &mut SkillAttestation,
        ctx: &mut TxContext
    ) {
        assert!(!attestation.verified, E_ALREADY_VERIFIED);
        
        let current_epoch = tx_context::epoch(ctx);
        assert!(current_epoch < attestation.expiry_epoch, E_EXPIRED_ATTESTATION);
        
        // In a real implementation, this would verify the signature
        // against the signer_address and skill_hash
        // For now, we mark it as verified
        
        attestation.verified = true;
        attestation.verification_timestamp = current_epoch;
    }

    /// Create execution attestation
    public entry fun create_execution_attestation(
        execution_id: vector<u8>,
        skill_name: String,
        executor_address: address,
        input_hash: vector<u8>,
        output_hash: vector<u8>,
        success: bool,
        resource_usage: vector<u8>,
        walrus_blob_id: String,
        ctx: &mut TxContext
    ) {
        let attestation = ExecutionAttestation {
            id: object::new(ctx),
            execution_id,
            skill_name,
            executor_address,
            input_hash,
            output_hash,
            success,
            resource_usage,
            timestamp: tx_context::epoch(ctx),
            walrus_blob_id
        };
        transfer::transfer(attestation, executor_address);
    }

    /// Create verification certificate
    public entry fun create_certificate(
        registry: &mut CertificateRegistry,
        certificate_id: String,
        entity_type: u8,
        entity_id: String,
        verification_level: u8,
        expiry_epoch: u64,
        evidence: vector<u8>,
        ctx: &mut TxContext
    ) {
        assert!(verification_level >= 1 && verification_level <= 5, E_INVALID_SIGNATURE);
        
        let certificate = VerificationCertificate {
            id: object::new(ctx),
            certificate_id,
            entity_type,
            entity_id,
            verification_level,
            verified_by: tx_context::sender(ctx),
            verification_timestamp: tx_context::epoch(ctx),
            expiry_epoch,
            status: 1,  // Valid
            evidence
        };
        
        vector::push_back(&mut registry.certificates, certificate_id);
        transfer::transfer(certificate, tx_context::sender(ctx));
    }

    /// Revoke certificate
    public entry fun revoke_certificate(
        registry: &mut CertificateRegistry,
        certificate: &mut VerificationCertificate,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == certificate.verified_by, E_INVALID_SIGNATURE);
        
        certificate.status = 2;  // Revoked
    }

    /// Create certificate registry
    public entry fun create_registry(ctx: &mut TxContext) {
        let registry = CertificateRegistry {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            certificates: vector::empty()
        };
        transfer::transfer(registry, tx_context::sender(ctx));
    }

    /// Create attestation chain
    public entry fun create_attestation_chain(
        chain_id: String,
        root_attestation: vector<u8>,
        ctx: &mut TxContext
    ) {
        let current_epoch = tx_context::epoch(ctx);
        let chain = AttestationChain {
            id: object::new(ctx),
            chain_id,
            attestations: vector::empty(),
            root_attestation,
            created_epoch: current_epoch,
            last_updated: current_epoch
        };
        transfer::transfer(chain, tx_context::sender(ctx));
    }

    /// Add attestation to chain
    public entry fun add_to_chain(
        chain: &mut AttestationChain,
        attestation_id: vector<u8>,
        ctx: &mut TxContext
    ) {
        vector::push_back(&mut chain.attestations, attestation_id);
        chain.last_updated = tx_context::epoch(ctx);
    }

    /// Verify hash
    public fun verify_hash(
        data: vector<u8>,
        expected_hash: vector<u8>
    ): bool {
        let computed_hash = hash::sha2_256(data);
        vector::equals(&computed_hash, &expected_hash)
    }

    /// Check if attestation is valid
    public fun is_attestation_valid(
        attestation: &SkillAttestation
    ): bool {
        let current_epoch = attestation.verification_timestamp;  // Use verification timestamp
        current_epoch < attestation.expiry_epoch && attestation.verified
    }

    /// Check if certificate is valid
    public fun is_certificate_valid(
        certificate: &VerificationCertificate
    ): bool {
        certificate.status == 1
    }

    /// Get skill attestation info
    public fun get_attestation_info(
        attestation: &SkillAttestation
    ): (bool, u64, u64, String) {
        (
            attestation.verified,
            attestation.verification_timestamp,
            attestation.expiry_epoch,
            attestation.walrus_blob_id
        )
    }

    /// Get certificate info
    public fun get_certificate_info(
        certificate: &VerificationCertificate
    ): (u8, u8, u64, bool) {
        (
            certificate.entity_type,
            certificate.verification_level,
            certificate.expiry_epoch,
            certificate.status == 1
        )
    }
}
