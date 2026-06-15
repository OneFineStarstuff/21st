export function standardizeAdditionalStyles(data: any) {
  if (!data.additionalStyles) return data

  // Standardize empty objects in tailwindExtensions
  if (data.additionalStyles.tailwindExtensions) {
    const extensions = [
      "colors",
      "animations",
      "fontFamily",
      "borderRadius",
      "boxShadow",
      "spacing",
    ]
    extensions.forEach((ext) => {
      if (!data.additionalStyles.tailwindExtensions[ext]) {
        data.additionalStyles.tailwindExtensions[ext] = {}
      }
    })
  }

  // Fix any undefined values in keyframes
  if (data.additionalStyles.keyframes) {
    data.additionalStyles.keyframes = data.additionalStyles.keyframes.map(
      (keyframe: any) => {
        const name = keyframe.name || keyframe.keyframeName || ""
        const frames = keyframe.frames || keyframe.definition || ""

        if (!frames || frames === "undefined") {
          return {
            name,
            frames:
              "0% { opacity: 0; transform: scale(0.95); }\n100% { opacity: 1; transform: scale(1); }",
          }
        }
        return { name, frames }
      },
    )
  }

  // Fix any undefined values in utilities
  if (data.additionalStyles.utilities) {
    data.additionalStyles.utilities = data.additionalStyles.utilities.map(
      (utility: any) => {
        const className = utility.className || utility.name || ""
        const definition = utility.definition || utility.properties || ""

        if (!definition || definition === "undefined") {
          return {
            className,
            definition: "/* Add your custom styles here */",
          }
        }
        return { className, definition }
      },
    )
  }

  return data
}
