import type { CardInput } from './types'

type Sample = Pick<CardInput, 'word' | 'meaning' | 'synonyms' | 'example' | 'part_of_speech'>

export const SAMPLE_CARDS: Sample[] = [
  { word: 'abundant', part_of_speech: 'adjective', meaning: 'Existing in large quantities; more than enough.', synonyms: ['plentiful', 'ample', 'copious', 'profuse'], example: 'The region has abundant rainfall.' },
  { word: 'benevolent', part_of_speech: 'adjective', meaning: 'Kind, generous and wanting to do good for others.', synonyms: ['kind', 'charitable', 'generous', 'compassionate'], example: 'A benevolent neighbour fixed our fence for free.' },
  { word: 'candid', part_of_speech: 'adjective', meaning: 'Truthful and straightforward; frank.', synonyms: ['frank', 'honest', 'open', 'blunt'], example: 'She gave a candid answer about her mistakes.' },
  { word: 'diligent', part_of_speech: 'adjective', meaning: 'Showing care and steady effort in work or duties.', synonyms: ['hardworking', 'industrious', 'conscientious', 'careful'], example: 'He is a diligent student who never misses class.' },
  { word: 'eloquent', part_of_speech: 'adjective', meaning: 'Fluent and persuasive in speaking or writing.', synonyms: ['articulate', 'expressive', 'persuasive', 'fluent'], example: 'She made an eloquent speech at the ceremony.' },
  { word: 'frugal', part_of_speech: 'adjective', meaning: 'Careful to spend little money or use few resources.', synonyms: ['thrifty', 'economical', 'sparing', 'prudent'], example: 'They lived a frugal life to save for a house.' },
  { word: 'gregarious', part_of_speech: 'adjective', meaning: 'Fond of company; sociable.', synonyms: ['sociable', 'outgoing', 'friendly', 'convivial'], example: 'Gregarious people enjoy big parties.' },
  { word: 'meticulous', part_of_speech: 'adjective', meaning: 'Showing great attention to detail; very careful and precise.', synonyms: ['precise', 'thorough', 'scrupulous', 'painstaking'], example: 'He kept meticulous records of every expense.' },
  { word: 'resilient', part_of_speech: 'adjective', meaning: 'Able to recover quickly from difficulties.', synonyms: ['tough', 'hardy', 'adaptable', 'buoyant'], example: 'Children are often remarkably resilient.' },
  { word: 'tenacious', part_of_speech: 'adjective', meaning: 'Holding firmly to something; not giving up easily.', synonyms: ['persistent', 'determined', 'stubborn', 'dogged'], example: 'A tenacious reporter kept asking questions.' },
]
