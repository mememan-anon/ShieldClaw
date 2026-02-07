/// Security Event Log
/// Immutable logging of security events to Sui blockchain
/// Provides tamper-proof audit trail for security incidents

module shieldclaw::security_events {
    use sui::object::{Self, UID};
    use sui::tx_context::TxContext;
    use sui::transfer;
    use std::string::String;
    use std::vector;

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

    /// Security event record (immutable)
    struct SecurityEvent has key, store {
        id: UID,
        event_type: u8,
        severity: u8,
        source: String,           // Agent/system that generated event
        component: String,        // Component that generated event
        title: String,
        description: String,
        timestamp: u64,            // Unix timestamp
        epoch: u64,                // Sui epoch
        metadata: vector<u8>,      // Additional metadata (hash of Walrus blob)
        tx_digest: String          // Transaction digest for verification
    }

    /// Event log (append-only)
    struct EventLog has key {
        id: UID,
        owner: address,
        event_count: u64,
        by_type: vector<vector<u8>>,  // Map event_type -> event IDs
        by_severity: vector<vector<u8>>,  // Map severity -> event IDs
        by_source: vector<vector<u8>>    // Map source hash -> event IDs
    }

    /// Event batch for efficient logging
    struct EventBatch has key {
        id: UID,
        events: vector<u8>,  // Array of event IDs
        batch_timestamp: u64,
        walrus_blob_id: String  // Reference to Walrus blob with detailed data
    }

    /// Create event log
    public entry fun create_event_log(ctx: &mut TxContext) {
        let log = EventLog {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            event_count: 0,
            by_type: vector::empty(),
            by_severity: vector::empty(),
            by_source: vector::empty()
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
        // Validate inputs
        assert!(event_type >= TYPE_MONITORING && event_type <= TYPE_CUSTOM, E_INVALID_EVENT_TYPE);
        assert!(severity >= SEVERITY_INFO && severity <= SEVERITY_EMERGENCY, E_INVALID_SEVERITY);

        // Create event record
        let event = SecurityEvent {
            id: object::new(ctx),
            event_type,
            severity,
            source,
            component,
            title,
            description,
            timestamp: ctx.epoch_timestamp_ms() / 1000,  // Convert to seconds
            epoch: tx_context::epoch(ctx),
            metadata,
            tx_digest: String::empty()  // Will be set after transaction
        };

        // Update log
        log.event_count = log.event_count + 1;
        add_to_index(&mut log.by_type, event_type, event.id);
        add_to_index(&mut log.by_severity, severity, event.id);
        add_source_index(&mut log.by_source, &source, event.id);

        // Transfer event to log owner
        transfer::transfer(event, tx_context::sender(ctx));
    }

    /// Log a batch of events
    public entry fun log_event_batch(
        log: &mut EventLog,
        event_types: vector<u8>,
        severities: vector<u8>,
        sources: vector<String>,
        components: vector<String>,
        titles: vector<String>,
        descriptions: vector<String>,
        metadata_batch: vector<vector<u8>>,
        walrus_blob_id: String,
        ctx: &mut TxContext
    ) {
        let len = vector::length(&event_types);
        assert!(vector::length(&severities) == len, E_INVALID_EVENT_TYPE);
        assert!(vector::length(&sources) == len, E_INVALID_EVENT_TYPE);
        assert!(vector::length(&components) == len, E_INVALID_EVENT_TYPE);
        assert!(vector::length(&titles) == len, E_INVALID_EVENT_TYPE);
        assert!(vector::length(&descriptions) == len, E_INVALID_EVENT_TYPE);
        assert!(vector::length(&metadata_batch) == len, E_INVALID_EVENT_TYPE);

        let event_ids = vector::empty<u8>();

        let i = 0;
        while (i < len) {
            let event_type = *vector::borrow(&event_types, i);
            let severity = *vector::borrow(&severities, i);
            let source = *vector::borrow(&sources, i);
            let component = *vector::borrow(&components, i);
            let title = *vector::borrow(&titles, i);
            let description = *vector::borrow(&descriptions, i);
            let metadata = *vector::borrow(&metadata_batch, i);

            // Create event
            let event = SecurityEvent {
                id: object::new(ctx),
                event_type,
                severity,
                source,
                component,
                title,
                description,
                timestamp: ctx.epoch_timestamp_ms() / 1000,
                epoch: tx_context::epoch(ctx),
                metadata,
                tx_digest: String::empty()
            };

            // Update log
            log.event_count = log.event_count + 1;
            add_to_index(&mut log.by_type, event_type, event.id);
            add_to_index(&mut log.by_severity, severity, event.id);
            add_source_index(&mut log.by_source, &source, event.id);

            // Track event ID
            vector::push_back(&mut event_ids, event.id);

            // Transfer event
            transfer::transfer(event, tx_context::sender(ctx));

            i = i + 1;
        }

        // Create batch record
        let batch = EventBatch {
            id: object::new(ctx),
            events: event_ids,
            batch_timestamp: ctx.epoch_timestamp_ms() / 1000,
            walrus_blob_id
        };

        transfer::transfer(batch, tx_context::sender(ctx));
    }

    /// Query events by type
    public fun get_events_by_type(log: &EventLog, event_type: u8): vector<u8> {
        if (event_type >= TYPE_MONITORING && event_type <= TYPE_CUSTOM) {
            let index = (event_type - TYPE_MONITORING) as u64;
            if (index < vector::length(&log.by_type)) {
                return *vector::borrow(&log.by_type, index);
            }
        };
        vector::empty()
    }

    /// Query events by severity
    public fun get_events_by_severity(log: &EventLog, severity: u8): vector<u8> {
        if (severity >= SEVERITY_INFO && severity <= SEVERITY_EMERGENCY) {
            let index = (severity - SEVERITY_INFO) as u64;
            if (index < vector::length(&log.by_severity)) {
                return *vector::borrow(&log.by_severity, index);
            }
        };
        vector::empty()
    }

    /// Get event count
    public fun get_event_count(log: &EventLog): u64 {
        log.event_count
    }

    /// Add event to type/severity index
    fun add_to_index(index: &mut vector<vector<u8>>, key: u8, event_id: UID) {
        // Ensure index has enough slots
        while (vector::length(index) <= (key as u64)) {
            vector::push_back(index, vector::empty<u8>());
        };
        
        // Add event ID to appropriate slot
        let slot = vector::borrow_mut(index, key as u64);
        let id_bytes = object::uid_to_bytes(&event_id);
        vector::append(slot, id_bytes);
    }

    /// Add event to source index (simple hash-based)
    fun add_source_index(index: &mut vector<vector<u8>>, source: &String, event_id: UID) {
        // Simple hash of source string
        let bytes = string::bytes(source);
        let hash = 0u64;
        let i = 0;
        while (i < vector::length(&bytes)) {
            let byte = *vector::borrow(&bytes, i);
            hash = hash + (byte as u64);
            i = i + 1;
        };
        
        // Use hash modulo some size (simplified)
        let slot_index = hash % 16;  // 16 slots
        
        // Ensure index has enough slots
        while (vector::length(index) <= slot_index) {
            vector::push_back(index, vector::empty<u8>());
        };
        
        // Add event ID
        let slot = vector::borrow_mut(index, slot_index);
        let id_bytes = object::uid_to_bytes(&event_id);
        vector::append(slot, id_bytes);
    }
}
