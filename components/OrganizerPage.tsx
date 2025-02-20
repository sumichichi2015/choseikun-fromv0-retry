"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import CalendarSelector from "./CalendarSelector"
import TimeSlotSelector from "./TimeSlotSelector"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { supabase } from "@/lib/supabase"

export default function OrganizerPage() {
  const [meetingTitle, setMeetingTitle] = useState("")
  const [meetingDescription, setMeetingDescription] = useState("")
  const [timeRange, setTimeRange] = useState({ start: "10:00", end: "15:00" })
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([])
  const router = useRouter()

  const handleCreateMeeting = async () => {
    if (!meetingTitle) {
      toast.error("会議名は必須です。")
      return
    }

    try {
      // 会議を作成
      const { data: meeting, error: meetingError } = await supabase
        .from("meetings")
        .insert({
          title: meetingTitle,
          description: meetingDescription,
          access_token: Math.random().toString(36).substr(2, 9)
        })
        .select()
        .single()

      if (meetingError) throw meetingError

      // 時間枠を作成
      const timeSlotPromises = selectedTimeSlots.map(timeSlot => {
        const [date, time] = timeSlot.split(" ")
        const [startHour] = time.split("-")
        
        // 日付から曜日を除去し、フォーマットを変換
        const formattedDate = date.split("(")[0].replace(/\//g, "-")
        const [year, month, day] = formattedDate.split("-")
        
        // 30分刻みの時間枠を作成
        const slots = []
        const baseHour = parseInt(startHour)
        
        // 各時間に対して0分と30分の枠を作成
        for (const minutes of [0, 30]) {
          // 日本時間で日付オブジェクトを作成
          const startDate = new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            baseHour,
            minutes,
            0
          )
          
          // 終了時刻は開始時刻から30分後
          const endDate = new Date(startDate.getTime() + 30 * 60 * 1000)
          
          // タイムゾーンオフセットを考慮（JSTはUTC+9）
          const jstOffset = 9 * 60 * 60 * 1000
          const utcStartTime = new Date(startDate.getTime() - jstOffset)
          const utcEndTime = new Date(endDate.getTime() - jstOffset)
          
          slots.push({
            meeting_id: meeting.id,
            start_time: utcStartTime.toISOString(),
            end_time: utcEndTime.toISOString()
          })
        }
        
        // 各時間枠をデータベースに挿入
        return Promise.all(slots.map(slot => 
          supabase
            .from("time_slots")
            .insert(slot)
            .select()
            .then(result => {
              if (result.error) {
                console.error("Error details:", {
                  error: result.error,
                  data: slot,
                  status: result.status,
                  statusText: result.statusText
                })
                throw result.error
              }
              return result
            })
        ))
      })

      const timeSlotResults = await Promise.all(timeSlotPromises)
      const timeSlotErrors = timeSlotResults.flat().filter(result => result.error)
      
      if (timeSlotErrors.length > 0) {
        console.error("Time slot errors:", timeSlotErrors)
        throw new Error("時間枠の作成に失敗しました。")
      }

      const participantUrl = `${window.location.origin}/participant/${meeting.id}`

      // Copy URL to clipboard
      navigator.clipboard.writeText(participantUrl).then(
        () => {
          toast.success("参加者ページのURLをコピーしました！")
        },
        () => {
          toast.error("URLのコピーに失敗しました。")
        }
      )

      // Navigate to participant page
      router.push(`/participant/${meeting.id}`)
    } catch (error) {
      console.error("Error creating meeting:", error)
      toast.error("会議の作成に失敗しました。")
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">会議を調整するやつ</h1>
      <div className="space-y-4">
        <div>
          <label htmlFor="meeting-title" className="block text-sm font-medium mb-1">
            会議名<span className="text-red-500 text-xs">*</span>
          </label>
          <Input
            id="meeting-title"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            placeholder="チームミーティング"
            required
          />
        </div>
        <div>
          <label htmlFor="meeting-description" className="block text-sm font-medium mb-1">
            説明（任意）
          </label>
          <Textarea
            id="meeting-description"
            value={meetingDescription}
            onChange={(e) => setMeetingDescription(e.target.value)}
            placeholder="週次進捗報告会"
            className="h-10 resize-none"
          />
        </div>
        <div className="flex space-x-4">
          <div>
            <label htmlFor="time-start" className="block text-sm font-medium mb-1">
              from
            </label>
            <Select value={timeRange.start} onValueChange={(value) => setTimeRange({ ...timeRange, start: value })}>
              <SelectTrigger id="time-start">
                <SelectValue placeholder="開始時間" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                  <SelectItem key={hour} value={`${hour.toString().padStart(2, "0")}:00`}>
                    {`${hour.toString().padStart(2, "0")}:00`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="time-end" className="block text-sm font-medium mb-1">
              to
            </label>
            <Select value={timeRange.end} onValueChange={(value) => setTimeRange({ ...timeRange, end: value })}>
              <SelectTrigger id="time-end">
                <SelectValue placeholder="終了時間" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                  <SelectItem key={hour} value={`${hour.toString().padStart(2, "0")}:00`}>
                    {`${hour.toString().padStart(2, "0")}:00`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <CalendarSelector onSelectDates={setSelectedDates} />
        <TimeSlotSelector
          selectedDates={selectedDates}
          timeRange={timeRange}
          onSelectTimeSlots={setSelectedTimeSlots}
        />
        <Button onClick={handleCreateMeeting}>参加者登録ページへ</Button>
      </div>
    </div>
  )
}
