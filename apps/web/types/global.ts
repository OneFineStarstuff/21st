/* eslint-disable no-unused-vars */
import { Database } from "./supabase"
import { PlanLimits } from "../lib/config/subscription-plans"

export type Component = Database["public"]["Tables"]["components"]["Row"]
export type User = Database["public"]["Tables"]["users"]["Row"]
export type Demo = Database["public"]["Tables"]["demos"]["Row"]
export type Tag = Database["public"]["Tables"]["tags"]["Row"]
export type Submission = Database["public"]["Tables"]["submissions"]["Row"]
export type Category = {
  tag_slug: string
  tag_name: string
  preview_url: string | null
  video_url: string | null
}

export type DemoWithComponent = Demo & {
  component: Component & { user: User }
  user: User
  tags: Tag[]
}

export type ComponentWithUser = Component & {
  user: User
}

export type TagWithCount = Tag & {
  components_count: number
}

export type UserWithComponents = User & {
  components: Component[]
}

export type ThemeOptions = {
  light: string
  dark: string
}

export type PlanType = "free" | "pro" | "pro_plus"

export interface PlanPrice {
  monthly: number
  yearly: number
}

export interface PlanFeature {
  name: string
  included: PlanType
  category: string
  valueByPlan: Record<PlanType, string>
}

export interface PricingPlan {
  name: string
  level: PlanType
  price: PlanPrice
  popular?: boolean
}

export { type PlanLimits }

export interface SVGLogo {
  id?: number
  title: string
  category: string | string[]
  route: string | ThemeOptions
  wordmark?: string | ThemeOptions
  brandUrl?: string
  url: string
}
