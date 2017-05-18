import {Record, List, Map} from 'immutable';
import {UserModel} from '../UserModel';
import {CardModel} from './CardModel';
import {AnimalModel} from './evolution/AnimalModel';

/**
 * @class PlayerModel
 * @property {string} id - an ID.
 */
export class PlayerModel extends Record({
  id: null
  , hand: List()
  , continent: List()
  , index: -1
  , playing: true // Has he active in the game
  , ended: false // Has he ended a phase
  , acted: false // Has he acted in a phase
  , timedOut: false // Has he ended his turn via timeout
  , wantsPause: false // Does he want a pause
  , scoreDead: 0
}) {
  getWantsPause() {
    return this.wantsPause || this.timedOut;
  }

  toOthers() {
    return this
      .update('hand', hand => hand.map((card) => card.toOthers()))
      .update('continent', continent => continent.map(animal => animal.toOthers()));
  }

  toClient() {
    return this
      .update('hand', hand => hand.map((card) => card.toClient()))
      .update('continent', continent => continent.map(animal => animal.toClient()));
  }

  static fromServer(js) {
    return js == null
      ? null
      : new PlayerModel(js)
      .set('hand', List(js.hand).map(card => CardModel.fromServer(card)))
      .set('continent', List(js.continent).map(animalModel => AnimalModel.fromServer(animalModel)));
  }

  static new(userId, index) {
    return new PlayerModel({id: userId, index})
  }

  countScore() {
    return this.continent.reduce((score, animal) => score + animal.countScore(), 0);
  }

  getCard(index) {
    return this.hand.get(index);
  }

  getAnimal(index) {
    return this.continent.get(index);
  }
}