import { postInternalApi } from "@/lib/api-fetch"
import { useEffect, useState } from "react"
import { uploadToR2 } from "@/lib/r2"
import { useClerkSupabaseClient } from "@/lib/clerk"
import { Component, Tag, User } from "@/types/global"
import { defaultTailwindConfig } from "@/lib/sandpack"
import { defaultGlobalCss } from "@/lib/sandpack"

export const useCompileCss = (
  code: string,
  demoCode: string,
  registryDependencies: Record<string, string>,
  component: Component & { user: User } & { tags: Tag[] },
  shellCode: string[],
  demoId: number,
  demoSlug: string,
  tailwindConfig?: string,
  globalCss?: string,
  compiledCss?: string | null,
) => {
  const [css, setCss] = useState<string | null>(compiledCss || null)
  const [isCompiling, setIsCompiling] = useState(false)
  const client = useClerkSupabaseClient()

  useEffect(() => {
    if (compiledCss) return

    setIsCompiling(true)
    postInternalApi("/api/bundle", {
      code,
      demoCode,
      baseTailwindConfig: defaultTailwindConfig,
      baseGlobalCss: defaultGlobalCss,
      dependencies: Object.values(registryDependencies ?? {}).concat(
        shellCode,
      ),
      customTailwindConfig: tailwindConfig,
      customGlobalCss: globalCss,
    })
      .then((data) => {
        setCss(data.css)
        return data.css
      })
      .then(async (compiledCss) => {
        if (component.id && demoId) {
          const { data: existingDemo, error: checkError } = await client
            .from("demos")
            .select("id, component_id")
            .eq("id", demoId)

          if (checkError || !existingDemo || existingDemo.length === 0) {
            return
          }
          const timestamp = new Date().toISOString()
          const fileName = `${component.user.username}/${component.component_slug}/${demoSlug}/${timestamp}.css`

          const uploadResult = await uploadToR2({
            file: new File([compiledCss], fileName, { type: "text/css" }),
            fileKey: fileName,
            bucketName: "components-code",
            contentType: "text/css",
          })

          if (uploadResult) {
            await client
              .from("demos")
              .update({ compiled_css_url: uploadResult })
              .eq("id", demoId)
          }
        }
      })
      .catch((error) => {
        console.error("Error compiling CSS:", error)
      })
      .finally(() => {
        setIsCompiling(false)
      })
  }, [
    code,
    demoCode,
    registryDependencies,
    tailwindConfig,
    globalCss,
    component.id,
    demoId,
  ])

  return { css, isCompiling }
}
