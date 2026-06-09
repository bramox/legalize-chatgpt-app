# Incident Response Runbook

This runbook provides procedures for responding to operational incidents in Spanish Law Research. It omits private credentials and exact management endpoints to maintain security in the public repository.

## Incident Categories

### Service Outage

**Symptoms**: MCP endpoint unreachable, high error rates, service not responding

**Procedure**:

1. Check Railway service status through Railway console
2. Review application logs for errors or crashes
3. Verify persistent volume is mounted and accessible
4. Check for deployment failures or rollback events
5. Restart service if needed through Railway console
6. Monitor logs after restart for recurring issues

### Sync Failure

**Symptoms**: Index stale alert, sync divergence alert, manual sync fails

**Procedure**:

1. Check sync logs for specific failure reason
2. Verify ephemeral storage has sufficient space
3. Check network connectivity to `legalize-dev/legalize-es`
4. Verify persistent volume has sufficient space for new artifacts
5. If upstream repository structure changed, update parsing logic
6. Manually trigger sync if automated scheduler failed
7. If sync consistently fails, retain previous active database and investigate offline

### Performance Degradation

**Symptoms**: High latency, slow responses, timeout errors

**Procedure**:

1. Check resource utilization (CPU, memory, disk I/O)
2. Review database query performance
3. Check for unusual traffic patterns or abuse
4. Verify rate limiting is functioning correctly
5. Review cache hit rates
6. Check database file size and FTS index integrity
7. Consider scaling resources if sustained high load

### Security Incident

**Symptoms**: Unauthorized access attempts, credential exposure, suspicious traffic

**Procedure**:

1. Immediately rotate any exposed secrets through Railway console
2. Review access logs and authentication attempts
3. Block abusive IP addresses if applicable
4. Verify no private endpoints are exposed publicly
5. Run secret scan on repository
6. Report security issues through GitHub private security advisories
7. Document incident and post-mortem for future prevention

### Data Integrity Issues

**Symptoms**: Incorrect search results, missing articles, corrupted data

**Procedure**:

1. Verify database file integrity
2. Check FTS index consistency
3. Review sync logs for corruption warnings
4. If corruption detected, trigger fresh sync from source
5. Validate sync results against known good data
6. Monitor for recurrence after fix

## Communication

### Internal

- Document incident timeline and actions taken
- Note any configuration changes made during response
- Record root cause analysis once incident is resolved

### Public

- For outages affecting users, consider brief status update
- For security incidents, follow responsible disclosure process
- Do not expose private infrastructure details in public communications

## Recovery Priorities

1. Restore service availability
2. Ensure data integrity and accuracy
3. Verify security boundaries are intact
4. Confirm monitoring and alerts are functional
5. Document lessons learned

## Prevention

- Regular monitoring of alerts and metrics
- Periodic review of rate limits and abuse patterns
- Keep dependencies up to date
- Regular secret rotation
- Test recovery procedures periodically
- Maintain current documentation

## Escalation

For incidents beyond standard procedures or requiring additional expertise:

- Escalate to project maintainers
- Consider engaging Railway support for platform issues
- For security incidents, follow responsible disclosure and involve security team if available

## Post-Incident Actions

After resolving an incident:

1. Conduct root cause analysis
2. Update documentation if procedures need improvement
3. Implement preventive measures if applicable
4. Update runbook with lessons learned
5. Consider incident post-mortem for significant events