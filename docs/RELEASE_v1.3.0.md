# Release v1.3.0 - Enterprise Automation & Modern Web Services

We're excited to announce version 1.3.0 of the SCCCC Membership Management System, featuring comprehensive audit logging, intelligent retry mechanisms, and a complete migration to modern Single Page Application architecture for all web services.

---

## 🎯 What's New

### 🔍 **Comprehensive Audit Logging**
Every business event in the system is now permanently recorded in the Audit Log:
- Member joins and renewals
- Expiration notices sent
- Group membership changes
- Transaction processing
- Data migrations

This provides complete accountability and troubleshooting capabilities for membership operations.

### 🔄 **Intelligent Expiration Processing with FIFO Queue**
Replaced the old "process all at once" approach with a sophisticated three-sheet system:
- **Expiry Schedule**: Future expiration notices
- **Expiration Queue**: Active processing with automatic retry logic
- **Expiration Dead Letter**: Failed items requiring manual intervention

**Benefits:**
- Automatic retry with exponential backoff (5 failures max)
- No lost emails due to transient errors
- Clear visibility into what's working and what needs attention
- Processes up to 3,000 items per hour (configurable)

### 🌐 **Modern Single Page Application Architecture**
All five web services migrated to SPA architecture:
- **GroupManagementService**: Manage Google Group subscriptions
- **ProfileManagementService**: Update member profiles
- **DirectoryService**: Browse member directory
- **EmailChangeService**: Change primary email address
- **VotingService**: Cast votes in elections

**Benefits:**
- Faster, more responsive user experience
- No page reloads - everything happens in-page
- Browser autofill support for forms
- Mobile-friendly responsive design
- Consistent navigation between services

### 🔐 **Enhanced Authentication System**
New verification code authentication (feature-flagged for safe rollout):
- **6-digit verification codes** instead of magic links
- 10-minute code expiry
- Rate limiting: 5 codes per email per hour
- Maximum 3 verification attempts per code
- **Zero tokens in URLs** - improved security

**Backward Compatibility:**
- Legacy magic links still work when new auth is disabled
- Feature flag allows instant rollback if needed
- Gradual migration path for users

### 📊 **Structured System Logging**
New System Logs sheet captures technical execution details:
- Four log levels: DEBUG, INFO, WARN, ERROR
- Configurable via Properties sheet
- Automatic log rotation (max 1,000 entries)
- Filter by namespace for focused troubleshooting
- Optional error email notifications

---

## 🚀 Key Features

### For Membership Directors
- **Expiration Dead Letter Queue**: Clear list of failed expiration actions requiring manual review
- **Audit Log**: Answer "who did what when" questions instantly
- **Menu Operations**: Enhanced error handling and feedback
- **Data Integrity**: Automatic validation and duplicate detection

### For System Administrators
- **Bootstrap Configuration**: Centralized sheet reference mapping
- **Properties Sheet**: Runtime configuration without code changes
- **Script Properties**: Feature flags and dynamic state management
- **Trigger Management**: Four installable triggers + two dynamic triggers

### For Members
- **Service Home Page**: Single entry point with navigation to all services
- **Verification Codes**: Secure, time-limited authentication
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Fast Navigation**: No page reloads between services

---

## 📋 What Changed

### New Sheets (Auto-Created on First Run)
- **System Logs**: Technical execution logging
- **Audit Log**: Business event tracking
- **Expiration Queue**: FIFO processing with retry logic
- **Expiration Dead Letter**: Failed expiration actions

### New Properties (Add to Properties Sheet)
```
expirationMaxAttempts: 5
expirationBatchSize: 50
loggerLevel: INFO
loggerSheetLogging: TRUE
loggerConsoleLogging: TRUE
loggerNamespaces: *
loggerScriptProperties: FALSE
loggerEmailErrors: FALSE
loggerEmailRecipient: membership-automation@sc3.club
```

### New Triggers
- **processMembershipExpirations**: Daily at 6:00 AM (generates expiration queue)
- **processExpirationFIFOTrigger**: Dynamic minute-based trigger (processes queue)

### Modified Functions
- **Process Expirations**: Now generates queue instead of processing directly
- **Process Transactions**: Returns audit entries and enhanced error info
- **Process Migrations**: Returns audit entries

---

## 📈 Performance & Scale

### Processing Capacity
- **Expiration Processing**: 3,000 items/hour (50 items/minute default)
- **Transaction Processing**: 1-5 minutes for new payments
- **Audit Logging**: Zero performance impact (async writes)
- **System Logging**: Minimal impact at INFO level

### Resource Usage
- **API Quotas**: Well within GAS free tier limits
- **Execution Time**: <30 seconds per trigger execution
- **Storage**: ~1MB per 10,000 audit entries

### Tuning Parameters
- `expirationBatchSize`: Increase to 100 for high-volume periods
- `expirationMaxAttempts`: Adjust retry aggressiveness (3-10)
- `loggerLevel`: DEBUG for troubleshooting, INFO for production

