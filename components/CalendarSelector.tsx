"use client"

import { useState, useCallback, useEffect } from "react"

interface CalendarSelectorProps {
  onSelectDates: (dates: string[]) => void
}

const daysOfWeek = ["日", "月", "火", "水", "木", "金", "土"]

export default function CalendarSelector({ onSelectDates }: CalendarSelectorProps) {
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const handleDateSelect = useCallback((date: Date) => {
    const dateString = date.toISOString().split("T")[0]
    setSelectedDates((prev) => {
      const newDates = prev.some((d) => d.toISOString().split("T")[0] === dateString)
        ? prev.filter((d) => d.toISOString().split("T")[0] !== dateString)
        : [...prev, new Date(date.getFullYear(), date.getMonth(), date.getDate())]
      return newDates
    })
  }, [])

  useEffect(() => {
    const formatDate = (date: Date) => {
      const days = ["日", "月", "火", "水", "木", "金", "土"]
      return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getDate().toString().padStart(2, "0")}(${days[date.getDay()]})`
    }
    onSelectDates(selectedDates.map(formatDate))
  }, [selectedDates, onSelectDates])

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const generateCalendarDays = (year: number, month: number) => {
    const daysInMonth = getDaysInMonth(year, month)
    const firstDayOfMonth = new Date(year, month, 1).getDay()

    const calendarDays = []
    for (let i = 0; i < firstDayOfMonth; i++) {
      calendarDays.push(null)
    }
    for (let day = 1; day <= daysInMonth; day++) {
      calendarDays.push(new Date(year, month, day))
    }
    return calendarDays
  }

  const changeMonth = (increment: number) => {
    setCurrentMonth((prevMonth) => {
      const newMonth = new Date(prevMonth)
      newMonth.setMonth(newMonth.getMonth() + increment)
      return newMonth
    })
  }

  const renderMonth = (month: Date) => {
    const year = month.getFullYear()
    const monthIndex = month.getMonth()
    const calendarDays = generateCalendarDays(year, monthIndex)

    return (
      <div className="rounded-md border p-4">
        <div className="text-center mb-4">
          <span>
            {year}年 {monthIndex + 1}月
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {daysOfWeek.map((day) => (
            <div key={day} className="text-center font-bold">
              {day}
            </div>
          ))}
          {calendarDays.map((date, index) => (
            <div
              key={index}
              className={`text-center p-2 ${date ? "cursor-pointer hover:bg-gray-100" : ""} ${
                selectedDates.some((d) => d.toDateString() === date?.toDateString()) ? "bg-blue-100" : ""
              }`}
              onClick={() => date && handleDateSelect(date)}
            >
              {date && date.getDate()}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const nextMonth = new Date(currentMonth)
  nextMonth.setMonth(nextMonth.getMonth() + 1)

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">日程選択</h2>
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => changeMonth(-1)}>&lt;</button>
        <button onClick={() => changeMonth(1)}>&gt;</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderMonth(currentMonth)}
        {renderMonth(nextMonth)}
      </div>
    </div>
  )
}

