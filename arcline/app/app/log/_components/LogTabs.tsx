'use client'

import { useState } from 'react'
import { ManualLogForm } from './ManualLogForm'
import { ScreenshotLogForm } from './ScreenshotLogForm'

const TABS = [
  { id: 'manual', label: 'Manual' },
  { id: 'screenshot', label: 'Screenshot' },
] as const

type TabId = (typeof TABS)[number]['id']

export function LogTabs() {
  const [activeTab, setActiveTab] = useState<TabId>('manual')

  return (
    <div>
      {/* Tab strip */}
      <div className="mb-6 flex gap-1 rounded-xl border border-white/10 bg-surface p-1">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition cursor-pointer ${
              activeTab === id
                ? 'bg-brand-teal text-background'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'manual' && <ManualLogForm />}
      {activeTab === 'screenshot' && <ScreenshotLogForm />}
    </div>
  )
}
