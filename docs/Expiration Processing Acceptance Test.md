# Expiration Processing Acceptance Test
## Purpose
To guide a developer as to how to demonstrate that the expiration processing is working, for both successful and unsuccessful cases.

## Success Case
### Description
Multiple club members are to be expired at levels 1, 2, 3, & 4

### Expected Outcome
* Audit log will show that success was obtained for all the members at all the levels
* System log will show that messages were sent to all the members at all the levels
* Member at level 4 will:
  * have their Status set to `Expired`
  * No longer be present in the `Expiry Schedule`


## Failure Case
### Description
A club member whose membership has expired will fail to have their email removed because of an issue with Google Groups. 

### Expected Outcome
* Audit log will show that failure was logged, indicating the issue
* System log will show that:
  * Expiry4 message was sent to all the members at all the levels
  * Group failure occurred
* Member at level 4 will:
  * have their Status set to `Expired`
  * No longer be present in the `Expiry Schedule`
  

## Common Setup
No `System Logs`, `Audit Log`, `Expiration Queue`, `Expiration Dead Letter` sheets
### Properties
Markdown
| Property | Value | Description | Service |
| --- | --- | --- | --- |
| expirationMaxAttempts | 2 | Maximum retry attempts for expiration actions | MembershipManagement |
| expirationBatchSize | 1 | Number of expired members to process per batch | MembershipManagement |
| PREFILL_FORM_TEMPLATE | https://docs.google.com/forms/d/e/1FAIpQLSd1HNA6BbcJhBmYuSs6aJINbKfxlEyfklWanTgFC0TQ-0cmtg/viewform?usp=pp_url&entry.1981419329=Yes&entry.942593962=I+have+read+the+privacy+policy&entry.147802975=I+Agree&entry.1934601261=Share+Name&entry.1934601261=Share+Email&entry.1934601261=Share+Phone&entry.617015365={First}&entry.1319508840={Last}&entry.1099404401={Phone} | Template URL for prefilled forms | ProfileManagement |
| testEmails | TRUE | Use test mode for emails (no actual sending) | MembershipManagement |
| testGroupAdds | TRUE | Use test mode for group additions | MembershipManagement |
| testGroupRemoves | FALSE | Use test mode for group removals | MembershipManagement |
| testGroupEmailReplacements | TRUE | Use test mode for group email changes | MembershipManagement |
| domain | sc3.club | Email domain for member accounts | MembershipManagement |
| logging | TRUE | Enable general logging | Common |
| logOnly | FALSE | Log-only mode (no actual changes) | MembershipManagement |
| loggerLevel | INFO | Log level: DEBUG/INFO/WARN/ERROR | Logger |
| loggerConsoleLogging | TRUE | Enable console logging | Logger |
| loggerSheetLogging | TRUE | Enable sheet-based logging | Logger |
| loggerScriptProperties | FALSE | Enable Script Properties logging | Logger |
| loggerEmailErrors | FALSE | Email error-level logs | Logger |
| loggerEmailRecipient | membership-automation@sc3.club | Email address for error notifications | Logger |
| loggerNamespaces | * | Namespaces to log (comma-separated or * for all) | Logger |

CSV

````csv
Property,Value,Description,Service
expirationMaxAttempts,2,Maximum retry attempts for expiration actions,MembershipManagement
expirationBatchSize,1,Number of expired members to process per batch,MembershipManagement
PREFILL_FORM_TEMPLATE,https://docs.google.com/forms/d/e/1FAIpQLSd1HNA6BbcJhBmYuSs6aJINbKfxlEyfklWanTgFC0TQ-0cmtg/viewform?usp=pp_url&entry.1981419329=Yes&entry.942593962=I+have+read+the+privacy+policy&entry.147802975=I+Agree&entry.1934601261=Share+Name&entry.1934601261=Share+Email&entry.1934601261=Share+Phone&entry.617015365={First}&entry.1319508840={Last}&entry.1099404401={Phone},Template URL for prefilled forms,ProfileManagement
testEmails,TRUE,Use test mode for emails (no actual sending),MembershipManagement
testGroupAdds,TRUE,Use test mode for group additions,MembershipManagement
testGroupRemoves,FALSE,Use test mode for group removals,MembershipManagement
testGroupEmailReplacements,TRUE,Use test mode for group email changes,MembershipManagement
domain,sc3.club,Email domain for member accounts,MembershipManagement
logging,TRUE,Enable general logging,Common
logOnly,FALSE,Log-only mode (no actual changes),MembershipManagement
loggerLevel,INFO,Log level: DEBUG/INFO/WARN/ERROR,Logger
loggerConsoleLogging,TRUE,Enable console logging,Logger
loggerSheetLogging,TRUE,Enable sheet-based logging,Logger
loggerScriptProperties,FALSE,Enable Script Properties logging,Logger
loggerEmailErrors,FALSE,Email error-level logs,Logger
loggerEmailRecipient,membership@sc3.club,Email address for error notifications,Logger
loggerNamespaces,*,Namespaces to log (comma-separated or * for all),Logger
````

