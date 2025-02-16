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
  created_at: string
}

interface Response {
  response: "○" | "△" | "×"
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
  const [responses, setResponses] = useState<{ [key: string]: "OK" | "MAYBE" | "NG" | null }>({})
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [participantResponses, setParticipantResponses] = useState<Record<string, Record<string, number>>>({})
  const [isMouseDown, setIsMouseDown] = useState(false)
  const [currentResponse, setCurrentResponse] = useState<"OK" | "MAYBE" | "NG" | null>(null)

  // 日付フォーマット用のユーティリティ関数
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short"
    }).replace(/\//g, "/")
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

  // 参加者を日時でソート（最も古い回答が最右列）
  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    }).reverse()  // 古い順に右から左へ並べるために反転
  }, [participants])

  // セルの色を計算する関数
  const calculateCellColor = useCallback((timeRangeKey: string) => {
    // その時間枠における全参加者の回答を取得
    const responses = sortedParticipants.map(participant => 
      participantResponses[participant.id]?.[timeRangeKey]
    ).filter(response => response !== undefined)

    if (!responses || responses.length === 0) return ""

    const totalResponses = responses.length
    const circleCount = responses.filter(r => r === 3).length
    const triangleCount = responses.filter(r => r === 1).length
    const xCount = responses.filter(r => r === 0).length

    // 全員が○の場合
    if (circleCount === totalResponses) {
      return "bg-blue-400"
    }

    // ○と△のみの場合（×がない）
    if (xCount === 0 && circleCount + triangleCount === totalResponses) {
      return "bg-blue-100"
    }

    // 参加可能性スコアの計算（○=3点、△=1点、×=0点）
    const totalScore = (circleCount * 3 + triangleCount * 1)
    const maxPossibleScore = totalResponses * 3
    const participationRatio = totalScore / maxPossibleScore

    // 参加可能性が70%を超える場合
    if (participationRatio > 0.7) {
      return "bg-orange-100"
    }

    // それ以外の場合（参加可能性が低い）
    return "bg-pink-100"
  }, [sortedParticipants, participantResponses])

  // コメント文字数制限を追加
  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newComment = e.target.value
    if (newComment.length <= 40) {
      setComment(newComment)
    }
  }

  // マウスダウン時の処理
  const handleMouseDown = (response: "OK" | "MAYBE" | "NG") => {
    setIsMouseDown(true)
    setCurrentResponse(response)
  }

  // マウスアップ時の処理
  const handleMouseUp = () => {
    setIsMouseDown(false)
    setCurrentResponse(null)
  }

  // マウス移動時の処理
  const handleMouseEnter = (timeRangeKey: string) => {
    if (isMouseDown && currentResponse) {
      setResponses(prev => ({ ...prev, [timeRangeKey]: currentResponse }))
    }
  }

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
            created_at,
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

  useEffect(() => {
    // マウスアップイベントをグローバルに設定
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

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
    <div className="max-w-4xl mx-auto p-2">
      <h1 className="text-2xl font-bold mb-6">{meetingData.title}</h1>
      {meetingData.description && (
        <p className="text-gray-600 mb-6">説明: {meetingData.description}</p>
      )}

      <div className="space-y-6">

        {/* 参加者登録フォーム */}
        <div className="mt-4">
          <div className="bg-white rounded-lg shadow p-4">
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
                  onChange={(e) => setName(e.target.value.slice(0, 6))}
                  placeholder="山田 太郎"
                  required
                  autoComplete="name"
                  maxLength={6}
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
        </div>

        {/* テーブル */}
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th scope="col" className="px-4 py-2 text-left text-sm font-medium text-gray-500 sticky left-0 bg-white border-r border-gray-300">
                  日時
                </th>
                <th className="text-center border-b border-r border-gray-300 bg-gray-50">
                  <div>あなたの回答↓</div>
                  <div className="text-xs text-gray-500">※ドラッグで複数選択可</div>
                </th>
                {sortedParticipants.map((participant) => (
                  <th key={participant.id} scope="col" className="px-4 py-2 text-center text-sm font-medium text-gray-500 border-r border-gray-300">
                    <div className="font-medium">{participant.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedTimeRanges.map((timeRange, index) => {
                const [currentDate] = timeRange.key.split(" ")
                const [prevDate] = index > 0 ? sortedTimeRanges[index - 1].key.split(" ") : [""]
                const isNewDay = currentDate !== prevDate

                const participantResponsesForTimeRange = sortedParticipants
                  .map(participant => participantResponses[participant.id]?.[timeRange.key])
                  .filter(response => response !== undefined)

                const cellColor = calculateCellColor(timeRange.key)

                return (
                  <tr
                    key={timeRange.key}
                    className={`${isNewDay ? "border-t-2 border-gray-300" : ""} ${cellColor}`}
                  >
                    <td className={`px-4 py-2 text-sm whitespace-nowrap sticky left-0 bg-white border-r border-gray-300 ${isNewDay ? 'border-t-2 border-t-gray-400' : ''}`}>
                      {isNewDay && (
                        <div className="font-medium">
                          {new Date(currentDate).toLocaleDateString("ja-JP", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            weekday: "short"
                          }).replace(/\//g, "/")}
                        </div>
                      )}
                      <div>{timeRange.displayTime}</div>
                    </td>
                    <td className={`px-4 py-2 whitespace-nowrap border-r border-gray-300`}>
                      <div className="flex space-x-1 justify-center">
                        <Button
                          style={{ fontSize: "1.5rem" }}
                          size="sm"
                          variant={responses[timeRange.key] === "OK" ? "default" : "outline"}
                          onClick={() => setResponses(prev => ({ ...prev, [timeRange.key]: "OK" }))}
                          onMouseDown={(e) => {
                            handleMouseDown("OK")
                            setResponses(prev => ({ ...prev, [timeRange.key]: "OK" }))
                          }}
                          onMouseEnter={() => handleMouseEnter(timeRange.key)}
                          className="w-8 h-8 text-sm font-bold rounded-full shadow-sm hover:scale-105 transition-all flex items-center justify-center"
                        >
                          ◯
                        </Button>
                        <Button
                          style={{ fontSize: "1.5rem" }}
                          size="sm"
                          variant={responses[timeRange.key] === "MAYBE" ? "default" : "outline"}
                          onClick={() => setResponses(prev => ({ ...prev, [timeRange.key]: "MAYBE" }))}
                          onMouseDown={(e) => {
                            handleMouseDown("MAYBE")
                            setResponses(prev => ({ ...prev, [timeRange.key]: "MAYBE" }))
                          }}
                          onMouseEnter={() => handleMouseEnter(timeRange.key)}
                          className="w-8 h-8 text-sm font-bold rounded-full shadow-sm hover:scale-105 transition-all flex items-center justify-center"
                        >
                          △
                        </Button>
                        <Button
                          style={{ fontSize: "1.5rem" }}
                          size="sm"
                          variant={responses[timeRange.key] === "NG" ? "default" : "outline"}
                          onClick={() => setResponses(prev => ({ ...prev, [timeRange.key]: "NG" }))}
                          onMouseDown={(e) => {
                            handleMouseDown("NG")
                            setResponses(prev => ({ ...prev, [timeRange.key]: "NG" }))
                          }}
                          onMouseEnter={() => handleMouseEnter(timeRange.key)}
                          className="w-8 h-8 text-sm font-bold rounded-full shadow-sm hover:scale-105 transition-all flex items-center justify-center"
                        >
                          ✕
                        </Button>
                      </div>
                    </td>
                    {sortedParticipants.map((participant) => (
                      <td key={participant.id} className={`px-4 py-2 text-center text-sm whitespace-nowrap border-r border-gray-300`}>
                        <span style={{ fontSize: "1.5rem" }}>
                          {participantResponses[participant.id]?.[timeRange.key] === 3 && "◯"}
                          {participantResponses[participant.id]?.[timeRange.key] === 1 && "△"}
                          {participantResponses[participant.id]?.[timeRange.key] === 0 && "✕"}
                        </span>
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* コメント一覧 */}
        {participants.length > 0 && (
          <div className="mt-4 bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold mb-2">参加者コメント</h3>
            <ul className="space-y-2">
              {sortedParticipants.map((participant) => (
                participant.comment && (
                  <li key={participant.id} className="text-sm">
                    <span className="font-medium">{participant.name}:</span> {participant.comment}
                  </li>
                )
              ))}
            </ul>
          </div>
        )}

        {/* 送信ボタン */}
        <div className="flex justify-end mt-4">
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
