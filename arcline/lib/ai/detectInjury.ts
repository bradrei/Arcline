'use server'

import Anthropic from '@anthropic-ai/sdk'

import type { InjurySource } from '@/types'
export type { InjurySource } from '@/types'

export interface InjuryDetectionResult {
  injured: boolean
  triggerText: string
}

const anthropicConfigured =
  process.env.ANTHROPIC_API_KEY &&
  !process.env.ANTHROPIC_API_KEY.startsWith('your-')

export async function detectInjury(
  text: string,
  _source: InjurySource
): Promise<InjuryDetectionResult> {
  if (!text.trim()) return { injured: false, triggerText: '' }
  if (!anthropicConfigured) return { injured: false, triggerText: '' }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: `You are a safety classifier for a training app.
Determine if the following text indicates that the user has a physical injury,
pain, or condition that warrants medical attention before continuing training.

Positive examples (injured: true):
- "my knee is killing me"
- "I've been limping all week"
- "sharp pain in my shin"
- "can't put weight on my ankle"
- "my shoulder keeps clicking and it hurts"
- "my ITB has been flaring up on the run"
- "I felt a pop in my calf mid-ride"

Negative examples (injured: false):
- "that swim set absolutely destroyed me in the best way"
- "my legs are completely cooked after the long ride"
- "that run killed me but in a good way"
- "my lungs were burning on the bike"
- "the open water was brutal today"

Return JSON only, no other text:
{ "injured": true | false, "triggerText": "exact phrase that triggered this or empty string" }`,
      messages: [{ role: 'user', content: text }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsed = JSON.parse(raw) as InjuryDetectionResult
    return { injured: Boolean(parsed.injured), triggerText: parsed.triggerText ?? '' }
  } catch {
    // Safe default — never block the user on a classifier failure
    return { injured: false, triggerText: '' }
  }
}