### Bootstrap
Markdown
| Reference | id | sheetName | createIfMissing |
| --- | --- | --- | --- |
| Transactions |  | Transactions | TRUE |
| ActiveMembers |  | Members | TRUE |
| ExpirySchedule |  | Expiry Schedule | TRUE |
| ActionSpecs |  | Action Specs | FALSE |
| PublicGroups |  | Public Groups | FALSE |
| MigratingMembers | 1a6DFHGv8NcnkKOCpcA_aukubdEt_sLjy_XE5IfuGCEo | Conditioned CEMembers | FALSE |
| ExpiredMembers |  | Expired Members | TRUE |
| GroupSettings |  | Group Settings | FALSE |
| GroupsByType |  | Groups By Type | FALSE |
| Tokens |  | MagicLinkTokens | TRUE |
| EmailChange |  | Email Change Log | TRUE |
| Elections | https://docs.google.com/spreadsheets/d/1SpFU7uTPRcoHyjD5AH6Pf1RbjBmU_kd9Is6aKNJ9xiE/edit?usp=drive_link | Elections | FALSE |
| ElectionConfiguration | 1SpFU7uTPRcoHyjD5AH6Pf1RbjBmU_kd9Is6aKNJ9xiE | Configuration | FALSE |
| Bootstrap |  | Bootstrap | FALSE |
| AmbiguousTransactions |  | AmbiguousTransactions | TRUE |
| ExpirationFIFO |  | Expiration Queue | TRUE |
| ExpirationDeadLetter |  | Expiration Dead Letter | TRUE |
| Properties |  | Properties | FALSE |
| SystemLogs |  | System Logs | TRUE |
| Audit |  | Audit Log | TRUE |

CSV
````csv
Reference,id,sheetName,createIfMissing
Transactions,,Transactions,TRUE
ActiveMembers,,Members,TRUE
ExpirySchedule,,Expiry Schedule,TRUE
ActionSpecs,,Action Specs,FALSE
PublicGroups,,Public Groups,FALSE
MigratingMembers,1a6DFHGv8NcnkKOCpcA_aukubdEt_sLjy_XE5IfuGCEo,Conditioned CEMembers,FALSE
ExpiredMembers,,Expired Members,TRUE
GroupSettings,,Group Settings,FALSE
GroupsByType,,Groups By Type,FALSE
Tokens,,MagicLinkTokens,TRUE
EmailChange,,Email Change Log,TRUE
Elections,https://docs.google.com/spreadsheets/d/1SpFU7uTPRcoHyjD5AH6Pf1RbjBmU_kd9Is6aKNJ9xiE/edit?usp=drive_link,Elections,FALSE
ElectionConfiguration,1SpFU7uTPRcoHyjD5AH6Pf1RbjBmU_kd9Is6aKNJ9xiE,Configuration,FALSE
Bootstrap,,Bootstrap,FALSE
AmbiguousTransactions,,AmbiguousTransactions,TRUE
ExpirationFIFO,,Expiration Queue,TRUE
ExpirationDeadLetter,,Expiration Dead Letter,TRUE
Properties,,Properties,FALSE
SystemLogs,,System Logs,TRUE
Audit,,Audit Log,TRUE
````

## Success Test Setup
### Members
Markdown
| Status | Email | First | Last | Phone | Joined | Expires | Period | Directory Share Name | Directory Share Email | Directory Share Phone | Migrated | Renewed On |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Active | ep1@icloud.com | Expiry | 1 | (408) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
| Active | ep2@icloud.com | Expiry | 1 | (408) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
| Active | ep3@icloud.com | Expiry | 1 | (408) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
| Active | ep4@icloud.com | Expiry | 1 | (408) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |



CSV
````csv
Status,Email,First,Last,Phone,Joined,Expires,Period,Directory Share Name,Directory Share Email,Directory Share Phone,Migrated,Renewed On
Active,ep1@icloud.com,Expiry,1,(408) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
Active,ep2@icloud.com,Expiry,1,(408) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
Active,ep3@icloud.com,Expiry,1,(408) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
Active,ep4@icloud.com,Expiry,1,(408) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
````

### Public Groups
Markdown
| Email | Name | Subscription |
| --- | --- | --- |
| tg1@sc3.club | Test Group 1 | auto |
| tg3@sc3.club | Test Group 3 | auto |

CSV
````csv
Email,Name,Subscription
tg1@sc3.club,Test Group 1,auto
tg3@sc3.club,Test Group 3,auto
````
### Expiry Schedule
Markdown
| Date | Type | Email |
| --- | --- | --- |
| 11/23/2025 | Expiry1 | ep1@icloud.com |
| 11/23/2025 | Expiry2 | ep2@icloud.com |
| 11/23/2025 | Expiry3 | ep3@icloud.com |
| 11/23/2025 | Expiry4 | ep4@icloud.com |
CSV
````csv
Date,Type,Email
11/23/2025,Expiry1,ep1@icloud.com
11/23/2025,Expiry2,ep2@icloud.com
11/23/2025,Expiry3,ep3@icloud.com
11/23/2025,Expiry4,ep4@icloud.com
````

## Failure Test Setup
### Members
Markdown
| Status | Email | First | Last | Phone | Joined | Expires | Period | Directory Share Name | Directory Share Email | Directory Share Phone | Migrated | Renewed On |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Active | toby.h.ferguson@icloud.com | Toby | Ferguson | (408) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |


CSV
````csv
Status,Email,First,Last,Phone,Joined,Expires,Period,Directory Share Name,Directory Share Email,Directory Share Phone,Migrated,Renewed On
Active,toby.h.ferguson@icloud.com,Toby,Ferguson,(408) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
````
### Expiry Schedule
Markdown
| Date | Type | Email |
| --- | --- | --- |
| 11/23/2025 | Expiry4 | toby.h.ferguson@icloud.com |

CSV
````csv
Date,Type,Email
11/23/2025,Expiry4,toby.h.ferguson@icloud.com
````
### Public Groups
Markdown
| Email | Name | Subscription |
| --- | --- | --- |
| nonexistent@sc3.club | Nonexistent Group | auto |

CSV
````csv
Email,Name,Subscription
nonexistent@sc3.club,Nonexistent Group,auto
````

