import { mergeStyles } from "@/lib/studio-merge"

export async function POST(request: Request) {
  const { defaultGlobalCss, dependencyGlobalCss } = await request.json()

  return mergeStyles({
    type: 'Global CSS',
    baseContent: defaultGlobalCss,
    dependencies: dependencyGlobalCss,
    resultKey: 'globalCss',
    systemPrompt: "You are a CSS expert who helps merge and optimize stylesheets. Always include all content completely without summarizing or truncating. Preserve all keyframes, animations, and complex styles fully.",
    userPromptGenerator: (base, deps) => `You are a CSS expert. Please merge the following global CSS styles into a single optimized stylesheet.

Base Global CSS:
\`\`\`css
${base}
\`\`\`

${deps.map((css, i) => `Dependency ${i + 1} Global CSS:
\`\`\`css
${css}
\`\`\`
`).join("\n")}

Please provide a merged global.css that combines all styles efficiently and includes ALL original code without truncation.`
  })
}
