import { UseFormReturn } from "react-hook-form"
import { z } from "zod"
import { demoSchema, formSchema } from "../../publish/config/schemas"
import {
  formatComponentName,
  isFormValid,
  TagOption,
} from "../../publish/config/utils"

export { demoSchema, formSchema }

export type FormData = {
  name: string
  component_slug: string
  registry: string
  description: string
  license: string
  website_url?: string
  is_public: boolean
  publish_as_username?: string
  code: string
  demos: Demo[]
  unknown_dependencies?: string[]
  direct_registry_dependencies?: string[]
  slug_available?: boolean
  tailwind_config?: string
  globals_css?: string
}

export type Demo = {
  name: string
  demo_code: string
  demo_slug: string
  tags: Tag[]
  preview_image_data_url: string
  preview_image_file?: File
  preview_video_data_url?: string
  preview_video_file?: File
  demo_direct_registry_dependencies?: string[]
  demo_dependencies?: Record<string, string>
  tailwind_config?: string
  global_css?: string
}

export type Tag = {
  id?: number
  name: string
  slug: string
}

export type DemoFormData = z.infer<typeof demoSchema>

export { formatComponentName, isFormValid, type TagOption }
