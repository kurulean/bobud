const BANNED_WORDS = [
  'fuck', 'shit', 'cunt', 'bitch', 'asshole', 'dick', 'pussy',
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded',
  'chink', 'spic', 'kike', 'tranny', 'whore', 'slut',
]

const LEET_MAP: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's',
}

function normalize(input: string): string {
  const lowered = input.toLowerCase()
  const unleeted = lowered.replace(/[014357@$]/g, ch => LEET_MAP[ch] ?? ch)
  return unleeted.replace(/[^a-z]/g, '')
}

export function containsProfanity(input: string): boolean {
  if (!input) return false
  const haystack = normalize(input)
  if (!haystack) return false
  return BANNED_WORDS.some(word => haystack.includes(word))
}

export function assertClean(input: string, kind: string): string | null {
  if (containsProfanity(input)) {
    return `Your ${kind} contains language we don't allow. Please revise it.`
  }
  return null
}
