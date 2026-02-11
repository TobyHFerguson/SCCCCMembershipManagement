# SCCCC Membership Management System — Technology Assessment

**Prepared for**: SCCCC Board of Directors  
**Date**: February 2026  
**Author**: Technology review conducted with AI-assisted analysis of the current codebase

---

## Executive **Summary**

The SCCCC Membership Management System is a custom-built software application that automates membership enrollment, renewals, expirations, email communications, member directory, profile management, group subscriptions, and elections. It runs entirely on the club's existing Google Workspace at **zero additional infrastructure cost**.

This report assesses whether this remains a cost-effective approach or whether the club should consider alternatives.

---

## What the System Does

The club's membership management is built on Google Apps Script (GAS) — Google's built-in automation platform for Workspace. It integrates with services the club already uses:

| Google Service | How It's Used |
|---|---|
| **Google Forms** | Member join and renewal forms |
| **Payable extension** | Online payment processing |
| **Google Sheets** | Member database, configuration, audit logs, retry queues |
| **Google Groups** | Mailing lists and access control |
| **Gmail** | Templated member communications (welcome, renewal, expiration notices) |
| **Google Drive & Docs** | Email templates, logos, election documents |
| **Google Apps Script** | Automation engine and web service hosting |

The system provides **seven web-facing services** to members:

1. **Member Directory** — searchable contact information
2. **Profile Management** — members update their own details
3. **Email Change** — update email across all SCCCC systems
4. **Group Management** — manage mailing list subscriptions
5. **Voting Service** — participate in club elections
6. **Home Page** — service navigation portal
7. **Membership Management** — automated lifecycle processing (join, renew, expire, retry failed operations)

---

## Current System by the Numbers

| Metric | Value |
|--------|-------|
| Source code | ~19,400 lines |
| Automated tests | 1,397 test cases |
| Test-to-source ratio | 1.09:1 (more test code than application code) |
| Documentation | ~13,300 lines across 47 documents |
| Runtime dependencies | 0 (runs entirely on Google's platform) |
| Monthly infrastructure cost | **$0** (uses Google Workspace the club already pays for) |
| Deployment environments | 3 (development, staging, production) |

---

## Strengths of the Current Approach

### Zero additional cost
The system runs on the club's existing Google Workspace subscription. There are no hosting fees, database fees, or software licenses. The only cost is volunteer development time.

### Deep Google Workspace integration
Because the system runs inside Google's platform, it has native access to Forms, Sheets, Groups, Gmail, and Drive — no API keys, external authentication, or third-party connectors needed.

### Well-tested and reliable
With nearly 1,400 automated tests and a test-to-source ratio above 1:1, the system has strong quality assurance. Business logic is thoroughly tested before deployment.

### Familiar data storage
All data lives in Google Sheets, which board members and officers can view, search, and understand without specialized tools. There is no opaque database that only a developer can access.

### Appropriate scale
A cycling club's data volumes (hundreds to low thousands of members) will never approach the platform's capacity limits. The technology is well-suited to the organization's size.

---

## Challenges and Risks

### Single maintainer (bus factor)
The system is maintained by one volunteer developer. If that person becomes unavailable, the club would have difficulty maintaining or modifying the system. While the code is well-documented and tested, it requires specialized knowledge of Google Apps Script development.

### Platform limitations require workarounds
Google Apps Script has significant technical constraints that require architectural workarounds. Examples include:
- Web pages cannot use standard responsive design techniques — custom solutions are required for mobile compatibility
- Data passed between server and browser silently corrupts certain data types — requiring manual conversion in every service
- The platform's file loading model requires careful architectural layering to avoid errors
- Standard web development testing tools don't work — a separate testing strategy was engineered around the platform

These workarounds are already built and working, but they add complexity to future development.

### Manual deployment steps
Each new feature or release requires manual configuration steps (creating Google Groups, updating configuration sheets, setting up automated triggers) that must be repeated across development, staging, and production environments.

### No standard handoff path
Unlike systems built on widely-known web frameworks, Google Apps Script expertise is relatively niche. Finding a successor or contractor familiar with this specific platform is harder than finding one for standard web technologies.

---

## Alternative Approaches Considered

### Option A: Commercial Membership Platform
**Examples**: Wild Apricot, MemberPlanet, ClubExpress  
**Cost**: $50–150/month ($600–1,800/year)

| Pros | Cons |
|------|------|
| Zero code to maintain | Monthly cost indefinitely |
| Built-in payments, directory, email, elections | Less customizable than current system |
| Survives volunteer turnover | Data locked in vendor's platform |
| Professional support available | Migration effort to move current data |

Many cycling clubs use platforms like Wild Apricot. This is the strongest option if the goal is to **eliminate dependence on a volunteer developer**.

### Option B: Modern Custom Web Application
**Examples**: Built with standard web technologies, hosted on cloud services  
**Cost**: $0–25/month on free hosting tiers, plus significant development time

| Pros | Cons |
|------|------|
| Better developer tools and testing | Complete rewrite of ~20,000 lines |
| Easier to find developers | Adds hosting and operational responsibility |
| Standard responsive web design | Must rebuild all Google integrations from scratch |
| No platform quirks | Delivers no new functionality to members |

This option solves developer experience problems but delivers no new value to club members. The rewrite effort would be substantial.

### Option C: Move from Apps Script to Google Cloud Functions
**Cost**: $0–5/month (within Google's free tier for this scale)

| Pros | Cons |
|------|------|
| Removes platform limitations | Moderate rewrite of integration code |
| Keeps Google Workspace integration | Requires service account setup and management |
| Existing business logic is reusable | Adds some hosting complexity |
| Standard web development practices | Still requires a technical maintainer |

This is a "surgical upgrade" — keeping the club's investment in Google Workspace while removing the most frustrating technical constraints. Recommended only if the club has a committed technical maintainer who plans to continue active development.

### Option D: Status Quo
**Cost**: $0 + volunteer developer time

| Pros | Cons |
|------|------|
| System works and is deployed | Every new feature requires fighting platform constraints |
| Thoroughly tested and documented | Only one person can maintain it |
| No migration risk | Platform limitations remain |
| Members are already using it | |

---

## Recommendation Summary

| If the club's situation is… | Recommended path |
|---|---|
| Current maintainer plans to continue for the foreseeable future | **Stay on current system.** The hard architectural work is done. New features are primarily business logic, which is the straightforward part. |
| Current maintainer is stepping down in 1–2 years | **Stay on current system** and invest in documentation for handoff. It already works; a successor can operate it even if they can't extend it. |
| The club wants to eliminate dependence on a volunteer developer | **Evaluate a commercial platform** like Wild Apricot. ~$100/month is modest compared to the volunteer hours required to maintain custom software. |
| A new technical volunteer wants better development tools | **Consider migrating to Google Cloud Functions** — preserves the Google Workspace integration while removing platform constraints. |

### The Core Trade-off

The current system costs **$0/year in infrastructure** but depends entirely on **volunteer developer availability**. A commercial platform costs **$600–1,800/year** but is maintained by the vendor and survives volunteer turnover.

For a volunteer-run organization, the question is not primarily technical — it is about **organizational resilience**. The current system is well-built and fully functional. The risk is not that it will break; it is that no one will be available to fix or extend it if the current maintainer moves on.

---

*This assessment was produced by analyzing the complete codebase (~43,000 lines of source code, tests, and documentation) with AI-assisted review, combined with knowledge of the club's Google Workspace usage and the broader landscape of membership management solutions.*
