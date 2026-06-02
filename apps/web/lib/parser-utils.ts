import * as t from "@babel/types"

export const getPackageNameFromSource = (source: string) => {
  if (typeof source !== "string" || source.startsWith(".") || source.startsWith("/") || source.startsWith("@/")) {
    return null
  }
  return source === "motion/react" ? "motion" : source
}

export const shouldAddDependency = (packageName: string, defaultDependencies: string[]) => {
  return (
    packageName &&
    !defaultDependencies.includes(packageName) &&
    !packageName.startsWith("next")
  )
}
