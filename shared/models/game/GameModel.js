import {Record, Map, OrderedMap, Range, List} from 'immutable';

import {PlayerModel} from './PlayerModel';
import {CardModel} from './CardModel';
import {TraitModel} from './evolution/TraitModel';
import {CooldownList} from './CooldownList';
import {SettingsRecord, Deck_Base, Deck_TimeToFly, Deck_ContinentsShort} from './GameSettings';

import uuid from 'uuid';
import {ensureParameter} from '../../utils';
import {getRandom} from '../../utils/randomGenerator';

import {parseFromRoom, parseCardList, parseAnimalList} from './GameModel.parse';

import * as tt from './evolution/traitTypes';

export const TEST_DECK_SIZE = 84;
export const TEST_HAND_SIZE = 6;

export const PHASE = {
  PREPARE: 'PREPARE'
  , DEPLOY: 'DEPLOY'
  , FEEDING: 'FEEDING'
  , AMBUSH: 'AMBUSH'
  , EXTINCTION: 'EXTINCTION'
  , REGENERATION: 'REGENERATION'
  , FINAL: 'FINAL'
};

export const StatusRecord = Record({
  turn: 0
  , round: 0
  , currentPlayer: 0
  , roundPlayer: 0
  , phase: PHASE.PREPARE
  , turnStartTime: null
  , turnDuration: null
  , paused: false
});

export class QuestionRecord extends Record({
  id: null
  , userId: null
  , type: null
  , time: null
  , sourcePid: null
  , sourceAid: null
  , traitId: null
  , targetPid: null
  , targetAid: null
  , turnRemainingTime: null
  , defaultAction: null
}) {
  static new(type, userId, sourceAnimal, traitId, targetAnimal, turnRemainingTime, defaultAction) {
    return new QuestionRecord({
      id: uuid.v4()
      , type
      , userId
      , sourcePid: sourceAnimal.ownerId
      , sourceAid: sourceAnimal.id
      , traitId
      , targetPid: targetAnimal.ownerId
      , targetAid: targetAnimal.id
      , time: Date.now()
      , turnRemainingTime
      , defaultAction
    });
  }

  static DEFENSE = 'DEFENSE';
  static INTELLECT = 'INTELLECT';

  static fromJS(js) {
    return js == null ? null : new QuestionRecord(js);
  }

  toOthers() {
    return this.set('id', null);
  }

  toClient() {
    return this.set('defaultAction', null);
  }
}

export class AmbushRecord extends Record({
  animalId: null
  , animalOwnerId: null
  , ambushers: null
  , turnRemainingTime: null
}) {
  static new(animal, ambushers, turnRemainingTime) {
    return new AmbushRecord({
      animalId: animal.id
      , animalOwnerId: animal.ownerId
      , ambushers: ambushers.reduce((result, animalId) => result.set(animalId, null), OrderedMap())
      , turnRemainingTime
    })
  }

  static fromServer(js) {
    // if (js) console.log('js.ambushers', js.ambushers)
    return (!js ? null
      : new AmbushRecord({
        ...js
        , ambushers: OrderedMap(js.ambushers)
      }));
  }
}

export class ContinentRecord extends Record({
  id: null
  , shells: Map()
  , food: Map()
}) {
  static fromJS(js) {
    return js == null
      ? null
      : new ContinentRecord({
        ...js
        , shells: Map(js.shells).map(shell => TraitModel.fromServer(shell))
      });
  }
}

const ContinentsStandard = Map({standard: new ContinentRecord({id: 'standard'})});
const ContinentsAddon = Map({});

const rollDice = () => getRandom(1, 6);

const FOOD_TABLE = [
// chosen by fair dice roll
// guaranteed to be random
  () => 10
  , () => 10
  , () => rollDice() + 2
  , () => rollDice() + rollDice()
  , () => rollDice() + rollDice() + 2
  , () => rollDice() + rollDice() + rollDice() + 2
  , () => rollDice() + rollDice() + rollDice() + 4
  , () => rollDice() + rollDice() + rollDice() + rollDice() + 2
  , () => rollDice() + rollDice() + rollDice() + rollDice() + 4
];

const GameModelData = {
  id: null
  , roomId: null
  , deck: null
  , players: OrderedMap()
  , continents: ContinentsStandard
  , observers: List()
  , log: List()
  , food: -1
  , status: new StatusRecord()
  , cooldowns: CooldownList.new()
  , question: null
  , settings: null
  , scoreboardFinal: null
  , winnerId: null
  , ambush: null
};

// global.locateAnimalTime = 0;

