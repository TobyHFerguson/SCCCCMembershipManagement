const { sendEmails_ } = require('../src/JavaScript/email')
const { ActionType } = require('../src/JavaScript/triggers')

const actionSpecs = [
    {
        Type: 'Join',
        Subject: 'Welcome to the club',
        Body: 'Welcome to the club, here is your membership card'
    },
    {
        Type: 'Renew',
        Subject: ' Membership Renewal',
        Body: '{Last} Your membership has been renewed'
    },
    {
        Type: 'Expiry1',
        Subject: '{First} Membership One',
        Body: 'Your membership has expired'
    },
    {
        Type: 'Expiry4',
        Subject: 'Expiry 4',
        Body: 'Your membership has expired'
    },

]

const members = [
    {
        Email: 'foo@bar',
        First: 'Foo',
        Last: 'Bar',
    },
    {
        Email: 'feetle',
        First: 'Ping',
        Last: 'Bong',
    }
]
describe('EmailSender', () => {
    let emailsSent;
    beforeEach(() => {
        emailsSent = []
    })
    const logger = (email) => emailsSent.push(email)
    it('should do nothing if the queue is empty', () => {

        sendEmails_([], logger, actionSpecs, members)
        expect(emailsSent).toEqual([])
    })
    it('should send an email if the queue is not empty', () => {
        const emailQueue = [{
            Email: 'foo@bar', Type: ActionType.Expiry1
        },
        { Email: 'feetle', Type: ActionType.Renew }]
        sendEmails_(emailQueue, logger, actionSpecs, members)
        expect(emailsSent.length).toEqual(2)
        expect(emailsSent[1].subject).toEqual('Foo Membership One')
        expect(emailsSent[1].to).toEqual('foo@bar')
       expect(emailsSent[0].htmlBody).toEqual('Bong Your membership has been renewed')
       expect(emailQueue.length).toEqual(0)
    })
})