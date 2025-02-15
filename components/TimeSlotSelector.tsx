"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"

interface TimeSlotSelectorProps {
  selectedDates: string[]
  timeRange: { start: string; end: string }
  onSelectTimeSlots: (timeSlots: string[]) => void
}

export default function TimeSlotSelector({ selectedDates, timeRange, onSelectTimeSlots }: TimeSlotSelectorProps) {
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([])

  useEffect(() => {
    onSelectTimeSlots(selectedTimeSlots)
  }, [selectedTimeSlots, onSelectTimeSlots])

  const generateTimeSlots = useCallback(() => {
    const slots = []
    const [startHour, startMinute] = timeRange.start.split(":").map(Number)
    const [endHour, endMinute] = timeRange.end.split(":").map(Number)
    const start = startHour * 60 + startMinute
    const end = endHour * 60 + endMinute

    for (let time = start; time < end; time += 30) {
      const hour = Math.floor(time / 60)
      const minute = time % 60
      const endTime = time + 30
      const endHour = Math.floor(endTime / 60)
      const endMinute = endTime % 60
      slots.push(
        `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}-${endHour.toString().padStart(2, "0")}:${endMinute.toString().padStart(2, "0")}`,
      )
    }

    return slots
  }, [timeRange])

  const timeSlots = generateTimeSlots()

  const toggleTimeSlot = useCallback((date: string, time: string) => {
    const slotKey = `${date} ${time}`
    setSelectedTimeSlots((prev) =>
      prev.includes(slotKey) ? prev.filter((slot) => slot !== slotKey) : [...prev, slotKey],
    )
  }, [])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const days = ["日", "月", "火", "水", "木", "金", "土"]
    return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getDate().toString().padStart(2, "0")}(${days[date.getDay()]})`
  }

  // Sort selectedDates
  const sortedDates = [...selectedDates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">選択された日程：</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sortedDates.map((date) => (
          <div key={date} className="border rounded-md p-2">
            <h3 className="font-medium mb-2">{formatDate(date)}</h3>
            <div className="grid grid-cols-1 gap-2">
              {timeSlots.map((time) => (
                <Button
                  key={`${date}-${time}`}
                  variant={selectedTimeSlots.includes(`${formatDate(date)} ${time}`) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleTimeSlot(formatDate(date), time)}
                  className="select-none"
                >
                  {time}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