export class GameModel extends Record({
  ...GameModelData
  , huntingCallbacks: List()
}) {
  static generateDeck(config, shuffle) {
    const result = config.reduce((result, [count, type]) => result
      .concat(Array.from({length: count})
        .map(u => CardModel.new(type))), []);
    return List(shuffle ? doShuffle(result) : result);
  }

  generateFood() {
    let aedificatorFood = 0;
    this.forEachAnimal((animal, continent, player) => {
      if (animal.hasTrait(tt.TraitAedificator)) aedificatorFood += 2;
    });
    return FOOD_TABLE[this.getActualPlayers().size]() + aedificatorFood;
  }

  static new(room) {
    let deck = Deck_Base;
    if (room.settings.addon_timeToFly) deck = deck.concat(Deck_TimeToFly);
    if (room.settings.addon_continents) deck = deck.concat(Deck_ContinentsShort);

    if (room.settings.halfDeck) deck = deck.map(([count, type]) => [count / 2, type]);
    return new GameModel({
      id: uuid.v4()
      , roomId: room.id
      , deck: GameModel.generateDeck(deck, true)
      , players: room.users.reduce((result, userId, index) => result.set(userId, PlayerModel.new(userId, index)), Map())
      , settings: room.settings
    })
  }

  static fromServer(js) {
    return js == null
      ? null
      : new GameModel({
        ...js
        , deck: List(js.deck).map(c => CardModel.fromServer(c))
        , players: OrderedMap(js.players).map(PlayerModel.fromServer).sort((p1, p2) => p1.index > p2.index)
        , continents: Map(js.continents).map(ContinentRecord.fromJS)
        , status: new StatusRecord(js.status)
        , question: QuestionRecord.fromJS(js.question)
        , cooldowns: CooldownList.fromServer(js.cooldowns)
        , settings: SettingsRecord.fromJS(js.settings)
        , log: List(js.log)
        , huntingCallbacks: List()
        , ambush: AmbushRecord.fromServer(js.ambush)
      });
  }

  toOthers(userId) {
    return this
      .set('deck', this.deck.map(card => card.toOthers()))
      .set('players', this.players.map(player => player.id === userId ? player : player.toOthers()))
  }

  toClient() {
    // TODO question
    return this
      .set('deck', this.deck.map(card => card.toClient()))
      .set('players', this.players.map(player => player.toClient()))
      .remove('huntingCallbacks')
  }

  getActualPlayers() {
    return this.players.filter(p => p.playing);
  }

  getPlayer(pid) {
    return pid.id
      ? this.players.get(pid.id)
      : this.players.get(pid);
  }

  getContinent() {
    return this.continents.get('standard');
  }

  // TODO remove
  getPlayerCard(pid, index) {
    return this.getPlayer(pid).hand.get(index);
  }

  /**
   * This callback is displayed as a global member.
   * @callback GamePerAnimalCallback
   * @param {AnimalModel} animal
   * @param {Continent} continent
   * @param {PlayerModel} player
   */

  /**
   * @param {GamePerAnimalCallback} cb
   */
  forEachAnimal(cb) {
    return this.get('players').some(player => player.forEachAnimal((a, c) => cb(a, c, player)));
  }

  locateAnimal(animalId, playerId = null) {
    if (!playerId) playerId = this.players.findKey(player => player.continent.has(animalId));
    return this.getIn(['players', playerId, 'continent', animalId], null);
  }

  locateTrait(traitId, animalId, playerId = null) {
    const animal = this.locateAnimal(animalId, playerId);
    return animal ? animal.traits.get(traitId) : null;
  }

  locateCard(cardId) {
    let playerId = null, cardIndex = -1;
    this.players.some(player => {
      cardIndex = player.hand.findIndex(card => card.id === cardId);
      if (~cardIndex) {
        playerId = player.id;
        return true;
      }
    });
    const card = playerId !== null ? this.getPlayer(playerId).getCard(cardIndex) : null;
    return {playerId, cardIndex, card};
  }

  static sortPlayersFromIndex(game, index) {
    if (index === void 0) index = game.status.roundPlayer;
    const playersList = game.players.toList();
    return playersList.slice(index).concat(playersList.slice(0, index));
  }

  static sortActualPlayersFromIndex(game, index) {
    if (index === void 0) index = game.status.roundPlayer;
    const playersList = game.players.toList().filter(p => p.playing);
    return playersList.slice(index).concat(playersList.slice(0, index));
  }
}

export class GameModelClient extends Record({
  ...GameModelData
  , userId: null
}) {
  static fromServer(js, userId) {
    const game = GameModel.fromServer(js);
    return game == null
      ? null
      : new GameModelClient(game)
        .set('userId', userId);
  }

  getPlayer(pid) {
    return pid === void 0 || pid === null
      ? (this.players.get(this.userId))
      : pid.id
        ? (this.players.get(pid.id))
        : (this.players.get(pid));
  }

  isPlayerTurn(userId) {
    return !!((userId || this.userId) && this.getPlayer(userId) && this.getPlayer(userId).index === this.status.currentPlayer
    && (this.status.phase === PHASE.DEPLOY || this.status.phase === PHASE.FEEDING));
  }
}

GameModel.parse = parseFromRoom;
GameModel.parseCardList = parseCardList;
GameModel.parseAnimalList = parseAnimalList;
GameModelClient.prototype.end = GameModel.prototype.end;
GameModelClient.prototype.getActualPlayers = GameModel.prototype.getActualPlayers;
GameModelClient.prototype.getPlayerCard = GameModel.prototype.getPlayerCard;
GameModelClient.prototype.locateAnimal = GameModel.prototype.locateAnimal;
GameModelClient.prototype.locateTrait = GameModel.prototype.locateTrait;
GameModelClient.prototype.locateCard = GameModel.prototype.locateCard;

// TODO move to utils
function doShuffle(array) {
  let counter = array.length;

  // While there are elements in the array
  while (counter > 0) {
    // Pick a random index
    let index = Math.floor(Math.random() * counter);

    // Decrease counter by 1
    counter--;

    // And swap the last element with it
    let temp = array[counter];
    array[counter] = array[index];
    array[index] = temp;
  }

  return array;
}