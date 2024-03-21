class Directory {
  constructor() {
    this.users = [];
  }
  get members() {
    return this.users
  }
  set members(members) {
    this.users = members
  }
  addUser(user) {
    if (this.users.some((m) => m.primaryEmail === user.primaryEmail)) throw new UserAlreadyExistsError
    this.users.push(new User(user))
  }
  /**
   * Delete the given user
   * @param {User} user the user to be deleted
   */
  deleteUser(user) {
    let i = this.users.findIndex((u) => u.primaryEmail === user.primaryEmail)
    if (i > -1) this.users.splice(i, 1) 
  }

  updateUser(user) {
    let i = this.users.find((m) => m.primaryEmail === user.primaryEmail)
    this.users[i] = new User(user)
  }
}

class DirectoryError extends Error {
  constructor(message) {
    super(message)
    this.name = "DirectoryError"
  }
}

class UserAlreadyExistsError extends DirectoryError {
  constructor(message) {
    super(message)
    this.name = "UserAlreadyExistsError"
  }
}