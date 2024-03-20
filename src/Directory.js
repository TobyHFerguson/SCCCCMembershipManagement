class Directory {
  constructor() {
    this.members = [];
  }
  get members() {
    return this.members_.map((m) => new Exports.User(m))
  }
  set members(members) {
    this.members_ = members.map((m) => new Exports.User(m))
  }
  addUser(user) {
    this.members_.push(new Exports.User(user))
  }

  updateUser(user) {
    let i = this.members_.find((m) => m.primaryEmail === user.primaryEmail)
    this.members_[i] = new Exports.User(user)
  }
}