
class Directory {
  constructor(adminDirectory = AdminDirectory, orgUnitPath = "/test", domain = "santacruzcountycycling.club",) {
    this.adminDirectory = adminDirectory
    this.orgUnitPath = orgUnitPath.trim(),
      this.domain = domain.trim()
  }

  /**
   * Identify whether member exists
   * @param {Member} member 
   * @returns true iff member is known
   */
  isKnownMember(member) {
    return this.members.some((m) => m.primaryEmail === member.primaryEmail)
  }
  /**
   * 
   * @param {Member | Transaction} obj Object to be converted to Member
   * @returns new Member object
   */
  makeMember(obj) {
    return new Member(obj, this.orgUnitPath, this.domain)
  }

  /**
   * Get all the members of the organization
   * @returns {Member[]} An array of members
   */
  get members() {
    let users = [];
    let pageToken;
    let page;
    do {
      const listSpec = {
        customer: 'my_customer',
        orderBy: 'givenName',
        viewType: "admin_view",
        query: `orgUnitPath:${this.orgUnitPath}`,
        maxResults: 500,
        pageToken: pageToken,
        projection: "full"
      }
      page = this.adminDirectory.Users.list(listSpec);
      if (!page.users) {
        return [];
      }
      users = users.concat(page.users)
      pageToken = page.nextPageToken;
    } while (pageToken);
    return users
  }

  /**
   * Update the stored copy of the member's expiration date
   * @param {Member} member The member whose expiration date is to be updated
   * @returns a copy of the updated member
   */
  updateMember(member) {
    let { customSchemas } = member
    return Utils.retryOnError(() => this.makeMember(this.updateMember_(member, { customSchemas })), MemberCreationNotCompletedError)
  }

  updateMember_(member, patch) {
    const key = member.primaryEmail;
    try {
      let newMember = this.adminDirectory.Users.update(JSON.stringify(patch), key);
      console.log(`newMember ${key} updated`);
      return newMember;
    } catch (err) {
      if (err.message.includes("userKey")) {
        err.message = err.message.replace("userKey", key)
        throw (new MemberNotFoundError(err))
      } else if (err.message.includes("User creation is not complete.")) {
        throw new MemberCreationNotCompletedError(err)
      }
      throw new DirectoryError(err)
    }
  }

  /**
   * Return a copy of the given member, or throw if not found
   * @param {Member} member The member to be returned
   * @returns A copy of the member
   * @throws MemberNotFoundError if the user cannot be found
   */
  getMember(member) {
    try {
      return this.makeMember(this.adminDirectory.Users.get(member.primaryEmail, { projection: "full", viewType: "admin_view" }))
    } catch (err) {
      if (err.message.endsWith("Resource Not Found: userKey")) throw new MemberNotFoundError
      throw new DirectoryError(err)
    }
  }
  /**
   * 
   * @param {Transaction} txn The transaction to be used to add a member
   * @param {boolean} [wait = true] whether to wait for the transaction to complete
   * @returns 
   */
  addMemberFromTransaction(txn, wait = true) {
    const user = new Member(txn, this.orgUnitPath, this.domain)
    user.password = Math.random().toString(36);
    user.changePasswordAtNextLogin = true;
    try {
      let newUser = this.makeMember(this.adminDirectory.Users.insert(user));
      if (wait) {
        Utils.waitNTimesOnCondition(4000, () => this.isKnownMember(newUser))
      }
      console.log(`user ${user.primaryEmail} created`)
      return newUser
    } catch (err) {
      if (err.message.includes("API call to directory.users.insert failed with error: Entity already exists.")) {
        throw new MemberAlreadyExistsError(err)
      } else {
        throw new DirectoryError(err)
      }
    }

  }
  /**
   * Delete the given member
   * @param {Member} member
   * @param {boolean} [wait = true] wait for deletion to finish before returning
   */
  deleteMember(member, wait = true) {
    try {
      Utils.retryOnError(() => { this.adminDirectory.Users.remove(member.primaryEmail.toLowerCase()); console.log(`user ${member.primaryEmail} deleted`); return true }, MemberCreationNotCompletedError)
      Utils.waitNTimesOnCondition(wait ? 400 : 1, () => !this.isKnownMember(member))
    }
    catch (err) {
      // Only throw the error if the user might still exist, otherwise ignore it since the user not existing is what we want!
      if (!err.message.endsWith("Resource Not Found: userKey")) throw new MemberNotFoundError(err)
    }
    console.log('Member %s deleted.', member.primaryEmail);
  }
}

class DirectoryError extends Error {
  constructor(message) {
    super(message)
    this.name = "DirectoryError"
  }
}

class MemberAlreadyExistsError extends DirectoryError {
  constructor(message) {
    super(message)
    this.name = "MemberAlreadyExistsError"
  }
}

class MemberNotFoundError extends DirectoryError {
  constructor(message) {
    super(message);
    this.name = "MemberNotFoundError"
  }
}

class MemberCreationNotCompletedError extends DirectoryError {
  constructor(message) {
    super(message);
    this.name = "UserConstructionNotCompletedError"
  }
}