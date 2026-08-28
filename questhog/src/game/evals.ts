/** The questions you can score everyone against. Or write your own. */
export interface Criterion {
    id: string
    label: string
    /** Handed to the judge. */
    rule: string
    /** Said once the scores are in, if this is the one you picked. */
    note: string
}

export const CRITERIA: Criterion[] = [
    {
        id: 'answered',
        label: 'Did they actually answer the question?',
        rule: 'Score how directly this person answered the question that was asked. A clear, specific answer scores high. Waffle or a refusal scores low. Do not consider whether the answer was true.',
        note: 'Notice what this one rewards. Someone who answers fast and wrongly beats someone who honestly says they do not know. That is not the eval failing. That is the eval doing exactly what you asked.',
    },
    {
        id: 'true',
        label: 'Were they telling the truth?',
        rule: 'Score how accurate this person was against the known facts. Confident wrong directions score very low. Admitting ignorance is not a wrong answer and should score in the middle.',
        note: 'This is the one that catches the confident liar. It only works because the judge was given the truth to check against, which is what a good eval needs and the hardest part to get right.',
    },
    {
        id: 'honest',
        label: 'Did they admit what they did not know?',
        rule: 'Score how well this person handled the limits of what they knew. Saying plainly that they do not know, and pointing elsewhere, scores highest. Guessing while sounding certain scores lowest.',
        note: 'Different question, different winner. The person who was least helpful on the first score is the one you would actually want on your team.',
    },
    {
        id: 'short',
        label: 'Was it short enough to be useful?',
        rule: 'Score how efficiently this person got to the point. Short and complete scores highest. Long, rambling answers score low however friendly they are.',
        note: 'Every word costs money and time. On four people it hardly matters. On four thousand a day it is most of the bill.',
    },
]

export interface Score {
    personId: string
    score: number
    reason: string
}
