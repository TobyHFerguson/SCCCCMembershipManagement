/**
 * @typedef {Object} Directory
 * @property {}
 */
const Directory = (() => {
  const listAllUsers = () => {
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
  const getAllUsers = () => {
    let users = [];
    let pageToken;
    let page;
    do {
      page = AdminDirectory.Users.list({
        customer: 'my_customer',
        orderBy: 'givenName',
        viewType: "admin_view",
        query: "orgUnitPath:/members",
        maxResults: 500,
        pageToken: pageToken,
        projection: "full"
      });
      if (!page.users) {
        console.log('No users found.');
        return;
      }
      users = users.concat(page.users)
      pageToken = page.nextPageToken;
    } while (pageToken);
    return users
  }

  const testGetAllUsers = () => {
    getAllUsers().forEach((u) => console.log(`User: ${u.primaryEmail}`))
  }

  const testUserObject = () => {
    let u = createUserObject_("p", "gn", "fN", "re", "rp", "oup")
    console.log(u);
    u = createUserObject_("p")
    console.log(u);
  }


  const testUpdateUser = () => {
    let user = AdminDirectory.Users.get("X.Y@santacruzcountycycling.club")
    console.log(user)
    AdminDirectory.Users.update(user, "X.Y@santacruzcountycycling.club")
  }
  const updateUser_ = (user, patch) => {
    const key = user.primaryEmail
    try {
      AdminDirectory.Users.update(patch, key);
      console.log(`user ${key} updated`)
    } catch (err) {
      err.message = err.message.replace("userKey", key)
      console.error(err)
      throw (err)
    }
  }

  const getUser = (primaryEmail) => {
    try {
      return AdminDirectory.Users.get(primaryEmail, { projection: "full", viewType: "admin_view" })
    } catch (err) {
      if (err.message.endsWith("Resource Not Found: userKey")) return {}
      throw err
    }
  }

  const testGetUser = () => { console.log(getUser("Jane@santacruzcountycycling.club")) }

  const addUser_ = (user) => {
    user.password = Math.random().toString(36);
    user.changePasswordAtNextLogin = true;
    user = AdminDirectory.Users.insert(user);
    console.log(`user ${user.primaryEmail} created`)
  }

  const deleteUser = (user) => {
    try { AdminDirectory.Users.remove(user.primaryEmail.toLowerCase()) }
    catch (err) {
      // Only throw the error if the user might still exist, otherwise ignore it since the user not existing is what we want!
      if (!err.message.endsWith("Resource Not Found: userKey")) throw err
    }
    console.log('User %s deleted.', user.primaryEmail);
  }
  return {
    getAllUsers,
    addUser_,
    updateUser_
  }
})()