/**
 * @typedef {Object} Directory
 * @property {}
 */
class GoogleDirectory extends Directory {
  constructor(orgUnitPath="/test", domain="santacruzcountycycling.club") {
    super()
    this.orgUnitPath = orgUnitPath.trim(),
    this.domain = domain.trim()
  }

  makeUser(obj) {
    return new User(obj, this.orgUnitPath, this.domain)
  }
  listAllUsers() {
    let pageToken;
    let page;
    do {
      page = AdminDirectory.Users.list({
        customer: 'my_customer',
        orderBy: 'givenName',
        viewType: "admin_view",
        maxResults: 100,
        pageToken: pageToken
      });
      const users = page.users;
      if (!users) {
        console.log('No users found.');
        return;
      }
      // Print the user's full name and email.
      users.forEach((user) => console.log(user))
      pageToken = page.nextPageToken;
    } while (pageToken);
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
      page = AdminDirectory.Users.list(listSpec);
      if (!page.users) {
        return [];
      }
      users = users.concat(page.users)
      pageToken = page.nextPageToken;
    } while (pageToken);
    return users.map((u) => this.makeUser(u))
  }

  updateUser(user) {
    let { customSchemas } = user
    return Utils.retryOnError(() => this.updateUser_(user, { customSchemas }), UserCreationNotCompletedError)
  }

  updateUser_(user, patch) {
    const key = user.primaryEmail
    try {
      AdminDirectory.Users.update(JSON.stringify(patch), key);
      console.log(`user ${key} updated`)
    } catch (err) {
      if (err.message.includes("userKey")) {
        err.message = err.message.replace("userKey", key)
        throw (new UserNotFoundError(err))
      } else if (err.message.includes("User creation is not complete.")) {
        throw new UserCreationNotCompletedError(err)
      }
      throw new DirectoryError(err)
    }
  }

  getUser(user) {
    try {
      return this.makeUser(AdminDirectory.Users.get(user.primaryEmail, { projection: "full", viewType: "admin_view" }))
    } catch (err) {
      if (err.message.endsWith("Resource Not Found: userKey")) return {}
      throw new DirectoryError(err)
    }
  }

  addUserFromTransaction(txn, wait = true) {
    const user = new User(txn, this.orgUnitPath, this.domain)
    user.password = Math.random().toString(36);
    user.changePasswordAtNextLogin = true;
    try {
      let newUser = AdminDirectory.Users.insert(user);
      if (wait) {
        Utils.waitNTimesOnCondition(4000, () => this.isKnownUser(newUser))
      }
      console.log(`user ${user.primaryEmail} created`)
      return newUser
    } catch (err) {
      if (err.message.includes("API call to directory.users.insert failed with error: Entity already exists.")) {
        throw new UserAlreadyExistsError(err)
      } else {
        throw new DirectoryError(err)
      }
    }

  }
  /**
   * Delete the given user
   * @param {User} user
   * @param {boolean} wait wait for deletion to finish before returning
   */
  deleteUser(user, wait = true) {
    try {
      Utils.retryOnError(() => {AdminDirectory.Users.remove(user.primaryEmail.toLowerCase()); console.log(`user ${user.primaryEmail} deleted`); return true}, UserCreationNotCompletedError)
      Utils.waitNTimesOnCondition(wait ? 400 : 1, () => !this.isKnownUser(user))
    }
    catch (err) {
      // Only throw the error if the user might still exist, otherwise ignore it since the user not existing is what we want!
      if (!err.message.endsWith("Resource Not Found: userKey")) throw new UserNotFoundError(err)
    }
    console.log('User %s deleted.', user.primaryEmail);
  }
}