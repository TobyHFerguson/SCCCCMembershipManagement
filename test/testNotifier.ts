import chai = require('chai');
const expect = chai.expect;
import {Notifier} from '../src/Notifier'

describe('Notifier tests', () => {
    it('should log a success', () => {
        const notifier = new Notifier()
        notifier.joinSuccess("txn", "member")
        const actual = notifier.joinSuccessLog
        expect(actual).to.deep.equal([{txn: "txn", user: "member"}])
    })
})