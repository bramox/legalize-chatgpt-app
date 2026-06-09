# Release Checklist

This checklist must be completed before releasing a new version of Spanish Law Research.

## Pre-Release

### Code Quality

- [ ] All tests pass (unit, integration, end-to-end)
- [ ] Linting passes without errors or warnings
- [ ] Type checking passes without errors
- [ ] Build completes successfully
- [ ] No console errors or warnings in production mode
- [ ] Code follows project coding standards

### Documentation

- [ ] README is updated with new features and changes
- [ ] CHANGELOG is updated with version notes
- [ ] API documentation reflects current implementation
- [ ] Deployment documentation is accurate
- [ ] Attribution and privacy documentation remain current
- [ ] Legal disclaimers are accurate and visible

### Security

- [ ] Secret scan passes with no secrets found
- [ ] No credentials in repository
- [ ] No private endpoints exposed in documentation
- [ ] Dependencies are up to date with no known vulnerabilities
- [ ] Rate limiting is configured correctly
- [ ] Security policy is current

### Testing

- [ ] Golden prompt tests pass against production-like endpoint
- [ ] MCP tools return correct schemas
- [ ] Error handling works as expected
- [ ] Rate limiting functions correctly
- [ ] Sync process works and rolls back on failure
- [ ] Database integrity checks pass

### Deployment

- [ ] Environment variables are configured
- [ ] Railway service is healthy
- [ ] Persistent volume is mounted and accessible
- [ ] Database and indexes are current
- [ ] Sync process is scheduled and functional
- [ ] Monitoring and alerts are configured
- [ ] HTTPS certificate is valid

## Release

### Versioning

- [ ] Version number is updated according to semantic versioning
- [ ] Git tag is created for the release
- [ ] Release notes are prepared

### Deployment

- [ ] Deploy to Railway
- [ ] Verify deployment success
- [ ] Run smoke tests against deployed endpoint
- [ ] Check monitoring for errors
- [ ] Verify sync process runs successfully

### ChatGPT App Submission (if applicable)

- [ ] App metadata is accurate and current
- [ ] Privacy policy URL is correct and publicly accessible
- [ ] Attribution policy is visible
- [ ] Legal disclaimers are present
- [ ] Screenshots are prepared if required
- [ ] Test prompts and expected responses are documented
- [ ] MCP endpoint URL is correct and accessible
- [ ] Submission form is completed accurately
- [ ] Publisher account is verified

## Post-Release

### Verification

- [ ] Monitor error rates for increase
- [ ] Check sync process runs successfully
- [ ] Verify rate limiting is effective
- [ ] Review logs for unexpected issues
- [ ] Confirm monitoring and alerts are functioning

### Documentation

- [ ] Update documentation with any post-release findings
- [ ] Archive release notes
- [ ] Update version information in README

### Communication

- [ ] Announce release if applicable
- [ ] Notify stakeholders of changes
- [ ] Update issue tracker for next release

## Rollback Plan

If critical issues are discovered post-release:

1. Identify the specific issue and impact
2. Determine if rollback is necessary or if hotfix is possible
3. If rollback: revert to previous stable deployment
4. If hotfix: implement fix, test thoroughly, then deploy
5. Monitor closely after rollback or hotfix
6. Document the incident and prevention measures

## Notes

- Always test in a staging environment before production deployment
- Keep backups of previous working deployments
- Monitor closely for at least 24 hours after release
- Have on-call availability during initial release period