/// Governance Module
/// Manages ShieldClaw governance, policy changes, and admin functions
/// Supports decentralized governance for security policies

#[allow(duplicate_alias, unused_use, lint(public_entry))]
module shieldclaw::governance {
    use std::string::String;

    /// Error codes
    const E_NOT_ADMIN: u64 = 0;
    const E_NOT_GOVERNOR: u64 = 1;
    const E_ALREADY_VOTED: u64 = 2;
    const E_PROPOSAL_EXPIRED: u64 = 3;
    const E_QUORUM_NOT_MET: u64 = 4;
    const E_INVALID_VOTE: u64 = 5;
    const E_NOT_OWNER: u64 = 6;

    /// Governance configuration
    public struct Governance has key {
        id: UID,
        admin: address,
        governors: vector<address>,
        quorum_threshold: u64,
        voting_period: u64,
        timelock: u64,
        proposal_count: u64
    }

    /// Proposal for governance changes
    public struct Proposal has key, store {
        id: UID,
        proposal_id: u64,
        proposer: address,
        title: String,
        description: String,
        proposal_type: u8,
        target_address: address,
        action_data: vector<u8>,
        created_epoch: u64,
        voting_deadline: u64,
        executable_epoch: u64,
        executed: bool,
        votes_for: u64,
        votes_against: u64,
        voters: vector<address>
    }

    /// Vote record
    public struct Vote has key, store {
        id: UID,
        proposal_id: u64,
        voter: address,
        vote: bool,
        timestamp: u64
    }

    /// Security policy
    public struct SecurityPolicy has key, store {
        id: UID,
        policy_name: String,
        policy_version: String,
        rules: vector<u8>,
        created_epoch: u64,
        updated_epoch: u64,
        active: bool,
        owner: address
    }

    /// Initialize governance
    public entry fun init_governance(
        initial_admin: address,
        initial_governors: vector<address>,
        quorum_threshold: u64,
        voting_period: u64,
        timelock: u64,
        ctx: &mut TxContext
    ) {
        let governance = Governance {
            id: object::new(ctx),
            admin: initial_admin,
            governors: initial_governors,
            quorum_threshold,
            voting_period,
            timelock,
            proposal_count: 0
        };
        transfer::transfer(governance, tx_context::sender(ctx));
    }

    /// Create a proposal
    public entry fun create_proposal(
        governance: &mut Governance,
        title: String,
        description: String,
        proposal_type: u8,
        target_address: address,
        action_data: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(vector::contains(&governance.governors, &sender) || sender == governance.admin, E_NOT_GOVERNOR);

        governance.proposal_count = governance.proposal_count + 1;
        let proposal_id = governance.proposal_count;
        let current_epoch = tx_context::epoch(ctx);

        let proposal = Proposal {
            id: object::new(ctx),
            proposal_id,
            proposer: sender,
            title,
            description,
            proposal_type,
            target_address,
            action_data,
            created_epoch: current_epoch,
            voting_deadline: current_epoch + governance.voting_period,
            executable_epoch: current_epoch + governance.voting_period + governance.timelock,
            executed: false,
            votes_for: 0,
            votes_against: 0,
            voters: vector::empty()
        };

        transfer::transfer(proposal, sender);
    }

    /// Vote on a proposal
    public entry fun vote(
        governance: &Governance,
        proposal: &mut Proposal,
        vote: bool,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(vector::contains(&governance.governors, &sender) || sender == governance.admin, E_NOT_GOVERNOR);
        assert!(!vector::contains(&proposal.voters, &sender), E_ALREADY_VOTED);

        let current_epoch = tx_context::epoch(ctx);
        assert!(current_epoch < proposal.voting_deadline, E_PROPOSAL_EXPIRED);
        assert!(!proposal.executed, E_PROPOSAL_EXPIRED);

        if (vote) {
            proposal.votes_for = proposal.votes_for + 1;
        } else {
            proposal.votes_against = proposal.votes_against + 1;
        };

        vector::push_back(&mut proposal.voters, sender);

        let vote_record = Vote {
            id: object::new(ctx),
            proposal_id: proposal.proposal_id,
            voter: sender,
            vote,
            timestamp: current_epoch
        };

        transfer::transfer(vote_record, sender);
    }

    /// Execute a proposal
    public entry fun execute_proposal(
        governance: &Governance,
        proposal: &mut Proposal,
        ctx: &mut TxContext
    ) {
        let current_epoch = tx_context::epoch(ctx);
        assert!(current_epoch >= proposal.voting_deadline, E_PROPOSAL_EXPIRED);
        assert!(current_epoch >= proposal.executable_epoch, E_PROPOSAL_EXPIRED);
        assert!(!proposal.executed, E_PROPOSAL_EXPIRED);

        let total_governors = if (tx_context::sender(ctx) == governance.admin) {
            vector::length(&governance.governors) + 1
        } else {
            vector::length(&governance.governors)
        };
        let votes_cast = vector::length(&proposal.voters);
        let quorum_required = (total_governors * governance.quorum_threshold) / 100;
        assert!(votes_cast >= quorum_required, E_QUORUM_NOT_MET);
        assert!(proposal.votes_for > proposal.votes_against, E_INVALID_VOTE);

        proposal.executed = true;
    }

    /// Add governor (admin only)
    public entry fun add_governor(
        governance: &mut Governance,
        new_governor: address,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == governance.admin, E_NOT_ADMIN);
        assert!(!vector::contains(&governance.governors, &new_governor), E_INVALID_VOTE);
        vector::push_back(&mut governance.governors, new_governor);
    }

    /// Remove governor (admin only)
    public entry fun remove_governor(
        governance: &mut Governance,
        governor: address,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == governance.admin, E_NOT_ADMIN);

        let len = vector::length(&governance.governors);
        let mut i = 0;
        while (i < len) {
            if (*vector::borrow(&governance.governors, i) == governor) {
                vector::remove(&mut governance.governors, i);
                return
            };
            i = i + 1
        };
    }

    /// Update admin (admin only)
    public entry fun update_admin(
        governance: &mut Governance,
        new_admin: address,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == governance.admin, E_NOT_ADMIN);
        governance.admin = new_admin;
    }

    /// Create security policy
    public entry fun create_policy(
        policy_name: String,
        policy_version: String,
        rules: vector<u8>,
        ctx: &mut TxContext
    ) {
        let current_epoch = tx_context::epoch(ctx);
        let sender = tx_context::sender(ctx);
        let policy = SecurityPolicy {
            id: object::new(ctx),
            policy_name,
            policy_version,
            rules,
            created_epoch: current_epoch,
            updated_epoch: current_epoch,
            active: true,
            owner: sender
        };
        transfer::transfer(policy, sender);
    }

    /// Update security policy (owner only)
    public entry fun update_policy(
        policy: &mut SecurityPolicy,
        new_rules: vector<u8>,
        new_version: String,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == policy.owner, E_NOT_OWNER);
        policy.rules = new_rules;
        policy.policy_version = new_version;
        policy.updated_epoch = tx_context::epoch(ctx);
    }

    /// Get governance status
    public fun get_status(governance: &Governance): (u64, u64, u64, u64, u64) {
        (
            governance.proposal_count,
            vector::length(&governance.governors),
            governance.quorum_threshold,
            governance.voting_period,
            governance.timelock
        )
    }

    /// Get proposal status
    public fun get_proposal_status(proposal: &Proposal): (bool, u64, u64, u64) {
        (
            !proposal.executed && proposal.votes_for > proposal.votes_against,
            proposal.votes_for,
            proposal.votes_against,
            proposal.voting_deadline
        )
    }
}
