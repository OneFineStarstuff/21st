import { UseFormReturn } from "react-hook-form"
import { z } from "zod"
import { demoSchema, formSchema } from "./schemas"

export { demoSchema, formSchema }

export type FormData = z.infer<typeof formSchema>
export type DemoFormData = z.infer<typeof demoSchema>

export interface TagOption {
  value: number
  label: string
  __isNew__?: boolean
}

export const formatComponentName = (name: string): string => {
  return name.replace(/([A-Z])/g, " $1").trim()
}

export const isFormValid = (form: UseFormReturn<any>): boolean => {
  const values = form.getValues()
  const {
    name,
    component_slug,
    code,
    demos,
    registry,
    license,
    unknown_dependencies,
  } = values

  return Boolean(
    name?.length >= 2 &&
      component_slug?.length >= 2 &&
      code?.length > 0 &&
      demos?.length > 0 &&
      registry &&
      license &&
      unknown_dependencies?.length === 0,
  )
}
