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

  const [isDragging, setIsDragging] = useState(false)
  const [dragStartSlot, setDragStartSlot] = useState<string | null>(null)
  const [mouseIsDown, setMouseIsDown] = useState(false)

  const handleMouseDown = useCallback((date: string, time: string, event: React.MouseEvent) => {
    event.preventDefault() // テキスト選択を防ぐ
    setMouseIsDown(true)
    setIsDragging(false)
    setDragStartSlot(`${date} ${time}`)
    toggleTimeSlot(date, time)
  }, [toggleTimeSlot])

  const handleMouseEnter = useCallback((date: string, time: string) => {
    if (mouseIsDown) {
      setIsDragging(true)
      toggleTimeSlot(date, time)
    }
  }, [mouseIsDown, toggleTimeSlot])

  const handleMouseUp = useCallback(() => {
    setMouseIsDown(false)
    setIsDragging(false)
    setDragStartSlot(null)
  }, [])

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setMouseIsDown(false)
      setIsDragging(false)
      setDragStartSlot(null)
    }

    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [])

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">時間帯選択</h2>
      <p className="text-sm text-gray-500 mb-2">※ドラッグで複数選択</p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        {sortedDates.map((date) => (
          <div key={date} className="border rounded-md p-1">
            <h3 className="font-medium mb-1 text-sm">{formatDate(date)}</h3>
            <div className="grid grid-cols-1 gap-1">
              {timeSlots.map((time) => (
                <Button
                  key={`${date}-${time}`}
                  variant={selectedTimeSlots.includes(`${formatDate(date)} ${time}`) ? "default" : "outline"}
                  size="sm"
                  onMouseDown={(e) => handleMouseDown(formatDate(date), time, e)}
                  onMouseEnter={() => handleMouseEnter(formatDate(date), time)}
                  onMouseUp={handleMouseUp}
                  className={`select-none text-base h-auto py-2 text-black ${
                    selectedTimeSlots.includes(`${formatDate(date)} ${time}`) ? "bg-blue-100 hover:bg-blue-200" : "hover:bg-gray-100"
                  }`}
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
