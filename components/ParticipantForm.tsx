"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

interface ParticipantFormProps {
  onSubmit: (name: string, comment: string) => void
}

export default function ParticipantForm({ onSubmit }: ParticipantFormProps) {
  const [name, setName] = useState("")
  const [comment, setComment] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(name, comment)
    setName("")
    setComment("")
  }

  return (
    <form onSubmit={handleSubmit} className="mb-8">
      <h2 className="text-xl font-semibold mb-4">参加者登録</h2>
      <div className="mb-4">
        <label htmlFor="name" className="block mb-2">
          お名前:
        </label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="w-full" />
      </div>
      <div className="mb-4">
        <label htmlFor="comment" className="block mb-2">
          コメント:
        </label>
        <Textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} className="w-full" />
      </div>
      <Button type="submit">登録</Button>
    </form>
  )
}

