import {Record} from 'immutable';

import jwt from 'jsonwebtoken';
import uuid from 'uuid';

export class UserModel extends Record({
  id: null
  , login: null
  , connectionId: null
  , token: null
}) {
  static new(login, connectionId) {
    return new UserModel({
      id: uuid.v4().slice(0, 4)
      , login, connectionId
    }).sign()
  }

  sign() {
    return this.set('token', jwt.sign(this, process.env.JWT_SECRET))
  };

  toOthers() {
    return new UserModel({
      id: this.id
      , login: this.login
      , connectionId: this.connectionId
    });
  }
}