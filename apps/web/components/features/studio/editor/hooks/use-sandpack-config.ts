import { useMemo } from "react"
import { useTheme } from "next-themes"
import type { SandpackFiles } from "@codesandbox/sandpack-react"
import { generateSandpackFiles } from "../utils/sandpack-files"

const formatNpmDependencies = (deps?: string[]) =>
  deps?.reduce((acc: Record<string, string>, dep: string) => ({ ...acc, [dep]: "latest" }), {}) || {}

interface UseSandpackConfigProps {
  componentPath: string
  componentCode: string
  processedData: any | null
  registryDependencies: Record<string, { code: string; registry: string }>
  npmDependenciesOfRegistryDependencies: Record<string, string>
  activePreviewFilePath: string | null
  initialCompiledCss: string | null
  generateStylesCss: () => string
  generateAppTsx: () => string
  fileContentCache: Map<string, string>
  isProcessing: boolean
}

/**
 * Hook for generating and managing Sandpack configuration
 */
export function useSandpackConfig({
  componentPath,
  componentCode,
  processedData,
  registryDependencies,
  npmDependenciesOfRegistryDependencies,
  activePreviewFilePath,
  initialCompiledCss,
  generateStylesCss,
  generateAppTsx,
  fileContentCache,
  isProcessing,
}: UseSandpackConfigProps) {
  const { resolvedTheme } = useTheme()
  const isDarkTheme = resolvedTheme === "dark"

  // Generate files for Sandpack
  const files = useMemo(() => {
    // Start with a fresh copy of all files
    const allFiles: SandpackFiles = {}

    // Add registry dependencies first
    Object.entries(registryDependencies).forEach(([path, content]) => {
      allFiles[path] = {
        code: typeof content === "string" ? content : content.code,
      }
    })

    // Generate base files
    const generatedFiles = generateSandpackFiles({
      componentPath,
      componentCode,
      dependencies: {
        ...formatNpmDependencies(processedData?.npmDependencies),
          ...npmDependenciesOfRegistryDependencies,
        },
      },
    }
  }, [
    files,
    componentPath,
    activePreviewFilePath,
    registryDependencies,
    processedData?.npmDependencies,
    npmDependenciesOfRegistryDependencies,
    isDarkTheme,
    processedData,
    isProcessing,
  ])

  return {
    files,
    sandpackConfig,
  }
}
