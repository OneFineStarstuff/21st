import { parse } from "@babel/parser"
import traverse from "@babel/traverse"
import * as t from "@babel/types"
import { getPackageNameFromSource, shouldAddDependency } from "./parser-utils"

export function extractComponentNames(code: string): string[] {
  const componentRegex =
    /export\s+(?:default\s+)?(?:function|const|class|let|var)\s+(\w+)|export\s*{\s*([^}]+)\s*}|export\s+(\w+)\s*;/g

  const matches = Array.from(code.matchAll(componentRegex))
  const componentNames = matches.flatMap((match) => {
    if (match[1]) {
      return [match[1]]
    } else if (match[2]) {
      return match[2].split(",").map((name) => name.trim().split(/\s+as\s+/)[0])
    } else if (match[3]) {
      return [match[3]]
    }
    return []
  })

  const uniqueNames = [...new Set(componentNames)]

  return uniqueNames.filter((name): name is string => name !== undefined)
}

export function extractExportedTypes(code: string): string[] {
  const typeRegex = /export\s+(type|interface)\s+(\w+)(?![=(])/g
  const exportedTypeRegex = /export\s*{\s*(?:type|interface)?\s*([^}]+)\s*}/g

  const matches = Array.from(code.matchAll(typeRegex))
  const types = matches.map((match) => match[2])

  const exportedMatches = Array.from(code.matchAll(exportedTypeRegex))
  const exportedTypes = exportedMatches.flatMap((match) =>
    match[1].split(",").map((name) => name.trim().split(/\s+as\s+/)[0]),
  )

  return [...new Set([...types, ...exportedTypes])]
}

export function extractNpmDependencies(
  code: string,
  defaultDependencies: string[] = [],
): Record<string, string> {
  const dependencies: Record<string, string> = {}

  try {
    const ast = parse(code, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    })

    traverse(ast, {
      ImportDeclaration({ node }) {
        const packageName = getPackageNameFromSource(node.source.value)
        if (packageName && shouldAddDependency(packageName, defaultDependencies)) {
          dependencies[packageName] = "latest"
        }
      },
      ImportNamespaceSpecifier(path) {
        const importDeclaration = path.findParent((p) => p.isImportDeclaration())
        if (importDeclaration && t.isImportDeclaration(importDeclaration.node)) {
          const packageName = getPackageNameFromSource(importDeclaration.node.source.value)
          if (packageName && shouldAddDependency(packageName, defaultDependencies)) {
            dependencies[packageName] = "latest"
          }
        }
      },
    })
  } catch (error) {
    console.error("Error parsing code for dependencies:", error)
  }

  return dependencies
}
