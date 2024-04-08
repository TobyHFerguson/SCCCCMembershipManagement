import chai = require('chai');
import Sinon = require('sinon');
import sinonChai = require('sinon-chai');
import { ExpirationProcessor, Member, Notifier } from '../src/Code';
import { EmailConfigurationCollection, EmailConfigurationType } from '../src/Types';
const expect = chai.expect;
chai.use(sinonChai);

describe('ExpirationProcessor tests', () => {
    const commonFields = {
        To: 'home',
        "Bcc on Success": "toby.ferguson+bccOnSuccess",
        "Bcc on Failure": "toby.ferguson+bccOnFailure",
        Notes: ''
    }
    const emailConfig: Pick<EmailConfigurationCollection, 'expirationNotification' | 'expired' | 'deleted'> = {
        expirationNotification: {
            'Email Type': 'expirationNotification',
            "Subject Line": 'Your SCCCC membership will expire in {{N}} days',
            'Days before Expiry': '30,15',
            ...commonFields
        },
        expired: {
            'Email Type': 'expired',
            'Subject Line': 'Your SCCCC membership has expired',
            "Days before Expiry": '0',
            ...commonFields
        },
        deleted: {
            'Email Type': 'deleted',
            'Subject Line': 'Your SCCCC membership has been deleted',
            "Days before Expiry": '14',
            ...commonFields
        }
    }
    describe('constructor tests', () => {
        it('requires an email config and a notifier', () => {
            const notifier = new Notifier()
            expect(new ExpirationProcessor(emailConfig, notifier)).to.not.be.null;
        })
    })
    describe('date detection', () => {
        it('same dates can be detected', () => {
            expect(ExpirationProcessor.isNDaysFrom('2024-03-03', 0, '2024-03-03')).is.true
            expect(ExpirationProcessor.isNDaysFrom('2024-03-03', 1, '2024-03-03')).is.false
            expect(ExpirationProcessor.isNDaysFrom('2024-03-03', -1, '2024-03-03')).is.false
        })
        it('days after can be detected', () => {
            expect(ExpirationProcessor.isNDaysFrom('2024-03-03', 1, '2024-03-03')).is.false
            expect(ExpirationProcessor.isNDaysFrom('2024-03-03', 1, '2024-03-04')).is.true
            expect(ExpirationProcessor.isNDaysFrom('2024-03-04', 1, '2024-03-03')).is.false
        })
        it('days before can be detected', () => {
            expect(ExpirationProcessor.isNDaysFrom('2024-03-03', -1, '2024-03-03')).is.false
            expect(ExpirationProcessor.isNDaysFrom('2024-03-03', -1, '2024-03-04')).is.false
            expect(ExpirationProcessor.isNDaysFrom('2024-03-04', -1, '2024-03-03')).is.true
        })
    })
    describe('checkExpiration tests', () => {
        function getDateNDaysFromToday(n: number): Date {
            const target = new Date();
            target.setDate(target.getDate() + n);
            return target;
        }
        it('it calls the expiration notifier with the number of days to expiration for days in "Days to expiration"', () => {
            const notifierStub = Sinon.createStubInstance(Notifier);
            const numDays = 30
            emailConfig.expirationNotification['Days before Expiry'] = ''+numDays
            const sut = new ExpirationProcessor(emailConfig, notifierStub)
            const memberStub = Sinon.createStubInstance(Member);
            memberStub.getExpires.returns(getDateNDaysFromToday(30)+'')
            sut.checkExpiration(memberStub)
            expect(notifierStub.expirationNotification).to.be.calledOnceWithExactly(memberStub, numDays)
        })
    })
})