# Phase Request Template

Use this template when requesting the next phase from Copilot coding agent.

## Template

```markdown
Phase [X] has been reviewed and merged (PR #[XXX]). 

Please proceed with **Phase [X+1]: [Phase Name]**.

**Deliverables**:
- [Item 1 from ISSUE-SPA-AND-AUTH-COMBINED.md]
- [Item 2]
- [Item 3]

**PR Instructions**:
- Use "References #291" in PR description (NOT "Fixes #291")
- Include Phase [X+1] deliverables checklist
- Stop after Phase [X+1] for review before proceeding to Phase [X+2]

#github-pull-request_copilot-coding-agent
```

## Quick Reference: Phase Summaries

Copy the relevant section when requesting each phase:

### Phase 1: Authentication Migration (Week 2)
**Deliverables**:
- Create verification code UI (`verificationCodeInput.html`)
- Modify `webApp.js` doGet to check feature flag
- Create global endpoints (`sendVerificationCode`, `verifyCode`, `refreshSession`)
- Write comprehensive tests (full verification flow)
- Ensure backward compatibility (magic links still work when flag is OFF)

### Phase 2: Pilot Service - GroupManagementService (Week 3)
**Deliverables**:
- Extract business logic to `GroupManagementService.Manager.js`
- Create `GroupManagementService.Api.js` for GAS orchestration
- Create `GroupManagementApp.html` SPA following CSS framework
- Create global API endpoints
- Simplify WebApp.doGet to SPA shell
- Jest tests: Manager 100%, Api 95%+, integration tests
- Manual testing on all devices/breakpoints

### Phase 3: ProfileManagementService (Week 4)
**Deliverables**:
- Extract profile validation/update logic to `Manager.js`
- Create Api layer for `getProfile`/`updateProfile`
- Client SPA with form validation
- Follow CSS framework pattern from Phase 2
- Jest tests with 95%+ coverage

### Phase 4: DirectoryService (Week 4)
**Deliverables**:
- Extract directory filtering to `Manager.js` (read-only, simplest)
- Create Api layer for `getDirectoryEntries`
- Client SPA with search/filter UI
- Follow CSS framework pattern
- Jest tests with 95%+ coverage

### Phase 5: EmailChangeService (Week 5)
**Deliverables**:
- Extract multi-step email change logic to `Manager.js`
- Create Api layer for each step (request/verify/confirm)
- Client SPA with stepper UI
- Follow CSS framework pattern
- Jest tests for complex flow (95%+ coverage)

### Phase 6: VotingService (Week 6)
**Deliverables**:
- Extract election/voting logic to `Manager.js` (most complex)
- Create Api layer for election management
- Client SPA with voting forms and results display
- Follow CSS framework pattern
- Jest tests for complex voting scenarios (95%+ coverage)

### Phase 7: Cleanup (Week 7)
**Deliverables**:
- Remove old magic link infrastructure (if no other users)
- Remove old doGet implementations
- Delete unused template files
- Update README.md with new auth flow
- Update architecture docs
- Performance validation (all services < 2s)
- Security audit checklist completed

### Phase 8: Production Deployment (Week 8)
**Deliverables**:
- Staging validation (all 5 services tested)
- User communication email drafted
- Feature flag deployment guide
- Monitoring/rollback procedures documented
- Production deployment checklist
- 24-hour monitoring plan

**PR Instructions for Phase 8 ONLY**:
- Use "Fixes #291" in PR description (closes the issue when merged)

## Command Reference

```bash
# Request next phase
gh issue comment 291 --body "[paste template here]"

# Check issue status
gh issue view 291

# If issue auto-closed after merge (shouldn't happen with "References")
gh issue reopen 291

# View all PRs for the project
gh pr list --search "SPA Architecture"
```

## Notes

- **Phases 1-7**: Use "References #291" to keep issue open
- **Phase 8 only**: Use "Fixes #291" to auto-close when complete
- Always include `#github-pull-request_copilot-coding-agent` to trigger the agent
- Review each PR before merging
- Don't request next phase until current phase is merged
