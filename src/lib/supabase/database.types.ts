
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "attendance_entries": {
                  Row: {
                    "member_id": number,"reason": string | null,"session_id": number,"status": string,"team_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "member_id": number,"reason"?: string | null,"session_id": number,"status": string,"team_id": number
                  }
                  Update: {
                    "member_id"?: number,"reason"?: string | null,"session_id"?: number,"status"?: string,"team_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_entries_member_id_team_id_fkey"
      columns: ["member_id","team_id"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id","team_id"]
    },{
      foreignKeyName: "attendance_entries_session_id_team_id_fkey"
      columns: ["session_id","team_id"]
isOneToOne: false
      referencedRelation: "attendance_sessions"
      referencedColumns: ["id","team_id"]
    }
                  ]
                },"attendance_sessions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": number,"label": string,"team_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: never,"label"?: string,"team_id": number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: never,"label"?: string,"team_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_sessions_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"battalion_members": {
                  Row: {
                    "battalion_id": number,"created_at": string,"display_name": string,"id": number,"is_admin": boolean,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "battalion_id": number,"created_at"?: string,"display_name": string,"id"?: never,"is_admin"?: boolean,"user_id": string
                  }
                  Update: {
                    "battalion_id"?: number,"created_at"?: string,"display_name"?: string,"id"?: never,"is_admin"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "battalion_members_battalion_id_fkey"
      columns: ["battalion_id"]
isOneToOne: false
      referencedRelation: "battalions"
      referencedColumns: ["id"]
    }
                  ]
                },"battalion_role_assignments": {
                  Row: {
                    "battalion_id": number,"created_at": string,"end_date": string,"id": number,"member_id": number | null,"role_id": number,"start_date": string,"team_member_id": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "battalion_id": number,"created_at"?: string,"end_date": string,"id"?: never,"member_id"?: number | null,"role_id": number,"start_date": string,"team_member_id"?: number | null
                  }
                  Update: {
                    "battalion_id"?: number,"created_at"?: string,"end_date"?: string,"id"?: never,"member_id"?: number | null,"role_id"?: number,"start_date"?: string,"team_member_id"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "battalion_role_assignments_battalion_id_fkey"
      columns: ["battalion_id"]
isOneToOne: false
      referencedRelation: "battalions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "battalion_role_assignments_member_id_battalion_id_fkey"
      columns: ["member_id","battalion_id"]
isOneToOne: false
      referencedRelation: "battalion_members"
      referencedColumns: ["id","battalion_id"]
    },{
      foreignKeyName: "battalion_role_assignments_role_id_battalion_id_fkey"
      columns: ["role_id","battalion_id"]
isOneToOne: false
      referencedRelation: "battalion_roles"
      referencedColumns: ["id","battalion_id"]
    },{
      foreignKeyName: "battalion_role_assignments_team_member_id_fkey"
      columns: ["team_member_id"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id"]
    }
                  ]
                },"battalion_roles": {
                  Row: {
                    "battalion_id": number,"id": number,"is_command": boolean,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "battalion_id": number,"id"?: never,"is_command"?: boolean,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "battalion_id"?: number,"id"?: never,"is_command"?: boolean,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "battalion_roles_battalion_id_fkey"
      columns: ["battalion_id"]
isOneToOne: false
      referencedRelation: "battalions"
      referencedColumns: ["id"]
    }
                  ]
                },"battalions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": number,"invite_code": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: never,"invite_code": string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: never,"invite_code"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"companies": {
                  Row: {
                    "battalion_id": number | null,"created_at": string,"created_by": string | null,"id": number,"invite_code": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "battalion_id"?: number | null,"created_at"?: string,"created_by"?: string | null,"id"?: never,"invite_code": string,"name": string
                  }
                  Update: {
                    "battalion_id"?: number | null,"created_at"?: string,"created_by"?: string | null,"id"?: never,"invite_code"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "companies_battalion_id_fkey"
      columns: ["battalion_id"]
isOneToOne: false
      referencedRelation: "battalions"
      referencedColumns: ["id"]
    }
                  ]
                },"company_members": {
                  Row: {
                    "company_id": number,"created_at": string,"display_name": string,"id": number,"is_admin": boolean,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": number,"created_at"?: string,"display_name": string,"id"?: never,"is_admin"?: boolean,"user_id": string
                  }
                  Update: {
                    "company_id"?: number,"created_at"?: string,"display_name"?: string,"id"?: never,"is_admin"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "company_members_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"company_role_assignments": {
                  Row: {
                    "company_id": number,"created_at": string,"end_date": string,"id": number,"member_id": number | null,"role_id": number,"start_date": string,"team_member_id": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": number,"created_at"?: string,"end_date": string,"id"?: never,"member_id"?: number | null,"role_id": number,"start_date": string,"team_member_id"?: number | null
                  }
                  Update: {
                    "company_id"?: number,"created_at"?: string,"end_date"?: string,"id"?: never,"member_id"?: number | null,"role_id"?: number,"start_date"?: string,"team_member_id"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "company_role_assignments_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "company_role_assignments_member_id_company_id_fkey"
      columns: ["member_id","company_id"]
isOneToOne: false
      referencedRelation: "company_members"
      referencedColumns: ["id","company_id"]
    },{
      foreignKeyName: "company_role_assignments_role_id_company_id_fkey"
      columns: ["role_id","company_id"]
isOneToOne: false
      referencedRelation: "company_roles"
      referencedColumns: ["id","company_id"]
    },{
      foreignKeyName: "company_role_assignments_team_member_id_fkey"
      columns: ["team_member_id"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id"]
    }
                  ]
                },"company_roles": {
                  Row: {
                    "company_id": number,"id": number,"is_command": boolean,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": number,"id"?: never,"is_command"?: boolean,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "company_id"?: number,"id"?: never,"is_command"?: boolean,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "company_roles_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"integrations": {
                  Row: {
                    "created_at": string,"created_by": string | null,"external_id": string,"id": number,"kind": string,"label": string,"team_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"external_id": string,"id"?: never,"kind": string,"label"?: string,"team_id": number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"external_id"?: string,"id"?: never,"kind"?: string,"label"?: string,"team_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "integrations_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"links": {
                  Row: {
                    "category": string,"created_at": string,"id": number,"sort_order": number,"team_id": number,"title": string,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string,"created_at"?: string,"id"?: never,"sort_order"?: number,"team_id": number,"title": string,"url": string
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"id"?: never,"sort_order"?: number,"team_id"?: number,"title"?: string,"url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "links_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"notices": {
                  Row: {
                    "audience": string,"body": string,"created_at": string,"created_by": string | null,"expires_on": string | null,"id": number,"pinned": boolean,"team_id": number,"title": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "audience"?: string,"body"?: string,"created_at"?: string,"created_by"?: string | null,"expires_on"?: string | null,"id"?: never,"pinned"?: boolean,"team_id": number,"title": string,"updated_at"?: string | null
                  }
                  Update: {
                    "audience"?: string,"body"?: string,"created_at"?: string,"created_by"?: string | null,"expires_on"?: string | null,"id"?: never,"pinned"?: boolean,"team_id"?: number,"title"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "notices_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": number,"p256dh": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: never,"p256dh": string,"user_id"?: string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: never,"p256dh"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"role_assignments": {
                  Row: {
                    "created_at": string,"end_date": string,"id": number,"member_id": number,"role_id": number,"start_date": string,"team_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"end_date": string,"id"?: never,"member_id": number,"role_id": number,"start_date": string,"team_id": number
                  }
                  Update: {
                    "created_at"?: string,"end_date"?: string,"id"?: never,"member_id"?: number,"role_id"?: number,"start_date"?: string,"team_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "role_assignments_member_id_team_id_fkey"
      columns: ["member_id","team_id"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id","team_id"]
    },{
      foreignKeyName: "role_assignments_role_id_team_id_fkey"
      columns: ["role_id","team_id"]
isOneToOne: false
      referencedRelation: "team_roles"
      referencedColumns: ["id","team_id"]
    },{
      foreignKeyName: "role_assignments_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"task_checklist_items": {
                  Row: {
                    "created_at": string,"created_by": string | null,"done": boolean,"done_at": string | null,"done_by": string | null,"id": number,"position": number,"task_id": number,"team_id": number,"text": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"done"?: boolean,"done_at"?: string | null,"done_by"?: string | null,"id"?: never,"position"?: number,"task_id": number,"team_id": number,"text": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"done"?: boolean,"done_at"?: string | null,"done_by"?: string | null,"id"?: never,"position"?: number,"task_id"?: number,"team_id"?: number,"text"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_checklist_items_task_id_team_id_fkey"
      columns: ["task_id","team_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","team_id"]
    }
                  ]
                },"task_checklist_ticks": {
                  Row: {
                    "done_at": string,"item_id": number,"member_id": number,"team_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "done_at"?: string,"item_id": number,"member_id": number,"team_id": number
                  }
                  Update: {
                    "done_at"?: string,"item_id"?: number,"member_id"?: number,"team_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_checklist_ticks_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "task_checklist_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_checklist_ticks_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_checklist_ticks_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"task_completions": {
                  Row: {
                    "done_at": string,"done_by": string | null,"member_id": number,"task_id": number,"team_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "done_at"?: string,"done_by"?: string | null,"member_id": number,"task_id": number,"team_id": number
                  }
                  Update: {
                    "done_at"?: string,"done_by"?: string | null,"member_id"?: number,"task_id"?: number,"team_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_completions_member_id_team_id_fkey"
      columns: ["member_id","team_id"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id","team_id"]
    },{
      foreignKeyName: "task_completions_task_id_team_id_fkey"
      columns: ["task_id","team_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","team_id"]
    }
                  ]
                },"task_lanes": {
                  Row: {
                    "lane": string,"position": number,"task_id": number,"team_id": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "lane"?: string,"position"?: number,"task_id": number,"team_id": number,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "lane"?: string,"position"?: number,"task_id"?: number,"team_id"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_lanes_task_id_team_id_fkey"
      columns: ["task_id","team_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","team_id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "assignee_member_id": number | null,"created_at": string,"created_by": string | null,"done_at": string | null,"done_by": string | null,"due_on": string | null,"due_time": string | null,"id": number,"notes": string,"owner_id": string | null,"status": string,"team_id": number,"title": string,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_member_id"?: number | null,"created_at"?: string,"created_by"?: string | null,"done_at"?: string | null,"done_by"?: string | null,"due_on"?: string | null,"due_time"?: string | null,"id"?: never,"notes"?: string,"owner_id"?: string | null,"status"?: string,"team_id": number,"title": string,"visibility": string
                  }
                  Update: {
                    "assignee_member_id"?: number | null,"created_at"?: string,"created_by"?: string | null,"done_at"?: string | null,"done_by"?: string | null,"due_on"?: string | null,"due_time"?: string | null,"id"?: never,"notes"?: string,"owner_id"?: string | null,"status"?: string,"team_id"?: number,"title"?: string,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_assignee_member_id_team_id_fkey"
      columns: ["assignee_member_id","team_id"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id","team_id"]
    },{
      foreignKeyName: "tasks_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"team_members": {
                  Row: {
                    "created_at": string,"first_name": string,"id": number,"is_admin": boolean,"is_staff": boolean,"last_name": string,"nickname": string | null,"sort_order": number,"team_id": number,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"first_name": string,"id"?: never,"is_admin"?: boolean,"is_staff"?: boolean,"last_name"?: string,"nickname"?: string | null,"sort_order"?: number,"team_id": number,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"first_name"?: string,"id"?: never,"is_admin"?: boolean,"is_staff"?: boolean,"last_name"?: string,"nickname"?: string | null,"sort_order"?: number,"team_id"?: number,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_members_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"team_roles": {
                  Row: {
                    "id": number,"is_command": boolean,"name": string,"sort_order": number,"team_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: never,"is_command"?: boolean,"name": string,"sort_order"?: number,"team_id": number
                  }
                  Update: {
                    "id"?: never,"is_command"?: boolean,"name"?: string,"sort_order"?: number,"team_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_roles_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"teams": {
                  Row: {
                    "company_id": number | null,"created_at": string,"created_by": string | null,"id": number,"invite_code": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id"?: number | null,"created_at"?: string,"created_by"?: string | null,"id"?: never,"invite_code": string,"name": string
                  }
                  Update: {
                    "company_id"?: number | null,"created_at"?: string,"created_by"?: string | null,"id"?: never,"invite_code"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teams_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"user_settings": {
                  Row: {
                    "task_layout": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "task_layout"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "task_layout"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "battalion_add_company":
{ Args: { "p_battalion_id": number,"p_company_code": string }; Returns: Json
                           },
"battalion_add_my_company":
{ Args: { "p_battalion_id": number,"p_company_id": number }; Returns: undefined
                           },
"battalion_dashboard":
{ Args: { "p_battalion_id": number }; Returns: Json
                           },
"battalion_move_team":
{ Args: { "p_battalion_id": number,"p_company_id": number,"p_team_id": number }; Returns: undefined
                           },
"battalion_people":
{ Args: { "p_battalion_id": number }; Returns: Json
                           },
"battalion_remove_company":
{ Args: { "p_battalion_id": number,"p_company_id": number }; Returns: undefined
                           },
"battalion_structure":
{ Args: { "p_battalion_id": number }; Returns: Json
                           },
"company_add_my_team":
{ Args: { "p_company_id": number,"p_team_id": number }; Returns: undefined
                           },
"company_add_team":
{ Args: { "p_company_id": number,"p_team_code": string }; Returns: Json
                           },
"company_dashboard":
{ Args: { "p_company_id": number }; Returns: Json
                           },
"company_leave_battalion":
{ Args: { "p_company_id": number }; Returns: undefined
                           },
"company_people":
{ Args: { "p_company_id": number }; Returns: Json
                           },
"company_remove_team":
{ Args: { "p_company_id": number,"p_team_id": number }; Returns: undefined
                           },
"create_battalion":
{ Args: { "p_display_name": string,"p_name": string }; Returns: number
                           },
"create_company":
{ Args: { "p_display_name": string,"p_name": string,"p_team_id"?: number }; Returns: number
                           },
"create_company_in_battalion":
{ Args: { "p_battalion_id": number,"p_display_name": string,"p_name": string }; Returns: number
                           },
"create_team":
{ Args: { "p_first_name": string,"p_last_name"?: string,"p_name": string }; Returns: number
                           },
"create_team_in_company":
{ Args: { "p_company_id": number,"p_first_name": string,"p_last_name"?: string,"p_name": string }; Returns: number
                           },
"join_battalion":
{ Args: { "p_code": string,"p_display_name": string }; Returns: number
                           },
"join_company":
{ Args: { "p_code": string,"p_display_name": string }; Returns: number
                           },
"join_team":
{ Args: { "p_code": string,"p_first_name"?: string,"p_last_name"?: string,"p_member_id"?: number }; Returns: number
                           },
"link_team_to_company":
{ Args: { "p_code": string,"p_team_id": number }; Returns: number
                           },
"my_permissions":
{ Args: { "p_team_id": number }; Returns: Json
                           },
"ping":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"preview_battalion":
{ Args: { "p_code": string }; Returns: Json
                           },
"preview_company":
{ Args: { "p_code": string }; Returns: Json
                           },
"preview_team":
{ Args: { "p_code": string }; Returns: Json
                           },
"regenerate_battalion_code":
{ Args: { "p_battalion_id": number }; Returns: string
                           },
"regenerate_company_code":
{ Args: { "p_company_id": number }; Returns: string
                           },
"regenerate_invite_code":
{ Args: { "p_team_id": number }; Returns: string
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
