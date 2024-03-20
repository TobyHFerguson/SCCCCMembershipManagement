class Directory {
  constructor() {
    this.members = [];
  }

  addUser(user) {
    this.members.push(user)
  }

  updateUser(user) {
    Logger.log('Directory.updateUser()')
  }
}