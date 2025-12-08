# Issue 303 Testing

## Find Possible Renewals
### Find These
| Status | Email | First | Last | Phone | Joined | Expires | Period | Directory Share Name | Directory Share Email | Directory Share Phone | Migrated | Renewed On |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Active | membership-automation@sc3.club | Identical | 1 | (408) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
| Active | membership-automation@sc3.club | Identical | 1 | (408) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |
| Active | membership-automation@sc3.club | Email | Different | (123) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
| Active | foo@bar.com | Email | Different | (123) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |
| Active | phone@phone.com | Phone | Different | (234) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
| Active | phone@phone.com | Phone | Different | (234) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |
| Active | firstlettercase@foo.com | First | LetterCase | (345) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
| Active | firstlettercase@foo.com | first | LetterCase | (345) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |
| Active | lastlettercase@foo.com | Last | LetterCase | (456) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
| Active | lastlettercase@foo.com | Last | letterCase | (456) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |
| Active | firstletter@foo.com | First | First | (789) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
| Active | firstletter@foo.com | Finlay | First | (789) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |
| Active | lastletter@foo.com | Aaron | Leigh | (890) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
| Active | lastletter@foo.com | Aaron | Lee | (890) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |

````
Status,Email,First,Last,Phone,Joined,Expires,Period,Directory Share Name,Directory Share Email,Directory Share Phone,Migrated,Renewed On
Active,membership-automation@sc3.club,Identical,1,(408) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
Active,membership-automation@sc3.club,Identical,1,(408) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
,,,,,,,,,,,,
Active,membership-automation@sc3.club,Email,Different,(123) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
Active,foo@bar.com,Email,Different,(123) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
,,,,,,,,,,,,
Active,phone@phone.com,Phone,Different,(234) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
Active,phone@phone.com,Phone,Different,(234) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
,,,,,,,,,,,,
Active,firstlettercase@foo.com,First,LetterCase,(345) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
Active,firstlettercase@foo.com,first,LetterCase,(345) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
,,,,,,,,,,,,
Active,lastlettercase@foo.com,Last,LetterCase,(456) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
Active,lastlettercase@foo.com,Last,letterCase,(456) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
,,,,,,,,,,,,
Active,firstletter@foo.com,First,First,(789) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
Active,firstletter@foo.com,Finlay,First,(789) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
,,,,,,,,,,,,
Active,lastletter@foo.com,Aaron,Leigh,(890) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
Active,lastletter@foo.com,Aaron,Lee,(890) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
````

* Expect this dialog:

```
The following row pairs look as if they might be a join when they should be a renewal.

They have some identity data in common and the join date of one is before the expiry date of the other:

2 & 3
5 & 6
8 & 9
11 & 12
14 & 15
17 & 18
20 & 21

Review these pairs and merge as needed using the "Merge Selected Members" menu item.
```

### Not These
| Status | Email | First | Last | Phone | Joined | Expires | Period | Directory Share Name | Directory Share Email | Directory Share Phone | Migrated | Renewed On |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Active | firstname@foo.com | First | Name | (890) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
| Active | firstname@foo.com | Bill | Name | (890) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |
| Active | lastname@foo.com | Last | Name | (213) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
| Active | lastname@foo.com | Susan | Name | (213) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |
| Active | email1@foo.com | media | nomatch | (213) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
| Active | email2@foo.com | media | nomatch | (214) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |
| Expired | expired@sc3.club | Identical | 1 | (666) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
| Active | expired@sc3.club | Identical | 1 | (666) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |

````
Status,Email,First,Last,Phone,Joined,Expires,Period,Directory Share Name,Directory Share Email,Directory Share Phone,Migrated,Renewed On
Active,firstname@foo.com,First,Name,(890) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
Active,firstname@foo.com,Bill,Name,(890) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
,,,,,,,,,,,,
Active,lastname@foo.com,Last,Name,(213) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
Active,lastname@foo.com,Susan,Name,(213) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
,,,,,,,,,,,,
Active,email1@foo.com,media,nomatch,(213) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
Active,email2@foo.com,media,nomatch,(214) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
,,,,,,,,,,,,
Expired,expired@sc3.club,Identical,1,(666) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
Active,expired@sc3.club,Identical,1,(666) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
````

