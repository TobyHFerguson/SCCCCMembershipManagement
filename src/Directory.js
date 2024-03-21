class Directory {
  constructor() {
    this.members = [];
  }
  get members() {
    return this.members_.map((m) => new User(m))
  }
  set members(members) {
    this.members_ = members.map((m) => new User(m))
  }
  addUser(user) {
    if (this.members_.some((m) => m.primaryEmail === user.primaryEmail)) throw new UserAlreadyExistsError
    this.members_.push(new User(user))
  }

  updateUser(user) {
    let i = this.members_.find((m) => m.primaryEmail === user.primaryEmail)
    this.members_[i] = new User(user)
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