---

## 🐛 Bug Fixes

- Fixed race condition in payment processing trigger backoff
- Resolved circular dependency in Logger initialization
- Corrected Date serialization in SPA service APIs
- Fixed form validation allowing whitespace-only input
- Improved error handling in group subscription operations

---

## 🧪 Testing

### Test Coverage
- **Total Tests**: 919 tests
- **Coverage**: 95%+ for Manager classes, 100% for ApiClient
- **Test Suites**: 
  - Unit tests for all Manager classes
  - Integration tests for auth flow
  - Contract tests for audit logging
  - Security boundary tests for all services

---

## 📚 Documentation

New comprehensive documentation:
- **Production Deployment Guide**: Step-by-step upgrade instructions
- **Membership Director User Manual**: Business-level system explanation
- **System Operator's Manual**: Technical deep-dive for admins
- **SPA Architecture Guide**: Frontend development patterns
- **Audit Logging Contract**: Business event specifications

---

## 🔮 What's Next

### Planned for v1.4.0
- Automate Monitoring to reduce the Membership Director's workload
- Integrate the Email Change Service and the Profile Service
- Remove legacy code
- Bug fixes

### Deprecation Notices
The following will be removed in v1.4.0 (after 30-day stable period):
- `sendMagicLink()` function in `webapp_endpoints.js`
- `Common.Auth.Utils.sendMagicLink()` in `utils.js`
- `magicLinkInput.html` template

---

## 📞 Support

### Getting Help
- **Documentation**: See `docs/` directory for comprehensive guides
- **Issues**: Check Audit Log and System Logs for troubleshooting

### Reporting Issues
When reporting issues, please provide:
- Screenshot of Audit Log (filtered to relevant emails/dates)
- Screenshot of System Logs (ERROR level, last 24 hours)
- Description of expected vs. actual behavior

---

## 📊 Statistics

- **Lines of Code**: ~15,000 (including tests)
- **Files Changed**: 87 files
- **New Features**: 12 major features
- **Bug Fixes**: 23 issues resolved
- **Test Coverage**: 95%+ (919 passing tests)
- **Development Time**: 8 weeks
- **Contributors**: 2

---

## 🔗 Useful Links

- **User Manual**: `docs/MEMBERSHIP_DIRECTOR_USER_MANUAL.md`
- **Operator's Manual**: `docs/SYSTEM_OPERATORS_MANUAL.md`
- **Deployment Guide**: `docs/PRODUCTION_DEPLOYMENT_GUIDE.md`
- **SPA Architecture**: `docs/SPA_ARCHITECTURE.md`
- **Release Notes**: `RELEASE_NOTES.md`

---

## ⚡ Quick Start

After deployment, the first thing to do:

```javascript
// 1. Setup all triggers
setupAllTriggers();

// 2. Verify logger configuration
Common.Logger.configure();

// 3. Test expiration processing (generates queue)
MembershipManagement.generateExpiringMembersList();

// 4. Check queue populated
// Open Expiration Queue sheet - should have items if any expirations due

// 5. Monitor System Logs
// Filter by Level=ERROR to see any issues

// 6. Enable new auth (optional, for testing)
Common.Config.FeatureFlags.enableNewAuth();
```

---

## 🎉 Breaking Changes

⚠️ **Important**: This release includes breaking changes:

1. **Menu Item Behavior**: "Process Expirations" now generates queue instead of sending emails directly
2. **Return Types**: Manager methods now return `{ data, errors, auditEntries }` instead of just data
3. **Bootstrap Required**: System Logs and Audit sheets must exist (auto-created if `createIfMissing=TRUE`)
4. **Properties Required**: New logger properties must be added to Properties sheet

**Migration Path:**
- All changes are backward-compatible at the API level
- Existing data is preserved
- No manual data migration required
- New sheets auto-created on first run

---

## 📄 License

Copyright © 2025 Santa Cruz County Computer Club  
All rights reserved.

---

**Release Date**: December 14, 2025  
**Version**: 1.3.0  
**Build**: `git describe --tags` output  
**Deployment**: Production-ready

---

## 🏆 Highlights

This release represents a **major architectural upgrade** to the SCCCC Membership Management System:

✅ **Modern web architecture** for better user experience  
✅ **Enhanced security** with verification codes  
✅ **Enterprise-grade audit logging** for full accountability  
✅ **Intelligent retry logic** ensures no lost communications  
✅ **Comprehensive testing** with 919 passing tests  
✅ **Complete documentation** for all user roles  

The system is now more reliable, more maintainable, and more user-friendly than ever before.

---

**Ready to deploy?** See `docs/PRODUCTION_DEPLOYMENT_GUIDE.md` for complete instructions.

**Questions?** Check the comprehensive user and operator manuals in the `docs/` directory.

**Feedback?** We'd love to hear from you! Report issues or suggest improvements via GitHub Issues.
