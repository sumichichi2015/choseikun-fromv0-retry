"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"
import { toast } from "@/lib/toast"

interface ParticipantPageProps {
  meetingId: string
}

interface MeetingData {
  title: string
  description: string
  timeRanges: TimeRange[]
}

interface TimeRange {
  id: string
  displayTime: string
  key: string
  start_time: string
  end_time: string
}

interface TimeSlot {
  id: string
  start_time: string
  end_time: string
}

interface ParticipantResponse {
  time_slot_id: string
  availability: number
}

interface Participant {
  id: string
  name: string
  comment?: string
  responses: ParticipantResponse[]
}

const initialMeetingData: MeetingData = {
  title: "",
  description: "",
  timeRanges: []
}

export default function ParticipantPage({ meetingId }: ParticipantPageProps) {
  const [meetingData, setMeetingData] = useState<MeetingData>(initialMeetingData)
  const [name, setName] = useState("")
  const [comment, setComment] = useState("")
  const [responses, setResponses] = useState<Record<string, "OK" | "MAYBE" | "NG">>({})
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [participantResponses, setParticipantResponses] = useState<Record<string, Record<string, number>>>({})

  // 時間枠の色を計算する関数をメモ化
  const calculateTimeSlotColor = useCallback((timeSlot: string, participants: Participant[], responses: Record<string, Record<string, number>>) => {
    if (!participants.length) return "bg-white border-2 border-gray-200"

    const slotResponses = participants.map(p => responses[p.id]?.[timeSlot] || 0)
    const total = slotResponses.reduce((sum, r) => sum + r, 0)
    const average = total / participants.length

    if (average >= 2.5) return "bg-blue-400 border-2 border-blue-600"      // 濃い青（参加可能が多い）
    if (average >= 1.5) return "bg-blue-100 border-2 border-blue-300"      // 薄い青（やや参加可能）
    if (average >= 0.5) return "bg-orange-100 border-2 border-orange-300"  // 薄オレンジ（やや難しい）
    return "bg-pink-100 border-2 border-pink-300"                          // 薄ピンク（参加困難）
  }, [])

  // コメント文字数制限を追加
  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newComment = e.target.value
    if (newComment.length <= 40) {
      setComment(newComment)
    }
  }

  // ソートされた時間枠をメモ化
  const sortedTimeRanges = useMemo(() => {
    if (!meetingData?.timeRanges) return []
    
    // 重複を除去して並び替え（クライアント側での重複除去）
    const uniqueRanges = Array.from(new Map(
      meetingData.timeRanges.map(range => [
        `${range.start_time}-${range.end_time}`,
        range
      ])
    ).values())

    return uniqueRanges.sort((a, b) => {
      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    })
  }, [meetingData?.timeRanges])

  // 時間枠の色をメモ化
  const timeSlotColors = useMemo(() => {
    const colors: Record<string, string> = {}
    sortedTimeRanges.forEach(range => {
      colors[range.key] = calculateTimeSlotColor(range.key, participants, participantResponses)
    })
    return colors
  }, [sortedTimeRanges, participants, participantResponses, calculateTimeSlotColor])

  useEffect(() => {
    const fetchMeetingData = async () => {
      try {
        setLoading(true)
        // 会議情報を取得
        const { data: meeting, error: meetingError } = await supabase
          .from("meetings")
          .select("*")
          .eq("id", meetingId)
          .single()

        if (meetingError) throw meetingError

        // 時間枠を取得
        const { data: slots, error: slotsError } = await supabase
          .from("time_slots")
          .select("id, start_time, end_time")
          .eq("meeting_id", meetingId)
          .order("start_time")

        if (slotsError) throw slotsError

        // 参加者と回答を取得
        const { data: parts, error: partsError } = await supabase
          .from("participants")
          .select(`
            id,
            name,
            comment,
            responses (
              time_slot_id,
              availability
            )
          `)
          .eq("meeting_id", meetingId)
          .order("created_at", { ascending: false })

        if (partsError) throw partsError

        // 時間枠を30分単位で整形
        const formattedTimeRanges = slots.map(slot => {
          // UTCからJSTに変換
          const jstOffset = 9 * 60 * 60 * 1000
          const startTime = new Date(new Date(slot.start_time).getTime() + jstOffset)
          const endTime = new Date(new Date(slot.end_time).getTime() + jstOffset)

          const date = startTime.toISOString().split("T")[0]
          const startHour = startTime.getHours().toString().padStart(2, "0")
          const startMinutes = startTime.getMinutes().toString().padStart(2, "0")
          const endHour = endTime.getHours().toString().padStart(2, "0")
          const endMinutes = endTime.getMinutes().toString().padStart(2, "0")

          return {
            id: slot.id,
            displayTime: `${startHour}:${startMinutes}-${endHour}:${endMinutes}`,
            key: `${date} ${startHour}:${startMinutes}-${endHour}:${endMinutes}`,
            start_time: slot.start_time,
            end_time: slot.end_time
          }
        })

        setMeetingData({
          title: meeting.title,
          description: meeting.description || "",
          timeRanges: formattedTimeRanges
        })

        // 初期レスポンスの設定
        const initialResponses: Record<string, "OK" | "MAYBE" | "NG"> = {}
        formattedTimeRanges.forEach(range => {
          initialResponses[range.key] = "OK"
        })
        setResponses(initialResponses)

        setTimeSlots(slots)
        setParticipants(parts)

        // 参加者の回答を整理
        const responses: Record<string, Record<string, number>> = {}
        parts.forEach((participant: any) => {
          responses[participant.id] = {}
          participant.responses.forEach((response: any) => {
            const slot = slots.find(s => s.id === response.time_slot_id)
            if (slot) {
              const startTime = new Date(slot.start_time)
              const endTime = new Date(slot.end_time)

              const jstOffset = 9 * 60 * 60 * 1000
              const jstStartTime = new Date(startTime.getTime() + jstOffset)
              const jstEndTime = new Date(endTime.getTime() + jstOffset)

              const date = jstStartTime.toISOString().split("T")[0]
              const startHour = jstStartTime.getHours().toString().padStart(2, "0")
              const startMinutes = jstStartTime.getMinutes().toString().padStart(2, "0")
              const endHour = jstEndTime.getHours().toString().padStart(2, "0")
              const endMinutes = jstEndTime.getMinutes().toString().padStart(2, "0")

              responses[participant.id][`${date} ${startHour}:${startMinutes}-${endHour}:${endMinutes}`] = response.availability
            }
          })
        })
        setParticipantResponses(responses)
      } catch (error) {
        console.error("Error fetching meeting data:", error)
        toast.error("会議情報の取得に失敗しました。")
      } finally {
        setLoading(false)
      }
    }

    fetchMeetingData()
  }, [meetingId])

  const handleSubmit = async () => {
    if (!name) {
      toast.error("名前は必須です。")
      return
    }

    try {
      // 参加者を登録
      const { data: participant, error: participantError } = await supabase
        .from("participants")
        .insert({
          meeting_id: meetingId,
          name,
          comment
        })
        .select()
        .single()

      if (participantError) throw participantError

      // 回答を登録
      const availabilityMap: Record<string, number> = {
        "OK": 3,
        "MAYBE": 1,
        "NG": 0
      }

      const responseData = Object.entries(responses).map(([timeRange, availability]) => {
        const slot = timeSlots.find(s => {
          const startTime = new Date(s.start_time)
          const endTime = new Date(s.end_time)

          const jstOffset = 9 * 60 * 60 * 1000
          const jstStartTime = new Date(startTime.getTime() + jstOffset)
          const jstEndTime = new Date(endTime.getTime() + jstOffset)

          const date = jstStartTime.toISOString().split("T")[0]
          const startHour = jstStartTime.getHours().toString().padStart(2, "0")
          const startMinutes = jstStartTime.getMinutes().toString().padStart(2, "0")
          const endHour = jstEndTime.getHours().toString().padStart(2, "0")
          const endMinutes = jstEndTime.getMinutes().toString().padStart(2, "0")

          return `${date} ${startHour}:${startMinutes}-${endHour}:${endMinutes}` === timeRange
        })

        if (!slot) return null

        return {
          time_slot_id: slot.id,
          participant_id: participant.id,
          availability: availabilityMap[availability]
        }
      }).filter(Boolean)

      const { error: responsesError } = await supabase
        .from("responses")
        .insert(responseData)

      if (responsesError) throw responsesError
      
      // 新しい参加者の回答を整理
      const newParticipantResponses = Object.entries(responses).reduce((acc, [timeRange, availability]) => {
        const slot = timeSlots.find(s => {
          const startTime = new Date(s.start_time)
          const endTime = new Date(s.end_time)

          const jstOffset = 9 * 60 * 60 * 1000
          const jstStartTime = new Date(startTime.getTime() + jstOffset)
          const jstEndTime = new Date(endTime.getTime() + jstOffset)

          const date = jstStartTime.toISOString().split("T")[0]
          const startHour = jstStartTime.getHours().toString().padStart(2, "0")
          const startMinutes = jstStartTime.getMinutes().toString().padStart(2, "0")
          const endHour = jstEndTime.getHours().toString().padStart(2, "0")
          const endMinutes = jstEndTime.getMinutes().toString().padStart(2, "0")

          return `${date} ${startHour}:${startMinutes}-${endHour}:${endMinutes}` === timeRange
        })
        if (slot) {
          acc[timeRange] = availabilityMap[availability]
        }
        return acc
      }, {} as Record<string, number>)

      // 状態を更新
      setParticipants(prev => [
        { 
          ...participant, 
          responses: Object.entries(newParticipantResponses).map(([_, availability]) => ({
            time_slot_id: participant.id,
            availability
          }))
        },
        ...prev
      ])
      setParticipantResponses(prev => ({
        ...prev,
        [participant.id]: newParticipantResponses
      }))

      // 入力フォームをクリア
      setName("")
      setComment("")
      setResponses({})

      toast.success("回答を保存しました！")
    } catch (error) {
      console.error("Error submitting responses:", error)
      toast.error("回答の保存に失敗しました。")
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">{meetingData.title}</h1>
      {meetingData.description && (
        <p className="text-gray-600 mb-6">説明: {meetingData.description}</p>
      )}

      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">参加者登録</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                お名前
              </label>
              <Input
                id="name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="山田 太郎"
                required
                autoComplete="name"
              />
            </div>
            <div>
              <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-1">
                コメント
              </label>
              <div className="relative">
                <Textarea
                  id="comment"
                  name="comment"
                  value={comment}
                  onChange={handleCommentChange}
                  placeholder="備考や要望があればご記入ください（40文字以内）"
                  className={`h-20 ${comment.length >= 40 ? 'border-red-500 focus:border-red-500' : ''}`}
                  maxLength={40}
                />
                <div className={`absolute bottom-2 right-2 text-sm ${
                  comment.length >= 40 ? 'text-red-500 font-bold' : 'text-gray-500'
                }`}>
                  {comment.length}/40
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50">
                  日時
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  新規回答
                </th>
                {participants.map((participant) => (
                  <th key={participant.id} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="font-medium">{participant.name}</div>
                    {participant.comment && (
                      <div className="text-gray-400 text-xs normal-case mt-1">{participant.comment}</div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedTimeRanges.map((timeRange, index) => {
                const [currentDate] = timeRange.key.split(" ")
                const [prevDate] = index > 0 ? sortedTimeRanges[index - 1].key.split(" ") : [currentDate]
                const isNewDay = currentDate !== prevDate

                return (
                  <tr 
                    key={timeRange.id}  // スロットのIDを使用して一意性を確保
                    className={`
                      ${timeSlotColors[timeRange.key]} 
                      transition-colors duration-200 
                      ${isNewDay ? 'border-t-8 border-gray-200' : ''}
                    `}
                  >
                    <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-inherit">
                      {`${currentDate} ${timeRange.displayTime}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-2">
                        <Button
                          style={{ fontSize: "1.5rem" }}
                          size="sm"
                          variant={responses[timeRange.key] === "OK" ? "default" : "outline"}
                          onClick={() => setResponses(prev => ({ ...prev, [timeRange.key]: "OK" }))}
                          className="w-10 h-10 text-lg font-bold rounded-full shadow-md hover:scale-105 transition-all flex items-center justify-center"
                        >
                          ◯
                        </Button>
                        <Button
                          style={{ fontSize: "1.5rem" }}
                          size="sm"
                          variant={responses[timeRange.key] === "MAYBE" ? "default" : "outline"}
                          onClick={() => setResponses(prev => ({ ...prev, [timeRange.key]: "MAYBE" }))}
                          className="w-10 h-10 text-lg font-bold rounded-full shadow-md hover:scale-105 transition-all flex items-center justify-center"
                        >
                          △
                        </Button>
                        <Button
                          style={{ fontSize: "1.5rem" }}
                          size="sm"
                          variant={responses[timeRange.key] === "NG" ? "default" : "outline"}
                          onClick={() => setResponses(prev => ({ ...prev, [timeRange.key]: "NG" }))}
                          className="w-10 h-10 text-lg font-bold rounded-full shadow-md hover:scale-105 transition-all flex items-center justify-center"
                        >
                          ✕
                        </Button>
                      </div>
                    </td>
                    {participants.map((participant) => (
                      <td key={participant.id} className="px-6 py-4 whitespace-nowrap text-center">
                        {participantResponses[participant.id]?.[timeRange.key] === 3 && "○"}
                        {participantResponses[participant.id]?.[timeRange.key] === 1 && "△"}
                        {participantResponses[participant.id]?.[timeRange.key] === 0 && "✕"}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={!name}
            className="w-full sm:w-auto"
          >
            回答を送信
          </Button>
        </div>
      </div>
    </div>
  )
}
