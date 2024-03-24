/** Based on Admin SDK:  Directory API: https://developers.google.com/admin-sdk/directory/reference/rest */
class Users {
  constructor() {
    this.users = []
  }
  get(primaryEmail) {
    return this.users.find((u) => u.primaryEmail === primaryEmail)
  }
  insert(user) {
    if (this.get(user.primaryEmail)) { throw new Error("API call to directory.users.insert failed with error: Entity already exists.") }
    const newUser = JSON.parse(JSON.stringify(user))
    this.users.push(newUser)
    return newUser
  }
  list(queryParameters) {
    const result = { users: JSON.parse(JSON.stringify(this.users)) }
    return result
  }
  remove(primaryEmail) {
    let i = this.users.findIndex((u) => u.primaryEmail === primaryEmail);
    if (i === -1) throw new Error("Resource Not Found: userKey");
    this.users.splice(i, 1)
  }
  update(patch, primaryEmail) {
    let i = this.users.findIndex((u) => u.primaryEmail === primaryEmail);
    if (i === -1) throw new Error("Resource Not Found: userKey");
    const oldUser = this.users[i]
    const newUser = { ...oldUser, ...JSON.parse(patch) }
    this.users.splice(i, 1, newUser)
    return JSON.parse(JSON.stringify(newUser))
  }
}

class Admin {
    constructor(users = new Users()) {
        this.Users = users
    }
}