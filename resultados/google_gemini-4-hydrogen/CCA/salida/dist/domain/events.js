let eventCounter = 0;
export function createDomainEvent(type, aggregateId, version, payload, now = new Date()) {
    eventCounter += 1;
    const randomPart = Math.random().toString(36).slice(2, 10);
    return {
        eventId: `evt_${now.getTime()}_${eventCounter}_${randomPart}`,
        type,
        aggregateId,
        occurredAt: now.toISOString(),
        version,
        payload,
    };
}
//# sourceMappingURL=events.js.map