## Merge Selected Members
### Merge These Pairs
| Status | Email | First | Last | Phone | Joined | Expires | Period | Directory Share Name | Directory Share Email | Directory Share Phone | Migrated | Renewed On |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Active | membership-automation@sc3.club | Identical | 1 | (408) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
| Active | membership-automation@sc3.club | Identical | 1 | (408) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |
| Active | membership-automation@sc3.club | Email | Different | (123) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
| Active | foo@bar.com | Email | Different | (123) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |
| Active | phone@phone.com | Phone | Different | (234) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
| Active | phone@phone.com | Phone | Different | (234) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |
| Active | firstlettercase@foo.com | First | LetterCase | (345) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
| Active | firstlettercase@foo.com | first | LetterCase | (345) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |
| Active | lastlettercase@foo.com | Last | LetterCase | (456) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
| Active | lastlettercase@foo.com | Last | letterCase | (456) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |
| Active | firstletter@foo.com | First | First | (789) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
| Active | firstletter@foo.com | Finlay | First | (789) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |
| Active | lastletter@foo.com | Aaron | Leigh | (890) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
| Active | lastletter@foo.com | Aaron | Lee | (890) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |

````
Status,Email,First,Last,Phone,Joined,Expires,Period,Directory Share Name,Directory Share Email,Directory Share Phone,Migrated,Renewed On
Active,membership-automation@sc3.club,Identical,1,(408) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
Active,membership-automation@sc3.club,Identical,1,(408) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
,,,,,,,,,,,,
Active,membership-automation@sc3.club,Email,Different,(123) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
Active,foo@bar.com,Email,Different,(123) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
,,,,,,,,,,,,
Active,phone@phone.com,Phone,Different,(234) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
Active,phone@phone.com,Phone,Different,(234) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
,,,,,,,,,,,,
Active,firstlettercase@foo.com,First,LetterCase,(345) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
Active,firstlettercase@foo.com,first,LetterCase,(345) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
,,,,,,,,,,,,
Active,lastlettercase@foo.com,Last,LetterCase,(456) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
Active,lastlettercase@foo.com,Last,letterCase,(456) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
,,,,,,,,,,,,
Active,firstletter@foo.com,First,First,(789) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
Active,firstletter@foo.com,Finlay,First,(789) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
,,,,,,,,,,,,
Active,lastletter@foo.com,Aaron,Leigh,(890) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
Active,lastletter@foo.com,Aaron,Lee,(890) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
````
### Not These
Expect this dialog:

```
Merge not performed
Selected rows are not a valid possible renewal pair. Ensure both are Active, first letters of first/last names match, they share email or phone, and the later Joined is before the earlier Expires.
```

| Status | Email | First | Last | Phone | Joined | Expires | Period | Directory Share Name | Directory Share Email | Directory Share Phone | Migrated | Renewed On |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Active | firstname@foo.com | First | Name | (890) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
| Active | firstname@foo.com | Bill | Name | (890) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |
| Active | lastname@foo.com | Last | Name | (213) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
| Active | lastname@foo.com | Susan | Name | (213) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |
| Active | email1@foo.com | media | nomatch | (213) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
| Active | email2@foo.com | media | nomatch | (214) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |
| Expired | expired@sc3.club | Identical | 1 | (666) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |
| Active | expired@sc3.club | Identical | 1 | (666) 386 9343 | 11/12/2025 | 11/12/2026 | 1 | TRUE | FALSE | FALSE |  |  |

````
Status,Email,First,Last,Phone,Joined,Expires,Period,Directory Share Name,Directory Share Email,Directory Share Phone,Migrated,Renewed On
Active,firstname@foo.com,First,Name,(890) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
Active,firstname@foo.com,Bill,Name,(890) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
,,,,,,,,,,,,
Active,lastname@foo.com,Last,Name,(213) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
Active,lastname@foo.com,Susan,Name,(213) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
,,,,,,,,,,,,
Active,email1@foo.com,media,nomatch,(213) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
Active,email2@foo.com,media,nomatch,(214) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
,,,,,,,,,,,,
Expired,expired@sc3.club,Identical,1,(666) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
Active,expired@sc3.club,Identical,1,(666) 386 9343,11/12/2025,11/12/2026,1,TRUE,FALSE,FALSE,,
````
