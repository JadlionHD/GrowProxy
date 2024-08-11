/**
 * Character effect state (Like for example become a zombie)
 */
export enum State {
  canWalkInBlocks = 1 << 0,
  canDoubleJump = 1 << 1,
  isInvisible = 1 << 2,
  noHands = 1 << 3,
  noEyes = 1 << 4,
  noBody = 1 << 5,
  devilHorns = 1 << 6,
  goldenHalo = 1 << 7,
  isFrozen = 1 << 11,
  isCursed = 1 << 12,
  isDuctaped = 1 << 13,
  haveCigar = 1 << 14,
  isShining = 1 << 15,
  isZombie = 1 << 16,
  isHitByLava = 1 << 17,
  haveHauntedShadows = 1 << 18,
  haveGeigerRadiation = 1 << 19,
  haveReflector = 1 << 20,
  isEgged = 1 << 21,
  havePineappleFloag = 1 << 22,
  haveFlyingPineapple = 1 << 23,
  haveSuperSupporterName = 1 << 24,
  haveSuperPineapple = 1 << 25
}

/**
 * Event that happend when the character doing something
 */
export enum StateFlags {
  NONE = 0,
  UNK = 1 << 1,
  RESET_VISUAL_STATE = 1 << 2,
  EXTENDED = 1 << 3,
  ROTATE_LEFT = 1 << 4,
  ON_SOLID = 1 << 5,
  ON_FIRE_DAMAGE = 1 << 6,
  ON_JUMP = 1 << 7,
  ON_KILLED = 1 << 8,
  ON_PUNCHED = 1 << 9,
  ON_PLACED = 1 << 10,
  ON_TILE_ACTION = 1 << 11,
  ON_GOT_PUNCHED = 1 << 12,
  ON_RESPAWNED = 1 << 13,
  ON_COLLECT_OBJECT = 1 << 14,
  ON_TRAMPOLINE = 1 << 15,
  ON_DAMAGE = 1 << 16,
  ON_SLIDE = 1 << 17,
  ON_WALL_HANG = 1 << 21,
  ON_ACID_DAMAGE = 1 << 26
  // MAX = 31
}
