import { postInternalApi } from "@/lib/api-fetch"
import { useEffect, useState, useRef } from "react"
import { Component, Tag, User } from "@/types/global"
import { defaultTailwindConfig } from "@/lib/sandpack"
import { defaultGlobalCss } from "@/lib/sandpack"

interface BundleUrls {
  html: string
  js?: string
  css?: string
}

export const useBundleDemo = ({
  files,
  dependencies,
  component,
  shellCode,
  demoId,
  tailwindConfig,
  globalCss,
}: {
  files: Record<string, { code: string }>
  dependencies: Record<string, string>
  component: Component & { user: User } & { tags: Tag[] }
  shellCode: string[]
  demoId: number
  tailwindConfig?: string
  globalCss?: string
}) => {
  const [bundleUrls, setBundleUrls] = useState<BundleUrls | null>(null)
  const [isBundling, setIsBundling] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const prevDataRef = useRef<string>("")

  useEffect(() => {
    const currentData = JSON.stringify({
      files,
      dependencies,
      tailwindConfig,
      globalCss,
    })

    if (currentData === prevDataRef.current) return
    prevDataRef.current = currentData

    setIsBundling(true)
    postInternalApi("/api/bundle", {
      files,
      id: demoId,
      dependencies,
      baseTailwindConfig: defaultTailwindConfig,
      baseGlobalCss: defaultGlobalCss,
      customTailwindConfig: tailwindConfig,
      customGlobalCss: globalCss,
    })
      .then((data) => {
        setBundleUrls(data)
      })
      .catch((error) => {
        setError(error)
      })
      .finally(() => {
        setIsBundling(false)
      })
  }, [
    files,
    dependencies,
    tailwindConfig,
    globalCss,
    demoId,
  ])

  return { bundleUrls, isBundling, error }
}
