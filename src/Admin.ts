import {AdminDirectoryType, UserType, UsersCollectionType} from './Types'
import {Member} from './Member'

/** Based on Admin SDK:  Directory API: https://developers.google.com/admin-sdk/directory/reference/rest */
class Users implements UsersCollectionType {
  #users: UserType[] = [];
  constructor(users?: Member[]) {
    if (users) users.forEach(u => this.#users.push(u))
  }
 
  get(primaryEmail:string) {
    const found = this.#users.find((u) => u.primaryEmail === primaryEmail)
    return found ? found : {}
  }
  insert(user:UserType) {
    if (!user.primaryEmail) throw new Error("No primary key")
    if (this.get(user.primaryEmail)) { throw new Error("API call to directory.users.insert failed with error: Entity already exists.") }
    const newUser = JSON.parse(JSON.stringify(user))
    this.#users.push(newUser)
    return newUser
  }
  list(optionaArgs:object) {
    const users: UserType[] = JSON.parse(JSON.stringify(this.#users))
    const result = { users }
    return result
  }
  remove(primaryEmail:string ) {
    let i = this.#users?.findIndex((u) => u.primaryEmail === primaryEmail);
    if (i === -1) throw new Error("Resource Not Found: userKey");
    this.#users?.splice(i, 1)
  }
  update(patch, primaryEmail) {
    let i = this.#users.findIndex((u) => u.primaryEmail === primaryEmail);
    if (i === -1) throw new Error("Resource Not Found: userKey");
    const oldUser = this.#users[i]
    const newUser = { ...oldUser, ...JSON.parse(patch) }
    this.#users.splice(i, 1, newUser)
    return JSON.parse(JSON.stringify(newUser))
  }
}

class Admin implements AdminDirectoryType {
  Users?:UsersCollectionType;
    constructor(users = new Users()) {
        this.Users = users
    }
}

export {Users, Admin}