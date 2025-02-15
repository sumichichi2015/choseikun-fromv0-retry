export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      meetings: {
        Row: {
          id: string
          title: string
          description: string | null
          access_token: string
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          access_token: string
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          access_token?: string
          created_at?: string
        }
      }
      time_slots: {
        Row: {
          id: string
          meeting_id: string
          start_time: string
          end_time: string
          created_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          start_time: string
          end_time: string
          created_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string
          start_time?: string
          end_time?: string
          created_at?: string
        }
      }
      participants: {
        Row: {
          id: string
          meeting_id: string
          name: string
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          name: string
          comment?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string
          name?: string
          comment?: string | null
          created_at?: string
        }
      }
      responses: {
        Row: {
          id: string
          time_slot_id: string
          participant_id: string
          availability: number
          created_at: string
        }
        Insert: {
          id?: string
          time_slot_id: string
          participant_id: string
          availability: number
          created_at?: string
        }
        Update: {
          id?: string
          time_slot_id?: string
          participant_id?: string
          availability?: number
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
