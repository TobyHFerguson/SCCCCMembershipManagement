# Prefill Form Template
At renewal time we want to present a prefilled form to members, and link to that form in the renewal email we send to our members. In those emails we're also explicit about telling our members that if they wish to *renew* and not *join* then they must use the email address to which this email had been sent.

We do this for convenience to our members, plus it helps us cut back on the number of members that might join instead of renewing and need fixing up later.

## Form Prefills
### Overview
Google Forms can have some (or all!) of their questions prefilled, resulting in a URL that can then be sent to the respondents to complete and send. However these are fixed answers - that prefill URL has a single set of responses, whereas what we want is to fill in answers (Name, Phone) with an answer specific to the member. This can only be done by manipulating the original prefill URL in code, and creating a new prefill specific to the user that way. (The one limitation that no coding can avoid is that the respondent's have to fill in their email address themselves.)

We can use the templating technology we've built which will allow us to take a template and a member's details and fill in fields in the template from the member's details to produce a string (in this case a prefilled URL). That is known working tested code.

For a form with one question, (let's say `First Name?`) prefilled by selecting 'John`', the prefill URL would be:

`https://docs.google.com/forms/d/e/1FAIpQLSfV50VA89UM5fssuuFqkoHP_1wmdh9RgB_gjl1uCNB7IPjr0w/viewform?usp=pp_url&entry.1743075194=John`

For multiple questions another `&entry.12345=NextAnswer` is appended.

So if we wanted to templatize the answer to that question (to allow different members to see `Sarah` or `Bill`, in their version of the form), we'd need to replace the `John` portion with a field, thus:

`https://docs.google.com/forms/d/e/1FAIpQLSfV50VA89UM5fssuuFqkoHP_1wmdh9RgB_gjl1uCNB7IPjr0w/viewform?usp=pp_url&entry.1743075194={First}`

In this case the field is `{First}`, where `First` is a column name from the `Members` sheet.

# SCCCC Members Join/Renew Form Prefill
The original prefill URL is:
`https://docs.google.com/forms/d/e/1FAIpQLSflZH87g2QorLyQUqB3zztzjX9mKtOVdo4tNTf1Ojo8FLxxVw/viewform?usp=pp_url&entry.617015365=Toby&entry.1319508840=Ferguson&entry.1099404401={Phone}`

*templatizing* this for the First, Last and Phone fields we get:

`https://docs.google.com/forms/d/e/1FAIpQLSflZH87g2QorLyQUqB3zztzjX9mKtOVdo4tNTf1Ojo8FLxxVw/viewform?usp=pp_url&entry.617015365={First}&entry.1319508840={Last}&entry.1099404401={Phone}`
