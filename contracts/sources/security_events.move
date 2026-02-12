/// Security Event Log
/// Immutable logging of security events to Sui blockchain
/// Provides tamper-proof audit trail for security incidents

#[allow(duplicate_alias, unused_use, unused_const, lint(public_entry))]
module shieldclaw::security_events {
    use std::string::String;

    /// Event types
    const TYPE_MONITORING: u8 = 1;
    const TYPE_VERIFICATION: u8 = 2;
    const TYPE_EXECUTION: u8 = 3;
    const TYPE_INJECTION: u8 = 4;
    const TYPE_BLOCKCHAIN: u8 = 5;
    const TYPE_CUSTOM: u8 = 99;

    /// Severity levels
    const SEVERITY_INFO: u8 = 1;
    const SEVERITY_WARNING: u8 = 2;
    const SEVERITY_ERROR: u8 = 3;
    const SEVERITY_CRITICAL: u8 = 4;
    const SEVERITY_EMERGENCY: u8 = 5;

    /// Error codes
    const E_INVALID_EVENT_TYPE: u64 = 0;
    const E_INVALID_SEVERITY: u64 = 1;

    /// Security event record (immutable once created)
    public struct SecurityEvent has key, store {
        id: UID,
        event_type: u8,
        severity: u8,
        source: String,
        component: String,
        title: String,
        description: String,
        epoch: u64,
        metadata: vector<u8>
    }

    /// Event log (append-only counter)
    public struct EventLog has key {
        id: UID,
        owner: address,
        event_count: u64
    }

    /// Event batch for efficient logging
    public struct EventBatch has key, store {
        id: UID,
        batch_size: u64,
        batch_epoch: u64,
        walrus_blob_id: String
    }

    /// Create event log
    public entry fun create_event_log(ctx: &mut TxContext) {
        let log = EventLog {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            event_count: 0
        };
        transfer::transfer(log, tx_context::sender(ctx));
    }

    /// Log a single security event
    public entry fun log_event(
        log: &mut EventLog,
        event_type: u8,
        severity: u8,
        source: String,
        component: String,
        title: String,
        description: String,
        metadata: vector<u8>,
        ctx: &mut TxContext
    ) {
        assert!(event_type >= TYPE_MONITORING && event_type <= TYPE_CUSTOM, E_INVALID_EVENT_TYPE);
        assert!(severity >= SEVERITY_INFO && severity <= SEVERITY_EMERGENCY, E_INVALID_SEVERITY);

        let current_epoch = tx_context::epoch(ctx);

        let event = SecurityEvent {
            id: object::new(ctx),
            event_type,
            severity,
            source,
            component,
            title,
            description,
            epoch: current_epoch,
            metadata
        };

        log.event_count = log.event_count + 1;
        transfer::transfer(event, tx_context::sender(ctx));
    }

    /// Log a batch of events (creates batch record pointing to Walrus blob)
    public entry fun log_event_batch(
        log: &mut EventLog,
        batch_size: u64,
        walrus_blob_id: String,
        ctx: &mut TxContext
    ) {
        let current_epoch = tx_context::epoch(ctx);
        log.event_count = log.event_count + batch_size;

        let batch = EventBatch {
            id: object::new(ctx),
            batch_size,
            batch_epoch: current_epoch,
            walrus_blob_id
        };

        transfer::transfer(batch, tx_context::sender(ctx));
    }

    /// Get event count
    public fun get_event_count(log: &EventLog): u64 {
        log.event_count
    }

    /// Get event info
    public fun get_event_info(event: &SecurityEvent): (u8, u8, u64) {
        (event.event_type, event.severity, event.epoch)
    }
}
