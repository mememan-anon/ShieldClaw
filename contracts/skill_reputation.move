/// Skill Reputation Registry
/// Manages reputation scores for AI skills on ShieldClaw
/// Allows tracking skill performance, security incidents, and community trust

module shieldclaw::skill_reputation {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use std::string::{Self, String};
    use std::vector;

    /// Error codes
    const E_NOT_ADMIN: u64 = 0;
    const E_SKILL_NOT_FOUND: u64 = 1;
    const E_INVALID_REPUTATION: u64 = 2;
    const E_INVALID_INCIDENT: u64 = 3;

    /// Skill reputation record
    struct SkillReputation has key, store {
        id: UID,
        skill_name: String,
        score: u64,              // 0-100 reputation score
        total_executions: u64,
        successful_executions: u64,
        failed_executions: u64,
        security_incidents: u64,
        last_updated: u64,
        admin: address
    }

    /// Reputation registry (singleton)
    struct ReputationRegistry has key {
        id: UID,
        admin: address,
        skills: vector<String>  // List of registered skill names
    }

    /// Security incident record
    struct SecurityIncident has key, store {
        id: UID,
        skill_name: String,
        incident_type: String,
        severity: u8,           // 1-5 severity level
        description: String,
        timestamp: u64,
        reporter: address,
        evidence: vector<u8>    // Encrypted evidence (hash of Walrus blob)
    }

    /// Initialize the reputation registry
    public entry fun init_registry(ctx: &mut TxContext) {
        let registry = ReputationRegistry {
            id: object::new(ctx),
            admin: tx_context::sender(ctx),
            skills: vector::empty()
        };
        transfer::transfer(registry, tx_context::sender(ctx));
    }

    /// Register a new skill
    public entry fun register_skill(
        registry: &mut ReputationRegistry,
        skill_name: String,
        initial_score: u64,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == registry.admin, E_NOT_ADMIN);
        assert!(initial_score <= 100, E_INVALID_REPUTATION);

        // Check if skill already exists
        assert!(!vector::contains(&registry.skills, &skill_name), E_SKILL_NOT_FOUND);

        // Create reputation record
        let reputation = SkillReputation {
            id: object::new(ctx),
            skill_name: skill_name,
            score: initial_score,
            total_executions: 0,
            successful_executions: 0,
            failed_executions: 0,
            security_incidents: 0,
            last_updated: tx_context::epoch(ctx),
            admin: tx_context::sender(ctx)
        };

        // Add to registry
        vector::push_back(&mut registry.skills, skill_name);

        // Transfer to admin
        transfer::transfer(reputation, tx_context::sender(ctx));
    }

    /// Record a successful execution
    public entry fun record_success(
        reputation: &mut SkillReputation,
        ctx: &mut TxContext
    ) {
        reputation.total_executions = reputation.total_executions + 1;
        reputation.successful_executions = reputation.successful_executions + 1;
        reputation.last_updated = tx_context::epoch(ctx);

        // Slightly increase reputation score
        if (reputation.score < 100) {
            reputation.score = reputation.score + 1;
        }
    }

    /// Record a failed execution
    public entry fun record_failure(
        reputation: &mut SkillReputation,
        ctx: &mut TxContext
    ) {
        reputation.total_executions = reputation.total_executions + 1;
        reputation.failed_executions = reputation.failed_executions + 1;
        reputation.last_updated = tx_context::epoch(ctx);

        // Decrease reputation score (more penalty for failures)
        if (reputation.score > 0) {
            reputation.score = reputation.score - 2;
        }
    }

    /// Record a security incident
    public entry fun record_incident(
        reputation: &mut SkillReputation,
        incident_type: String,
        severity: u8,
        description: String,
        evidence: vector<u8>,
        ctx: &mut TxContext
    ) {
        assert!(severity >= 1 && severity <= 5, E_INVALID_INCIDENT);

        reputation.security_incidents = reputation.security_incidents + 1;
        reputation.last_updated = tx_context::epoch(ctx);

        // Penalize based on severity
        let penalty = (severity as u64) * 10; // 10-50 points
        if (reputation.score >= penalty) {
            reputation.score = reputation.score - penalty;
        } else {
            reputation.score = 0;
        }

        // Create incident record
        let incident = SecurityIncident {
            id: object::new(ctx),
            skill_name: reputation.skill_name,
            incident_type,
            severity,
            description,
            timestamp: tx_context::epoch(ctx),
            reporter: tx_context::sender(ctx),
            evidence
        };

        // Transfer to reporter
        transfer::transfer(incident, tx_context::sender(ctx));
    }

    /// Update reputation score (admin only)
    public entry fun update_score(
        reputation: &mut SkillReputation,
        new_score: u64,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == reputation.admin, E_NOT_ADMIN);
        assert!(new_score <= 100, E_INVALID_REPUTATION);

        reputation.score = new_score;
        reputation.last_updated = tx_context::epoch(ctx);
    }

    /// Get reputation score
    public fun get_score(reputation: &SkillReputation): u64 {
        reputation.score
    }

    /// Get execution statistics
    public fun get_stats(reputation: &SkillReputation): (u64, u64, u64, u64) {
        (
            reputation.total_executions,
            reputation.successful_executions,
            reputation.failed_executions,
            reputation.security_incidents
        )
    }

    /// Check if skill is trusted (score >= 70)
    public fun is_trusted(reputation: &SkillReputation): bool {
        reputation.score >= 70
    }

    /// Check if skill is safe to execute (score >= 50)
    public fun is_safe(reputation: &SkillReputation): bool {
        reputation.score >= 50
    }
}
