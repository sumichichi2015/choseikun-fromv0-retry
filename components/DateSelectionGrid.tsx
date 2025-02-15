"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"

interface DateSelectionGridProps {
  dates: string[]
  participants: { name: string; responses: string[] }[]
  onResponseChange: (responses: string[]) => void
}

export default function DateSelectionGrid({ dates, participants, onResponseChange }: DateSelectionGridProps) {
  const [responses, setResponses] = useState<string[]>(new Array(dates.length).fill("○"))

  useEffect(() => {
    onResponseChange(responses)
  }, [responses, onResponseChange])

  const handleResponseClick = (index: number) => {
    setResponses((prev) => {
      const newResponses = [...prev]
      newResponses[index] = newResponses[index] === "○" ? "△" : newResponses[index] === "△" ? "×" : "○"
      return newResponses
    })
  }

  const getBackgroundColor = (allResponses: string[][]) => {
    const totalParticipants = allResponses.length
    const totalScore = allResponses.reduce((sum, participantResponses) => {
      return (
        sum +
        participantResponses.reduce((pSum, response) => {
          return pSum + (response === "○" ? 3 : response === "△" ? 1 : 0)
        }, 0)
      )
    }, 0)
    const maxScore = totalParticipants * 3
    const ratio = totalScore / maxScore

    const hasX = allResponses.some((pResponses) => pResponses.includes("×"))
    const xCount = allResponses.reduce((count, pResponses) => count + pResponses.filter((r) => r === "×").length, 0)

    if (ratio === 1) return "bg-blue-800" // #0000FF
    if (!hasX) return "bg-blue-600" // #4169E1
    if (ratio > 0.7) return "bg-blue-400" // #87CEFA
    if (ratio >= 0.4) return "bg-blue-300" // #87CEEB
    return "bg-blue-200" // Lighter blue for very low possibility
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            <th className="border p-2">日時</th>
            <th className="border p-2">あなた</th>
            {participants.map((participant, index) => (
              <th key={index} className="border p-2">
                {participant.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map((date, index) => {
            const allResponses = [responses, ...participants.map((p) => p.responses)]
            const bgColor = getBackgroundColor(allResponses.map((r) => [r[index]]))
            return (
              <tr key={index} className={bgColor}>
                <td className="border p-2">{date}</td>
                <td className="border p-2">
                  <Button onClick={() => handleResponseClick(index)} variant="outline" className="w-8 h-8 p-0">
                    {responses[index]}
                  </Button>
                </td>
                {participants.map((participant, pIndex) => (
                  <td key={pIndex} className="border p-2">
                    {participant.responses[index]}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

