import { WordDataset, WordEntry } from '../types'
import wordsData from '../data/words.json'

const dataset: WordDataset = wordsData

export function getRandomWord(): WordEntry {
    const allWords = dataset.domains.flatMap(d => d.words)
    return allWords[Math.floor(Math.random() * allWords.length)]
}

export function getWordPair(): { primary: string; similar: string } {
    const entry = getRandomWord()
    const similar = entry.similar[Math.floor(Math.random() * entry.similar.length)]
    return { primary: entry.primary, similar }
}
