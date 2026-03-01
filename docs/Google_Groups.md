# Google Groups
The club uses Google Groups for communication to and between its members, as well as some security in Google Drive.

The Groups are:
| Name | Email | Aliases | Subscription | Type | Members | Managers | Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A Group Discussions | a_group_discussions |  | manual | Discussion | Anyone |  |  |
| Board Announcements | board_announcements |  | auto | Announcement | Everyone | Board Discussions |  |
| Board Discussions | board_discussions |  | invitation | Discussion | Officers, Directors |  |  |
| Calendar Amins | calendar_admins |  | invitation | Security | Board Discussions,  |  | I don't believe this is needed |
| Century Director | century |  | invitation | Role | mauranoel0107@gmail.com |  |  |
| Clothier | clothier |  | invitation | Role | a12gilbert@gmail.com |  |  |
| Communications | communications | roadrunner | invitation | Role | eileenbeaudry@gmail.com |  |  |
| Directors | directors |  | invitation | Discussion | Grants Director, Group Admins, Historian, IT Director, Librarian, Member Discussions, Membership, Officers, President, Publicity, Ride Announcements, Ride Director, Ride Schedulers, Safety & Education Directo, Secretary, Social Director, Tour Director, Treasurer |  |  |
| Drive Admins | drive_admins |  | invitation | Security | sc, IT |  | Has Manager permissions on shared drive |
| Election Admins | election.admins | election_admins | invitation | Security | membership-automation@sc3.club | Membership Director | Used to ensure that only automnation and Election Officers (a virtual group) have access to Election info |
| Grants Director | grants |  | invitation | Role | mauranoel0107@gmail.com |  |  |
| Group Admins | group-admins-sg@sc3.club |  | invitation | Security |  | sc | Group for managing groups |
| Historian | historian |  | inivation | Role |  |  |  |
| IT Director | it | info | invitation | Role | toby.h.ferguson@gmail.com |  |  |
| Librarian | librarian |  | invitation | Role |  |  |  |
| Member Discussions | member_discussions |  | auto | Dicussion | Anyone |  |  |
| Membership | membership |  | invitation | Role | ssslm@sbcglobal.net |  |  |
| Officers | officers |  | invitation | Discussion | President, Vice President, Treasurer, Secretary |  |  |
| President | president |  | invitation | Role | a12gilbert@gmail.com |  |  |
| Publicity | publicity |  | invitation | Role |  |  |  |
| Ride Announcements | ride_announcements |  | auto | Announcement | Everyone | Ride Schedulers |  |
| Ride Director | rides |  | invitation | Role | kmcwaid@gmail.com |  |  |
| Ride Schedulers | rs |  | invitation | Discussion | Elsvandam@live.com, jacky6vrl@gmail.com, jeannine.gauthier@gmail.com, petronellavandam@gmail.com, pstudenkov@gmail.com, Ride Director, shaayac@gmail.com, shawn.bike.7@gmail.com, shawn.pen@me.com, tolacycledude@sbcglobal.net |  |  |
| Safety & Education Directo | safety |  | invitation | Role | petepearson4000@gmail.com |  |  |
| Secretary | secretary |  | invitation | Role | beachnit@pacbell.net |  |  |
| Social Director | social |  | invitation | Role | mauranoel0107@gmail.com |  |  |
| Tour Director | tour_director |  | invitation | Role |  |  |  |
| Treasurer | treasurer |  | invitation | Role | cindygpierce@gmail.com |  |  |
| Vice President | vp |  | invitation | Role | boyfromlexington@gmail.com |  |  |

Columns are defined thus:
* **Name**: Human readable name of the group
* **Email**: Group email address (within the **sc3.club** domain)
* **Aliases**: Group email aliases (within the **sc3.club** domain)
* **Subscription**: How members of the group are subscribed:
  * **auto**: Subscribed automatically upon joining the club
  * **manual**: Members can choose to subscribe but are not automatically subscribed
  * **invitation**: Invitation only
* **Type**:
  * **Announcement**: One way communication from the group's Managers to the groups Members
  * **Discussion**: Two way communication between the group's members
  * **Role**: An alias for a role within the club
  * **Security**: A group that has deep security implications.
* **Members**: Who are members of this group:
  * **Everyone**: Everyone is expected to be a member of this group
  * **Anyone**: Anyone can join this group
  * Other Group Names: A list of groups who (transitively) can be invited to join that group
  * Email addresses: Specific addresses of members who currently occupy the corresponding role

# Current Group Management
All groups are created manually. It is population of the groups which has had some automation applied.
## Automated
The `Public Groups Table` contains the information about those groups which currently have automation applied:
| Email | Name | Subscription |
| --- | --- | --- |
| a_group_discussions@sc3.club | A Group Discussions | manual |
| board_announcements@sc3.club | Board Announcements | Auto |
| member_discussions@sc3.club | Member Discussions | Auto |
| ride_announcements@sc3.club | Ride Announcements | Auto |

This automation occurs when members join and are used to subscribe members to these groups.

## Manual
Membership of the other groups is managed manually.

# Desired Group Management
The current automation works well. But we'd like to augment it to handle nested group relationships so that we can easily change the allocation of members to roles in a spreadsheet and have automation which will add/delete members as appropriately to represent the nested group relationships.

In addition we wish to be easily able to add/remove Role groups since this is part of what changes frequently.

Note that Security groups must not be automated. 
# Nested Group Limitations
Nested Groups have two significant limitations:
## Managers
In Google Groups one group cannot be a manager of another group. Its often easiest to thing of things that way but, ultimately, one has to flatten out the transitive subgroups and only have user emails as the managers of a group
## Calendars
In Google Calendars only the top level group can be expanded and only the replies from that immediate expansion are shown. This impacts us because we have a nested hierarchy (board > officers/directors -> roles -> individual members) and what we'd like is to simply invite 'the board' and to see the replies from the individual members (or their aliases). But this expansion restriction and the depth of our hierarchy prevents that. So again, flattening a group through the transitive relationship is what is needed there. 