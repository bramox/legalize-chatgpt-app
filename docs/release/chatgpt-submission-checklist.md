# ChatGPT App Submission Checklist

This checklist must be completed before submitting Spanish Law Research to the ChatGPT App Store.

## Prerequisites

### Publisher Account

- [ ] Verified OpenAI publisher account
- [ ] Publisher profile is complete and accurate
- [ ] Publisher contact information is current

### OpenAI Project

- [ ] OpenAI project created with global data residency
- [ ] Project is configured for ChatGPT app submission
- [ ] Project has necessary permissions and settings

### Deployment

- [ ] MCP server is deployed and accessible via HTTPS
- [ ] MCP endpoint is reachable from OpenAI infrastructure
- [ ] HTTPS certificate is valid
- [ ] Service is healthy and responding correctly
- [ ] Rate limiting is configured and functional
- [ ] Monitoring and logging are operational

## Application Materials

### App Metadata

- [ ] App name: Spanish Law Research
- [ ] App description is accurate and concise
- [ ] Category is appropriate (Education/Reference)
- [ ] Supported languages documented (Spanish, English)
- [ ] Jurisdictions listed correctly

### Privacy Policy

- [ ] Privacy policy URL is correct and publicly accessible
- [ ] URL points to: https://github.com/legalize-dev/legalize-chatgpt-app/blob/main/docs/privacy.md
- [ ] Privacy policy is current and accurate
- [ ] Privacy policy describes read-only behavior
- [ ] Data minimization and retention are documented
- [ ] Contact information for privacy issues is provided

### Legal Disclaimer

- [ ] Legal disclaimer is prominent and clear
- [ ] App does not present itself as legal advice
- [ ] Users are directed to verify with official sources
- [ ] Consultation with qualified professionals is recommended

### Attribution

- [ ] Legalize attribution is present
- [ ] legalize-es attribution is present
- [ ] BOE source attribution is present
- [ ] Attribution policy is publicly accessible
- [ ] Tool outputs include source citations

### Documentation

- [ ] README is comprehensive and current
- [ ] Setup instructions are clear
- [ ] Deployment overview is accurate
- [ ] Security policy is present
- [ ] Attribution policy is present
- [ ] Privacy policy is present

## Technical Verification

### MCP Tools

- [ ] All tools are listed correctly in submission
- [ ] Tool schemas match implementation
- [ ] Tools are marked as read-only
- [ ] Tool descriptions are accurate
- [ ] Tool examples work correctly

### Endpoint Testing

- [ ] MCP endpoint is accessible via HTTPS
- [ ] Tool calls return correct responses
- [ ] Error handling works as expected
- [ ] Rate limiting is functional
- [ ] Response sizes are within limits
- [ ] Timeouts are configured correctly

### Security

- [ ] No private endpoints are exposed
- [ ] No secrets are in the repository
- [ ] No credentials in documentation
- [ ] Secret scan passes
- [ ] Security policy is current
- [ ] Security reporting process is documented

## Testing

### Golden Prompts

- [ ] Search prompts work correctly
- [ ] Article retrieval prompts work correctly
- [ ] Reform history prompts work correctly
- [ ] Comparison prompts work correctly
- [ ] Ambiguous query handling works correctly
- [ ] Unsupported jurisdiction handling works correctly
- [ ] Error cases return appropriate responses

### Integration Testing

- [ ] MCP tool listing works
- [ ] Tool calls through ChatGPT work
- [ ] Structured responses match schemas
- [ ] Source citations are included
- [ ] Legal disclaimers are present where appropriate

## Submission Form

### Basic Information

- [ ] App name: Spanish Law Research
- [ ] App description: [Provide approved description]
- [ ] Category: Education/Reference
- [ ] Languages: Spanish, English
- [ ] Website: https://github.com/legalize-dev/legalize-chatgpt-app

### Technical Details

- [ ] MCP endpoint URL: [Provide actual production URL]
- [ ] Authentication type: None (anonymous)
- [ ] Data residency: Global
- [ ] Privacy policy URL: https://github.com/legalize-dev/legalize-chatgpt-app/blob/main/docs/privacy.md

### Content

- [ ] Screenshots provided (if required)
- [ ] Test prompts documented
- [ ] Expected responses documented
- [ ] Use cases described
- [ ] Limitations documented

### Review Materials

- [ ] Code repository: https://github.com/legalize-dev/legalize-chatgpt-app
- [ ] Documentation links provided
- [ ] Attribution policy linked
- [ ] Security policy linked
- [ ] Contact information provided

## Pre-Submission Checks

- [ ] All tests pass
- [ ] Build succeeds
- [ ] Linting passes
- [ ] Type checking passes
- [ ] Secret scan passes
- [ ] Documentation is current
- [ ] Privacy policy is accessible
- [ ] MCP endpoint is healthy
- [ ] Golden prompts pass
- [ ] No known critical bugs

## Post-Submission

- [ ] Monitor submission status
- [ ] Respond to review feedback promptly
- [ ] Address any review comments or requests
- [ ] Make required changes if requested
- [ ] Resubmit if necessary
- [ ] Monitor app performance after approval

## Notes

- Never use placeholder URLs in the submission form
- Always use the actual production MCP endpoint URL
- Ensure the privacy policy URL is publicly accessible
- Be prepared to provide additional documentation if requested
- Monitor the OpenAI Apps SDK documentation for submission requirement changes
- Keep the repository in a clean state during review