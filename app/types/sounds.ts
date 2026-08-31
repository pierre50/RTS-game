export type CommandSound = string | number | (string | number)[] | null | undefined

export interface UnitSounds {
  command?: CommandSound
  buildCommand?: CommandSound
  huntCommand?: CommandSound
  move?: CommandSound
  work?: Record<string, CommandSound>
  heal?: CommandSound
  convert?: CommandSound
  attack?: CommandSound
  hit?: CommandSound
  die?: CommandSound
  fall?: CommandSound
}
