import 'server-only'
import Anthropic from '@anthropic-ai/sdk'

const anthropicConfigured =
  process.env.ANTHROPIC_API_KEY &&
  !process.env.ANTHROPIC_API_KEY.startsWith('your-')

export async function generateCoachAdaptationMessage(
  reasoning: string,
  triggerType: string,
): Promise<string | null> {
  if (!anthropicConfigured) return null
  const trimmed = reasoning.trim()
  if (!trimmed) return null

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 220,
      system:
        'You are an Ironman/triathlon coach writing a brief chat message to your athlete after adjusting their plan. Tone: direct, warm, conversational — like you are texting them. Use second person. Never give medical advice. Keep what changed and why; drop technical jargon.',
      messages: [
        {
          role: 'user',
          content: `Take this technical adaptation reasoning and rewrite it as a 2-3 sentence chat message you'd send to your athlete.

Trigger: ${triggerType}
Reasoning: ${trimmed}

Reply with ONLY the message text. No quotes. No preamble. No greeting.`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    return text || null
  } catch {
    return null
  }
}
