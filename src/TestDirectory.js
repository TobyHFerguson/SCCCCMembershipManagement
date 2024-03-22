class TestDirectory extends Directory {
    constructor(userFactory) {
      super();
      this.userFactory = userFactory
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
      this.users.push(this.userFactory(user))
    }
    /**
     * Delete the given user
     * @param {User} user the user to be deleted
     */
    deleteUser(user) {
      const i = this.findUser_(user);
      if (i > -1) this.users.splice(i, 1);
      return this;
    }

    updateUser(user) {
      const i = this.findUser_(user);
      if (i > -1) {
        this.users.splice(i, 1, this.userFactory(user))
        return this;
      } else {
        throw new UserNotFoundError(`Directory: Attempt to update uknown user ${user.primaryEmail}`);
      }
    }
    getUser(user) {
      const i = this.findUser_(user);
      if (i > -1) return this.users[i]
      throw new UserNotFoundError(`No such user: ${user.primaryEmail}`)
    }
    findUser_(user) {
      return this.users.findIndex((u) => u.primaryEmail === user.primaryEmail);
    }
  }