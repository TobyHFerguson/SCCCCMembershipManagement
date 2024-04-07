import chai = require('chai');
import Sinon = require('sinon');
import sinonChai = require('sinon-chai');
import { ExpirationProcessor, Notifier } from '../src/Code';
import { EmailConfigurationCollection, EmailConfigurationType } from '../src/Types';
const expect = chai.expect;
chai.use(sinonChai);

describe('ExpirationProcessor tests', () => {
    describe('constructor tests', () => {
        it('requires an email config and a notifier', () => {
            const commonFields = {
                To: 'home',
                "Bcc on Success": "toby.ferguson+bccOnSuccess",
                "Bcc on Failure": "toby.ferguson+bccOnFailure",
                Notes: ''
            }
            const emailConfig: Pick<EmailConfigurationCollection, 'expirationNotification' | 'expired' | 'deleted'> = {
                expirationNotification: { 
                    'Email Type':  'expirationNotification',
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
            const notifier = new Notifier()
            expect(new ExpirationProcessor(emailConfig, notifier)).to.not.be.null;
        })
    })
})