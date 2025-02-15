"use client"

import { useParams } from "next/navigation"
import ParticipantPage from "@/components/ParticipantPage"

export default function Page() {
  const { id } = useParams()
  
  return (
    <ParticipantPage meetingId={id as string} />
  )
}
