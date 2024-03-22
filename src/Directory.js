class Directory {
  get members() { throw new Error('You should subclass the Directory class') }
  set members(members) { throw new Error('You should subclass the Directory class') }
  addUser(user) { throw new Error('You should subclass the Directory class') }
  /**
   * Delete the given user
   * @param {User} user the user to be deleted
   */
  deleteUser(user) { throw new Error('You should subclass the Directory class') }

  updateUser(user) { throw new Error('You should subclass the Directory class') }

  isKnownUser(user) {
    return this.members.some((m) => m.primaryEmail === user.primaryEmail)
  }

  getUser(user) { throw new Error('You should subclass the Directory class') }
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

class UserNotFoundError extends DirectoryError {
  constructor(message) {
    super(message);
    this.name = "UserNotFoundError"
  }
}

class UserCreationNotCompletedError extends DirectoryError {
  constructor(message) {
    super(message);
    this.name = "UserConstructionNotCompletedError"
  }
}