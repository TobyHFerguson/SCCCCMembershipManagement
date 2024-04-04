import chai = require('chai');
import sinon = require('sinon');
import sinonChai = require("sinon-chai");
const expect = chai.expect;
chai.use(sinonChai);

import { DraftType, MailAppType, SendEmailOptions } from '../src/Types';


class MyNewNotifier {
    #mailer:  MailAppType;
    constructor(mailer: MailAppType) {
        this.#mailer = mailer;
    }
    doIt() {
        this.#mailer.getDrafts();
        this.#mailer.sendEmail("to", "from", "body", {})
    }
}
class MyMailStub implements MailAppType {
    sendEmail(recipient: string, subject: string, body: string, options: SendEmailOptions): MailAppType {
        return this;
    }
    getDrafts(): DraftType[] {
        return new Array()
    }
}

describe("testMockingEmails Test Suite", () => {
    const mailer = new MyMailStub();
    it("should fetch drafts from the Gmail system", () => {
        const getDraftsFake = sinon.replace(mailer, "getDrafts", sinon.fake(mailer.getDrafts))
        const mme = new MyNewNotifier(<MailAppType><unknown>mailer)
        mme.doIt();
        expect(getDraftsFake.callCount).to.equal(1);
    })
    it("should send an email", () => {
        const fake = sinon.replace(mailer, "sendEmail", sinon.fake(mailer.sendEmail))
        const mme = new MyNewNotifier(<MailAppType><unknown>mailer)
        mme.doIt();
        expect(fake.callCount).to.equal(1);
        expect(fake.calledOnceWithExactly("to", "from", "body", {}), "sendMail should've been called with these arguments").to.be.true
    })
    it('should be able to fake out class methods', () => {
        // const foo = {
        //     bar: () => "baz",
        // };
        class Foo {
            bar() { return "baz"}
        }
        const foo = new Foo();
        // replace method with a fake one
        const fake = sinon.replace(foo, "bar", sinon.fake.returns("fake value"));
    
        expect(fake()).to.equal("fake value"); // returns fake value
        expect(fake.callCount).to.equal(1); // saves calling information
    })
    it('should be able to stub the GmailApp', () => {
        const stub = sinon.stub(mailer);
        stub.getDrafts.returns(new Array());
        const uut = new MyNewNotifier(stub);
        uut.doIt();
        expect(stub.getDrafts).to.have.been.called
        expect(stub.sendEmail).to.have.been.called.with.calledOnceWithExactly("to", "from", "body", { some: "foo"})
    })
})