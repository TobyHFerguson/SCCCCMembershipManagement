class Directory {
  get members() { }
  set members(members) { }
  addUser(user) { }
  /**
   * Delete the given user
   * @param {User} user the user to be deleted
   */
  deleteUser(user) { }

  updateUser(user) { }
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