'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useArclineStore } from '@/store/arclineStore'
import type { CoachMessage } from '@/types'

interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  pending?: boolean
}

interface CoachChatProps {
  initialMessages: CoachMessage[]
  planReady: boolean
  athleteFirstName: string
  initialPrefill?: string
  quickActions?: string[]
}

const EMPTY_STATE_MESSAGE = (name: string) =>
  `Hey${name ? ` ${name}` : ''}. I've got your plan and your recent sessions. Ask me anything — about your training, your goal, or what to expect this week.`

export function CoachChat({
  initialMessages,
  planReady,
  athleteFirstName,
  initialPrefill = '',
  quickActions = [],
}: CoachChatProps) {
  const setInjuryFlagged = useArclineStore(s => s.setInjuryFlagged)

  const [messages, setMessages] = useState<DisplayMessage[]>(() =>
    initialMessages.filter(m => !m.injury_flagged).map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
    })),
  )
  const [input, setInput] = useState(initialPrefill)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const queueRef = useRef<string[]>([])

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  // Auto-grow textarea (max 5 lines)
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
  }, [input])

  const sendMessage = useCallback(
    async (text: string) => {
      setStreaming(true)
      setError(null)

      const userId = `local-user-${Date.now()}`
      const assistantId = `local-assistant-${Date.now()}`
      setMessages(prev => [
        ...prev,
        { id: userId, role: 'user', content: text },
        { id: assistantId, role: 'assistant', content: '', pending: true },
      ])

      try {
        const res = await fetch('/api/coach/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        })

        const contentType = res.headers.get('content-type') ?? ''

        if (contentType.includes('application/json')) {
          const data = (await res.json()) as {
            type: 'injury' | 'rate_limit' | 'error'
            message?: string
            triggerText?: string
          }

          if (data.type === 'injury') {
            setInjuryFlagged(true, data.triggerText ?? text, 'chat')
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantId
                  ? { ...m, content: data.message ?? '', pending: false }
                  : m,
              ),
            )
          } else if (data.type === 'rate_limit') {
            setMessages(prev => prev.filter(m => m.id !== assistantId))
            setError(data.message ?? 'Slow down a bit.')
          } else {
            setMessages(prev => prev.filter(m => m.id !== assistantId))
            setError(data.message ?? 'Something went wrong.')
          }
          return
        }

        if (!res.body) {
          throw new Error('No response stream.')
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let acc = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          acc += decoder.decode(value, { stream: true })
          setMessages(prev =>
            prev.map(m => (m.id === assistantId ? { ...m, content: acc } : m)),
          )
        }
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, content: acc.trim(), pending: false }
              : m,
          ),
        )
      } catch {
        setMessages(prev => prev.filter(m => m.id !== assistantId))
        setError('Connection lost. Try again.')
      } finally {
        setStreaming(false)
      }
    },
    [setInjuryFlagged],
  )

  // Drain queue after streaming finishes
  useEffect(() => {
    if (streaming) return
    if (queueRef.current.length === 0) return
    const next = queueRef.current.shift()!
    sendMessage(next)
  }, [streaming, sendMessage])

  function handleSubmit() {
    const text = input.trim()
    if (!text || !planReady) return
    setInput('')
    if (streaming) {
      queueRef.current.push(text)
      return
    }
    sendMessage(text)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleChipClick(text: string) {
    setInput(text)
    textareaRef.current?.focus()
    const len = text.length
    requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(len, len)
    })
  }

  // Focus textarea + place cursor at end if we mounted with prefill
  useEffect(() => {
    if (!initialPrefill) return
    const ta = textareaRef.current
    if (!ta) return
    ta.focus()
    const len = initialPrefill.length
    ta.setSelectionRange(len, len)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showEmptyState = messages.length === 0
  const showChips =
    planReady &&
    quickActions.length > 0 &&
    !streaming &&
    input.trim().length === 0

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-white/5 px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-foreground">Coach</h1>
          <p className="text-xs text-foreground-muted">
            {planReady
              ? 'Your AI coach has full context of your plan and recent sessions.'
              : 'Coach unlocks once your plan is ready.'}
          </p>
        </div>
        <Link
          href="/app/coach/history"
          className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-foreground-muted transition hover:border-white/20 hover:text-foreground"
        >
          History
        </Link>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
          {showEmptyState && planReady && (
            <CoachBubble
              showAvatar
              content={EMPTY_STATE_MESSAGE(athleteFirstName)}
            />
          )}

          {!planReady && (
            <CoachBubble
              showAvatar
              content="I'll be ready to chat once your plan is built. Hang tight."
            />
          )}

          {messages.map((m, i) => {
            const prev = messages[i - 1]
            const isFirstInGroup = !prev || prev.role !== m.role
            return m.role === 'user' ? (
              <UserBubble key={m.id} content={m.content} />
            ) : (
              <CoachBubble
                key={m.id}
                showAvatar={isFirstInGroup}
                content={m.content}
                streaming={m.pending && m.content.length === 0}
              />
            )
          })}

          {error && (
            <div className="mr-auto flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-2.5">
              <span className="text-sm text-red-300">{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-xs font-medium text-red-300 underline"
              >
                Dismiss
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t border-white/10 bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-2">
          {showChips && (
            <div className="flex flex-wrap gap-1.5">
              {quickActions.map(chip => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleChipClick(chip)}
                  className="rounded-full border border-white/10 bg-surface px-3 py-1.5 text-xs text-foreground-muted transition hover:border-brand-teal/30 hover:bg-brand-teal/5 hover:text-brand-teal"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-surface px-3 py-2">
            <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!planReady}
            rows={1}
            placeholder={planReady ? 'Ask your coach…' : 'Plan loading…'}
            className="min-h-[24px] flex-1 resize-none bg-transparent text-sm leading-6 text-foreground outline-none placeholder:text-foreground-muted disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!input.trim() || !planReady}
            aria-label="Send"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-teal text-background transition-colors hover:bg-brand-teal-dim disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-foreground-muted"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l14 0" />
              <path d="M13 18l6 -6" />
              <path d="M13 6l6 6" />
            </svg>
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md border border-brand-teal/30 bg-brand-teal/10 px-4 py-2.5 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
      {content}
    </div>
  )
}

function CoachBubble({
  content,
  showAvatar,
  streaming,
}: {
  content: string
  showAvatar?: boolean
  streaming?: boolean
}) {
  return (
    <div className="mr-auto flex max-w-[85%] items-start gap-2">
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-teal/15 text-[10px] font-bold tracking-tight text-brand-teal ${
          showAvatar ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden={!showAvatar}
      >
        AC
      </div>
      <div className="rounded-2xl rounded-bl-md bg-surface px-4 py-2.5 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
        {streaming ? <ThinkingDots /> : content}
      </div>
    </div>
  )
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className="block h-1.5 w-1.5 rounded-full bg-foreground-muted"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </span>
  )
}
