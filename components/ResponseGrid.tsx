"use client"

import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'

interface ResponseGridProps {
  timeSlots: string[]
  onResponseChange: (responses: Record<string, 'OK' | 'MAYBE' | 'NG'>) => void
}

export default function ResponseGrid({ timeSlots, onResponseChange }: ResponseGridProps) {
  const [responses, setResponses] = useState<Record<string, 'OK' | 'MAYBE' | 'NG'>>(() => {
    // 初期値として全ての時間枠に'OK'を設定
    return timeSlots.reduce((acc, timeSlot) => {
      acc[timeSlot] = 'OK'
      return acc
    }, {} as Record<string, 'OK' | 'MAYBE' | 'NG'>)
  })

  const handleResponse = (timeSlot: string, response: 'OK' | 'MAYBE' | 'NG') => {
    const newResponses = { ...responses, [timeSlot]: response }
    setResponses(newResponses)
    onResponseChange(newResponses)
  }

  const getResponseSymbol = (response: 'OK' | 'MAYBE' | 'NG' | undefined) => {
    switch (response) {
      case 'OK':
        return '○'
      case 'MAYBE':
        return '△'
      case 'NG':
        return '✕'
      default:
        return ''
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
    return `${year}/${month}/${day}(${dayOfWeek})`
  }

  const groupedTimeSlots = useMemo(() => {
    return timeSlots.reduce((acc, timeSlot) => {
      const [date, time] = timeSlot.split(' ')
      const formattedDate = formatDate(date)
      if (!acc[formattedDate]) {
        acc[formattedDate] = []
      }
      acc[formattedDate].push(time)
      return acc
    }, {} as Record<string, string[]>)
  }, [timeSlots, formatDate]) // Added formatDate to dependencies

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            <th className="border p-2">日時</th>
            <th className="border p-2">回答</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(groupedTimeSlots).map(([date, times], index) => (
            <React.Fragment key={date}>
              {index > 0 && (
                <tr>
                  <td colSpan={2} className="border-t-4 border-gray-400"></td>
                </tr>
              )}
              {times.map((time, timeIndex) => (
                <tr key={`${date}-${time}`}>
                  <td className="border p-2">
                    <div className="font-bold">{date}</div>
                    <div>{time}</div>
                  </td>
                  <td className="border p-2">
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant={responses[`${date} ${time}`] === 'OK' ? 'default' : 'outline'}
                        onClick={() => handleResponse(`${date} ${time}`, 'OK')}
                      >
                        {getResponseSymbol('OK')}
                      </Button>
                      <Button
                        size="sm"
                        variant={responses[`${date} ${time}`] === 'MAYBE' ? 'default' : 'outline'}
                        onClick={() => handleResponse(`${date} ${time}`, 'MAYBE')}
                      >
                        {getResponseSymbol('MAYBE')}
                      </Button>
                      <Button
                        size="sm"
                        variant={responses[`${date} ${time}`] === 'NG' ? 'default' : 'outline'}
                        onClick={() => handleResponse(`${date} ${time}`, 'NG')}
                      >
                        {getResponseSymbol('NG')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
